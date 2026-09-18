const vendasController = require('../controllers/vendas.controller');

module.exports = async function vendasRoutes(fastify) {
  fastify.get('/', vendasController.list);
  fastify.get('/:id', vendasController.getById);
  fastify.post('/', vendasController.create);
};
