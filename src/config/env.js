const path = require('path');
const dotenv = require('dotenv');

// Load settings from the project's .env file.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Use the default value if a setting is missing or empty.
function get(key, fallback = undefined) {
    const value = process.env[key];
    if (value === undefined || value === '') {
        return fallback;
    }
    return value;
}

const config = {
    nodeEnv: get('NODE_ENV', 'development'),
    huggingFace: {
        token: get('HF_TOKEN'),
        baseUrl: get('HF_BASE_URL', 'https://router.huggingface.co'),
    },
    db: {
        server: get('DB_SERVER'),
        database: get('DB_NAME'),
        user: get('DB_USER'),
        password: get('DB_PASSWORD'),
        port: parseInt(get('DB_PORT', '1433'), 10),
    },
};

// Report any missing required settings.
function assertRequired(requiredKeys) {
    const missing = requiredKeys.filter((key) => {
        const value = process.env[key];
        return value === undefined || value === '';
    });

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variable(s): ${missing.join(', ')}. `
        );
    }
}

module.exports = { config, assertRequired };
