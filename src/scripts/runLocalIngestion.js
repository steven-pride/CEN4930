// -- dry-run: Fetch and parse metrics without writing to database

const { HuggingFaceClient } = require('../api/huggingfaceClient');
const modelsConfig = require('../config/models.config.json');
const { syncModelsAndProviders, saveMeasurements, closePool } = require('../db/dataAccessLayer');

// Safely convert value to finite number or null, preserving 0
function parseNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

// Convert price to USD per 1 Million tokens
function parsePricePerMillion(price, unit = '1M') {
    const num = parseNumber(price);
    if (num === null) return null;
    if (unit === '1K' || unit === '1k' || unit === 'kilo') return num * 1000;
    if (unit === '1' || unit === 'token') return num * 1000000;
    return num;
}

// Metric sanity checks: validate ranges and filter outliers to null while preserving genuine 0
function validateLatency(value, modelId, providerId) {
    const num = parseNumber(value);
    if (num === null) return null;
    if (num < 0 || num >= 120000) {
        console.warn(`[Outlier Filter] Latency ${num}ms out of range [0, 120000) for ${modelId} (${providerId}). Resetting to NULL.`);
        return null;
    }
    return Math.round(num * 100) / 100;
}

function validateThroughput(value, modelId, providerId) {
    const num = parseNumber(value);
    if (num === null) return null;
    if (num < 0 || num >= 2000) {
        console.warn(`[Outlier Filter] Throughput ${num} TPS out of range [0, 2000) for ${modelId} (${providerId}). Resetting to NULL.`);
        return null;
    }
    return Math.round(num * 100) / 100;
}

function validatePrice(value, modelId, providerId, type = 'price') {
    const num = parsePricePerMillion(value);
    if (num === null) return null;
    if (num < 0 || num >= 100) {
        console.warn(`[Outlier Filter] ${type} $${num}/1M tokens out of range [0, 100) for ${modelId} (${providerId}). Resetting to NULL.`);
        return null;
    }
    return num;
}

// Extract standardized measurement records from raw model payload
function extractMeasurements(modelId, rawPayload, allowedProviders) {
    // Check if the payload exists and is an object
    if (!rawPayload || typeof rawPayload !== 'object') {
        return [];
    }

    const collectedAt = new Date().toISOString();
    const measurements = [];
    const modelData = rawPayload.data || rawPayload;

    if (Array.isArray(modelData.providers)) {
        for (const item of modelData.providers) {
            const providerId = item.provider || item.id;

            // if the providerId is not defined or is not in the allowedProviders set, skip this provider
            if (!providerId || (allowedProviders && !allowedProviders.has(providerId))) {
                continue;
            }

            // Log that the provider is not live for the given model
            if (item.status && item.status !== 'live') {
                console.warn(`Provider "${providerId}" for "${modelId}" reported non-live status: ${item.status}`);
            }

            // Extract latency, throughput, and pricing with sanity checks
            const rawLatency = item.first_token_latency_ms ?? item.latency?.firstResponseLatencyMs ?? item.latency;
            const rawThroughput = item.throughput?.throughputTPS ?? item.throughput;
            const pricing = item.pricing || {};

            measurements.push({
                modelId,
                providerId,
                firstResponseLatencyMs: validateLatency(rawLatency, modelId, providerId),
                throughputTPS: validateThroughput(rawThroughput, modelId, providerId),
                promptCostPerMillion: validatePrice(pricing.input ?? pricing.promptCostPerMillion ?? pricing.prompt, modelId, providerId, 'Prompt cost'),
                completionCostPerMillion: validatePrice(pricing.output ?? pricing.completionCostPerMillion ?? pricing.completion, modelId, providerId, 'Completion cost'),
                collectedAt,
            });
        }
    }

    return measurements;
}

function parseArgs() {
    const args = process.argv.slice();
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        console.info(`Processing argument: ${arg}`);
        if (arg === 'dry-run') {
            dryRun = true;
        }
    }

    return {
        dryRun,
    };
}

async function run(options = {}, context = null) {
    const configuredModels = modelsConfig.models || [];
    const configuredProviders = modelsConfig.providers || [];
    const targetProviderIds = new Set(configuredProviders.map((p) => p.id));

    console.log(`Starting ingestion (${options.dryRun ? 'DRY RUN' : 'LIVE DB'}) for ${configuredModels.length} model(s)...`);

    const allMeasurements = [];
    const errors = [];
    const client = new HuggingFaceClient();

    // Query Hugging Face API with 3-way throttled concurrency
    const BATCH_SIZE = 3;
    for (let i = 0; i < configuredModels.length; i += BATCH_SIZE) {
        const batch = configuredModels.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (model) => {
                try {
                    console.log(`Fetching data for model: ${model.id}`);
                    const rawPayload = await client.fetchModelData(model.id);
                    const measurements = extractMeasurements(model.id, rawPayload, targetProviderIds);
                    console.log(`  Parsed ${measurements.length} provider snapshot(s) for ${model.id}`);
                    return { measurements, error: null };
                } catch (err) {
                    console.error(`  Failed to fetch ${model.id}: ${err.message}`);
                    return { measurements: [], error: { modelId: model.id, error: err.message } };
                }
            })
        );

        for (const res of batchResults) {
            allMeasurements.push(...res.measurements);
            if (res.error) {
                errors.push(res.error);
            }
        }
    }

    let savedCount = 0;
    if (!options.dryRun && allMeasurements.length > 0) {
        console.log('\nSaving to database...');
        console.log('Syncing configured models and providers');
        await syncModelsAndProviders(configuredModels, configuredProviders);
        console.log('Adding measurements snapshot');
        savedCount = await saveMeasurements(allMeasurements);
        console.log(`Successfully saved ${savedCount} measurement rows to database.`);
    }

    console.log('\n--- Ingestion Run Summary ---');
    console.log(`Models processed: ${configuredModels.length - errors.length}/${configuredModels.length}`);
    console.log(`Total snapshots generated: ${allMeasurements.length}`);
    if (!options.dryRun) {
        console.log(`Total rows inserted to DB: ${savedCount}`);
    }
    console.log(`Errors: ${errors.length}`);

    if (options.dryRun && allMeasurements.length > 0) {
        console.log('\nSample dry-run records:');
        console.log(JSON.stringify(allMeasurements, null, 2));
    }

    if (errors.length > 0) {
        process.exitCode = 1;
    }

    return {
        modelsProcessed: configuredModels.length - errors.length,
        totalModels: configuredModels.length,
        recordsInserted: savedCount,
        errors: `${errors}`
    }
}

async function main() {
    try {
        const options = parseArgs();
        await run(options);
    } catch (error) {
        console.error('Fatal ingestion error:', error.message);
        process.exitCode = 1;
    }
    finally {
        // Ensure that SQL Connection is closed
        await closePool();
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    extractMeasurements,
    run
};
