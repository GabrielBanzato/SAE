const vendasController = require('../controllers/vendas.controller');

module.exports = async function vendasRoutes(fastify) {
  fastify.post('/', vendasController.create);
};
