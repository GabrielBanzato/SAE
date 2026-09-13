import 'dotenv/config'; // Essencial para carregar o .env
require('dotenv').config();

const buildApp = require('./app');

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

async function shutdown() {
  await app.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
