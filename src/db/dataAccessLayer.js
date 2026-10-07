const { sql, getPool } = require('./dbContext');

// Sync configured models and providers into reference tables
async function syncModelsAndProviders(models = [], providers = []) {
    const pool = await getPool();

    for (const model of models) {
        const request = pool.request();
        request.input('ModelID', sql.VarChar(100), model.id);
        request.input('DisplayName', sql.NVarChar(200), model.displayName || model.id);

        await request.query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.Models WHERE ModelID = @ModelID)
            BEGIN
                INSERT INTO dbo.Models (ModelID, DisplayName)
                VALUES (@ModelID, @DisplayName);
            END
        `);
    }

    for (const provider of providers) {
        const request = pool.request();
        request.input('ProviderID', sql.VarChar(50), provider.id);
        request.input('ProviderName', sql.NVarChar(150), provider.name || provider.id);

        await request.query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.Providers WHERE ProviderID = @ProviderID)
            BEGIN
                INSERT INTO dbo.Providers (ProviderID, ProviderName)
                VALUES (@ProviderID, @ProviderName);
            END
        `);
    }
}

// Insert a batch of measurement records idempotently with deadlock retry safety
async function saveMeasurements(measurements = [], maxRetries = 3) {
    if (!measurements || measurements.length === 0) {
        return 0;
    }

    const pool = await getPool();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            let insertedCount = 0;

            for (const item of measurements) {
                const request = new sql.Request(transaction);
                request.input('ModelID', sql.VarChar(100), item.modelId);
                request.input('ProviderID', sql.VarChar(50), item.providerId);
                request.input('CollectedAt', sql.DateTimeOffset(3), item.collectedAt ? new Date(item.collectedAt) : new Date());
                request.input('FirstResponseLatencyMs', sql.Decimal(10, 2), item.firstResponseLatencyMs ?? null);
                request.input('ThroughputTPS', sql.Decimal(10, 2), item.throughputTPS ?? null);
                request.input('PromptCostPerMillion', sql.Decimal(12, 6), item.promptCostPerMillion ?? null);
                request.input('CompletionCostPerMillion', sql.Decimal(12, 6), item.completionCostPerMillion ?? null);

                await request.query(`
                    IF NOT EXISTS (
                        SELECT 1 FROM dbo.Measurements
                        WHERE ModelID = @ModelID
                          AND ProviderID = @ProviderID
                          AND CollectedAt = @CollectedAt
                    )
                    BEGIN
                        INSERT INTO dbo.Measurements (
                            ModelID,
                            ProviderID,
                            CollectedAt,
                            FirstResponseLatencyMs,
                            ThroughputTPS,
                            PromptCostPerMillion,
                            CompletionCostPerMillion
                        ) VALUES (
                            @ModelID,
                            @ProviderID,
                            @CollectedAt,
                            @FirstResponseLatencyMs,
                            @ThroughputTPS,
                            @PromptCostPerMillion,
                            @CompletionCostPerMillion
                        );
                    END
                `);
                insertedCount++;
            }

            await transaction.commit();
            return insertedCount;
        } catch (err) {
            await transaction.rollback().catch(() => {});
            const isDeadlock = err.number === 1205;
            if (attempt < maxRetries && isDeadlock) {
                console.warn(`Deadlock encountered during saveMeasurements (attempt ${attempt}/${maxRetries}), retrying...`);
                await new Promise((resolve) => setTimeout(resolve, attempt * 500));
                continue;
            }
            throw err;
        }
    }
}

async function closePool() {
    const pool = await getPool();
    await pool.close();
}

module.exports = {
    syncModelsAndProviders,
    saveMeasurements,
    closePool,
};
