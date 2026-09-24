const perfisController = require('../controllers/perfis.controller');

/**
 * Perfis de Acesso (RBAC, 2026-09-24) - so o ADMIN da loja gerencia
 * perfis (hook escopado a este plugin). Se um nao-admin pudesse editar
 * perfis, poderia dar a si mesmo qualquer permissao.
 */
module.exports = async function perfisRoutes(fastify) {
  fastify.addHook('preHandler', fastify.requireAdmin());

  fastify.get('/catalogo', perfisController.catalogo);
  fastify.get('/', perfisController.listar);
  fastify.post('/', perfisController.criar);
  fastify.put('/:id', perfisController.atualizar);
  fastify.delete('/:id', perfisController.remover);
};
