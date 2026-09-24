const clientesController = require('../controllers/clientes.controller');

module.exports = async function clientesRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  // RBAC: listar/cadastro rapido tambem servem a tela de Vendas (atrelar cliente a venda).
  fastify.get('/', { preHandler: fastify.requirePermission('VER_CLIENTES', 'VER_VENDAS') }, clientesController.list);
  fastify.post('/', { preHandler: fastify.requirePermission('VER_CLIENTES', 'VER_VENDAS') }, clientesController.create);
  fastify.put('/:id', { preHandler: fastify.requirePermission('VER_CLIENTES') }, clientesController.atualizar);
  fastify.get('/:id/perfil-360', { preHandler: fastify.requirePermission('VER_CLIENTES') }, clientesController.obterPerfil360);
};
