const fp = require('fastify-plugin');
const { PrismaClient } = require('@prisma/client');

/**
 * Decora a instancia do Fastify com `fastify.prisma`.
 * Usa fastify-plugin para que a decoracao fique visivel em todo o app,
 * nao apenas no escopo encapsulado deste plugin.
 */
module.exports = fp(async function prismaPlugin(fastify) {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    fastify.log.info('Conexao com o MySQL (Prisma) estabelecida.');
  } catch (err) {
    fastify.log.error({ err }, 'Falha ao conectar no MySQL via Prisma.');
    throw err;
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
});
