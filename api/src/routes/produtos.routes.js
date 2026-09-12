const produtosController = require('../controllers/produtos.controller');

module.exports = async function produtosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global, exige JWT valido.
  fastify.get('/', produtosController.list);
  fastify.post('/', produtosController.create);
  fastify.post('/calcular-preco', produtosController.calcularPreco);
  fastify.put('/:id', produtosController.update);
  fastify.patch('/:id/estoque', produtosController.atualizarEstoque);
  fastify.delete('/:id', produtosController.remove);
};
