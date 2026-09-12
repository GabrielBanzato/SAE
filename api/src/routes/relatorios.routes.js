const relatoriosController = require('../controllers/relatorios.controller');

module.exports = async function relatoriosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/resumo', relatoriosController.resumo);
  fastify.get('/dre', relatoriosController.dre);
};
