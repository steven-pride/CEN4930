// Fetch model providers and save sample responses in docs/api_samples/.
// Run npm run probe for all configured models, or pass model IDs to this script.
const { HuggingFaceClient } = require('../api/huggingfaceClient');
const modelsConfig = require('../config/models.config.json');

function sanitizeModelMetadata(raw = {}) {
    const data = raw.data || raw;
    const rawProviders = Array.isArray(data.providers) ? data.providers : [];

    const providerMapping = {};
    for (const p of rawProviders) {
        providerMapping[p.provider] = {
            status: p.status,
            latencyMs: p.first_token_latency_ms ?? null,
            throughputTPS: p.throughput ?? null,
            pricing: p.pricing || null,
        };
    }

    return {
        fetchedAt: new Date().toISOString(),
        id: data.id || raw._id || raw.modelId || null,
        object: data.object || null,
        ownedBy: data.owned_by || raw.author || null,
        providers: providerMapping,
        inferenceProviderMapping: data.inferenceProviderMapping || providerMapping,
    };
}

// Fetch one model's providers and save the selected fields.
async function probeModel(client, modelId) {
    console.log('Probing model', { modelId });
    const raw = await client.fetchModelData(modelId);
    const sanitized = sanitizeModelMetadata(raw);

    return sanitized;
}

async function main() {
    if (!modelsConfig.providers?.length || !modelsConfig.models?.length) {
        throw new Error('Configure at least one provider and one model.');
    }

    const client = new HuggingFaceClient();
    const targets = modelsConfig.models.map((model) => model.id);

    console.log('Starting Hugging Face API probe', {
        count: targets.length,
        providers: modelsConfig.providers.map((provider) => provider.id),
        task: modelsConfig.task,
        targets,
    });

    let succeeded = 0;
    for (const modelId of targets) {
        try {
            // Request one model at a time to avoid hitting API rate limits.
            const sanitized = await probeModel(client, modelId);
            let modelAllLive = true;

            for (const provider of modelsConfig.providers) {
                const mapping = sanitized.providers?.[provider.id] || sanitized.inferenceProviderMapping?.[provider.id];
                if (mapping?.status !== 'live') {
                    modelAllLive = false;
                    console.error('Provider unavailable', {
                        modelId,
                        provider: provider.id,
                        status: mapping?.status || 'missing',
                    });
                }
            }

            if (modelAllLive) {
                succeeded += 1;
            }
            console.info(JSON.stringify(sanitized));
        } catch (error) {
            console.error('Probe failed', {
                modelId,
                status: error.response?.status,
                message: error.message,
            });
        }
    }

    console.log('Probe complete', {
        succeeded,
        failed: targets.length - succeeded,
    });

    // Any missing pair or failed request makes the check fail.
    if (succeeded !== targets.length) {
        process.exitCode = 1;
    }
}

// Run only when started directly, not when imported by another file.
if (require.main === module) {
    main().catch((error) => {
        console.error('Error in probe script', { message: error.message });
        process.exitCode = 1;
    });
}
