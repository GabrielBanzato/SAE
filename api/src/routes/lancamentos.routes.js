const lancamentosController = require('../controllers/lancamentos.controller');

module.exports = async function lancamentosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', { preHandler: fastify.requirePermission('VER_FINANCEIRO') }, lancamentosController.list);
  fastify.get('/:id', { preHandler: fastify.requirePermission('VER_FINANCEIRO') }, lancamentosController.getById);
  fastify.post('/', { preHandler: fastify.requirePermission('VER_FINANCEIRO') }, lancamentosController.create);
  // RBAC: a Agenda marca conta como paga direto no calendario (PUT aqui).
  fastify.put('/:id', { preHandler: fastify.requirePermission('VER_FINANCEIRO', 'VER_AGENDA') }, lancamentosController.update);
  fastify.delete('/:id', { preHandler: fastify.requirePermission('VER_FINANCEIRO') }, lancamentosController.remove);
};
