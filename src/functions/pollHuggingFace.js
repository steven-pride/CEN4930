const { app } = require('@azure/functions');
const { runIngestion } = require('../scripts/runOnlineIngestion');

// Azure Functions Timer Trigger to poll Hugging Face model metrics daily
app.timer('pollHuggingFaceTimer', {
    schedule: process.env.TIMER_SCHEDULE || '0 0 0 * * *',
    handler: async (myTimer, context) => {
        context.log('Azure Function Timer Trigger executed at:', new Date().toISOString());

        if (myTimer.isPastDue) {
            context.log('Timer function is running late!');
        }

        try {
            const result = await runIngestion({}, context);
            context.log(`Ingestion completed: Processed ${result.modelsProcessed}/${result.totalModels} models, ${result.recordsInserted} records inserted.`);
        } catch (error) {
            context.error('Critical failure during scheduled ingestion:', error);
            throw error;
        }
    },
});
