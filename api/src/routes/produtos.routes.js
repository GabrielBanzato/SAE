const produtosController = require('../controllers/produtos.controller');

module.exports = async function produtosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global, exige JWT valido.
  // RBAC: listar produtos tambem serve as telas de Vendas/PDV e Estoque.
  fastify.get('/', { preHandler: fastify.requirePermission('VER_PRODUTOS', 'VER_VENDAS', 'VER_ESTOQUE') }, produtosController.list);
  fastify.post('/', { preHandler: fastify.requirePermission('VER_PRODUTOS') }, produtosController.create);
  fastify.post('/calcular-preco', { preHandler: fastify.requirePermission('VER_PRODUTOS') }, produtosController.calcularPreco);
  fastify.put('/:id', { preHandler: fastify.requirePermission('VER_PRODUTOS') }, produtosController.update);
  fastify.patch('/:id/estoque', { preHandler: fastify.requirePermission('VER_ESTOQUE', 'VER_PRODUTOS') }, produtosController.atualizarEstoque);
  fastify.delete('/:id', { preHandler: fastify.requirePermission('VER_PRODUTOS') }, produtosController.remove);
};
