const { run } = require('../scripts/runLocalIngestion');

async function runIngestion(options = {}, context = null) {
    return await run(options);
}

module.exports = {
    runIngestion
};