const { run } = require('../scripts/runLocalIngestion');

async function runIngestion(options = {}, context = null) {
    const log = (msg) => (context ? context.log(msg) : console.log(msg));
    const logError = (msg) => (context ? context.error(msg) : console.error(msg));

    await run(options);
}

module.exports = {
    runIngestion
};