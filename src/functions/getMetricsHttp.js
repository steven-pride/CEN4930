const { app } = require('@azure/functions');

// Sample mock metrics data for scaffolding
const MOCK_LATENCY = [
    {
        ModelID: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        DisplayName: 'Llama 3.1 8B Instruct',
        ProviderID: 'together',
        ProviderName: 'Together AI',
        TimeBucket: '2026-10-18T12:00:00.000Z',
        AvgLatencyMs: 245.5,
        MinLatencyMs: 210.0,
        MaxLatencyMs: 310.2,
        SampleCount: 12
    },
    {
        ModelID: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        DisplayName: 'Llama 3.1 8B Instruct',
        ProviderID: 'groq',
        ProviderName: 'Groq',
        TimeBucket: '2026-10-18T12:00:00.000Z',
        AvgLatencyMs: 120.4,
        MinLatencyMs: 95.0,
        MaxLatencyMs: 150.0,
        SampleCount: 12
    }
];

const MOCK_THROUGHPUT = [
    {
        ModelID: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        DisplayName: 'Llama 3.1 8B Instruct',
        ProviderID: 'groq',
        ProviderName: 'Groq',
        AvgThroughputTPS: 285.4,
        MinThroughputTPS: 260.0,
        MaxThroughputTPS: 310.0,
        SampleCount: 48
    },
    {
        ModelID: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        DisplayName: 'Llama 3.1 8B Instruct',
        ProviderID: 'together',
        ProviderName: 'Together AI',
        AvgThroughputTPS: 142.1,
        MinThroughputTPS: 130.5,
        MaxThroughputTPS: 155.0,
        SampleCount: 48
    }
];

const MOCK_THROUGHPUT_PER_DOLLAR = [
    {
        ModelID: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        DisplayName: 'Llama 3.1 8B Instruct',
        ProviderID: 'together',
        ProviderName: 'Together AI',
        BlendedCostPerMillion: 0.20,
        ThroughputTPS: 142.1,
        TPSPerDollar: 710.5
    },
    {
        ModelID: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        DisplayName: 'Llama 3.1 8B Instruct',
        ProviderID: 'groq',
        ProviderName: 'Groq',
        BlendedCostPerMillion: 0.08,
        ThroughputTPS: 285.4,
        TPSPerDollar: 3567.5
    }
];

// GET latency metrics
app.http('getLatencyMetricsHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/metrics/latency',
    handler: async (request, context) => {
        const modelId = request.query.get('modelId');
        context.log('Handling GET /api/metrics/latency', { modelId });

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            jsonBody: MOCK_LATENCY
        };
    }
});

// GET throughput metrics
app.http('getThroughputMetricsHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/metrics/throughput',
    handler: async (request, context) => {
        const modelId = request.query.get('modelId');
        context.log('Handling GET /api/metrics/throughput', { modelId });

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            jsonBody: MOCK_THROUGHPUT
        };
    }
});

// GET throughput-per-dollar metrics
app.http('getThroughputPerDollarMetricsHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api/metrics/throughput-per-dollar',
    handler: async (request, context) => {
        context.log('Handling GET /api/metrics/throughput-per-dollar');

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            jsonBody: MOCK_THROUGHPUT_PER_DOLLAR
        };
    }
});
