const lancamentosController = require('../controllers/lancamentos.controller');

module.exports = async function lancamentosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', lancamentosController.list);
  fastify.get('/:id', lancamentosController.getById);
  fastify.post('/', lancamentosController.create);
  fastify.put('/:id', lancamentosController.update);
  fastify.delete('/:id', lancamentosController.remove);
};
