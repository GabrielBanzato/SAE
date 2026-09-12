const ingredientesController = require('../controllers/ingredientes.controller');

module.exports = async function ingredientesRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', ingredientesController.list);
  fastify.post('/', ingredientesController.create);
  fastify.put('/:id', ingredientesController.update);
  fastify.delete('/:id', ingredientesController.remove);
};
