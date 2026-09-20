const axios = require('axios');
const { config } = require('../config/env');

class HuggingFaceClient {
    constructor(customConfig = {}) {
        const token = customConfig.token || config.huggingFace.token;
        const baseURL = customConfig.baseUrl || config.huggingFace.baseUrl || 'https://router.huggingface.co';
        const headers = {
            Accept: 'application/json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        this.httpClient = axios.create({
            baseURL,
            timeout: 15000,
            headers,
        });
    }

    // Fetch details and inference benchmarks for a specific model
    async fetchModelData(modelId, maxRetries = 3) {
        if (!modelId) {
            throw new Error('fetchModelData requires a modelId.');
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.httpClient.get(`/v1/models/${modelId}`);
                return response.data;
            } catch (error) {
                const status = error.response?.status;
                const isRetryable = status === 429 || (status >= 500 && status < 600) || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

                if (attempt >= maxRetries || !isRetryable) {
                    throw error;
                }

                const delay = attempt * 1000;
                console.warn(`Retry ${attempt}/${maxRetries} for ${modelId} in ${delay}ms (${status || error.code})...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    // Fetch list of all models and provider benchmarks from the router API
    async fetchModels(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.httpClient.get('/v1/models');
                return response.data;
            } catch (error) {
                const status = error.response?.status;
                const isRetryable = status === 429 || (status >= 500 && status < 600) || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

                if (attempt >= maxRetries || !isRetryable) {
                    throw error;
                }

                const delay = attempt * 1000;
                console.warn(`Retry ${attempt}/${maxRetries} for /v1/models in ${delay}ms (${status || error.code})...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
}

module.exports = {
    HuggingFaceClient,
};
