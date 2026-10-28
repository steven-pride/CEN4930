const { app } = require('@azure/functions');
const {
    getModels,
    getLatencyMetrics,
    getThroughputMetrics,
    getThroughputPerDollarMetrics
} = require('../db/dataAccessLayer');

// Common response headers including CORS
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
};

// GET /api/models - Returns list of models for dropdown selection
app.http('getModelsHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/models',
    handler: async (request, context) => {
        try {
            const data = await getModels();
            return {
                status: 200,
                headers: DEFAULT_HEADERS,
                jsonBody: data
            };
        } catch (err) {
            context.error('Error fetching models:', err);
            return {
                status: 500,
                headers: DEFAULT_HEADERS,
                jsonBody: { error: err.message }
            };
        }
    }
});

// GET /api/metrics/latency - Latency time-series data
app.http('getLatencyMetricsHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/metrics/latency',
    handler: async (request, context) => {
        try {
            const modelId = request.query.get('modelId');
            const data = await getLatencyMetrics(modelId);
            return {
                status: 200,
                headers: DEFAULT_HEADERS,
                jsonBody: data
            };
        } catch (err) {
            context.error('Error fetching latency metrics:', err);
            return {
                status: 500,
                headers: DEFAULT_HEADERS,
                jsonBody: { error: err.message }
            };
        }
    }
});

// GET /api/metrics/throughput - Averaged throughput comparisons
app.http('getThroughputMetricsHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/metrics/throughput',
    handler: async (request, context) => {
        try {
            const modelId = request.query.get('modelId');
            const data = await getThroughputMetrics(modelId);
            return {
                status: 200,
                headers: DEFAULT_HEADERS,
                jsonBody: data
            };
        } catch (err) {
            context.error('Error fetching throughput metrics:', err);
            return {
                status: 500,
                headers: DEFAULT_HEADERS,
                jsonBody: { error: err.message }
            };
        }
    }
});

// GET /api/metrics/throughput-per-dollar - Throughput per dollar scatter plot data
app.http('getThroughputPerDollarMetricsHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/metrics/throughput-per-dollar',
    handler: async (request, context) => {
        try {
            const modelId = request.query.get('modelId');
            const data = await getThroughputPerDollarMetrics(modelId);
            return {
                status: 200,
                headers: DEFAULT_HEADERS,
                jsonBody: data
            };
        } catch (err) {
            context.error('Error fetching throughput per dollar metrics:', err);
            return {
                status: 500,
                headers: DEFAULT_HEADERS,
                jsonBody: { error: err.message }
            };
        }
    }
});
