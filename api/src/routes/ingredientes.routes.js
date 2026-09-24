const ingredientesController = require('../controllers/ingredientes.controller');

module.exports = async function ingredientesRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  // RBAC: listar ingredientes tambem serve a Ficha Tecnica do cadastro de produto.
  fastify.get('/', { preHandler: fastify.requirePermission('VER_ESTOQUE', 'VER_PRODUTOS') }, ingredientesController.list);
  fastify.post('/', { preHandler: fastify.requirePermission('VER_ESTOQUE') }, ingredientesController.create);
  fastify.put('/:id', { preHandler: fastify.requirePermission('VER_ESTOQUE') }, ingredientesController.update);
  fastify.delete('/:id', { preHandler: fastify.requirePermission('VER_ESTOQUE') }, ingredientesController.remove);
};
