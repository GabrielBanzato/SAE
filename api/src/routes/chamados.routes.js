const chamadosController = require('../controllers/chamados.controller');

module.exports = async function chamadosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', chamadosController.list);
  fastify.post('/', chamadosController.create);
};
