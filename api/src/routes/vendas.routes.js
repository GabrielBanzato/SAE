const vendasController = require('../controllers/vendas.controller');

module.exports = async function vendasRoutes(fastify) {
  // RBAC: modulo inteiro exige VER_VENDAS.
  fastify.addHook('preHandler', fastify.requirePermission('VER_VENDAS'));
  fastify.get('/', vendasController.list);
  fastify.get('/:id', vendasController.getById);
  fastify.post('/', vendasController.create);
};
