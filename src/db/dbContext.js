const sql = require('mssql');
const { config } = require('../config/env');

let pool = null;

function getDbConfig() {
    if (config.db.connectionString) {
        return config.db.connectionString;
    }
}

async function getPool() {
    if (pool && pool.connected) {
        return pool;
    }

    const dbConfig = getDbConfig();
    pool = await sql.connect(dbConfig);
    return pool;
}

async function closePool() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}

module.exports = {
    sql,
    getPool,
    closePool,
};
