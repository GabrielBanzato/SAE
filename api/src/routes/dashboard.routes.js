const dashboardController = require('../controllers/dashboard.controller');

module.exports = async function dashboardRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', { preHandler: fastify.requirePermission('VER_DASHBOARD') }, dashboardController.resumo);
};
