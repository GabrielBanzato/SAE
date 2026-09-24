const precificacaoController = require('../controllers/precificacao.controller');

module.exports = async function precificacaoRoutes(fastify) {
  // Calculo puro (nao toca o banco), mas exige tenant como as demais rotas de negocio.
  fastify.post('/simular', { preHandler: fastify.requirePermission('VER_PRODUTOS') }, precificacaoController.simular);
};
