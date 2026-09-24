const relatoriosController = require('../controllers/relatorios.controller');

module.exports = async function relatoriosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/resumo', { preHandler: fastify.requirePermission('VER_RELATORIOS') }, relatoriosController.resumo);
  fastify.get('/dre', { preHandler: fastify.requirePermission('VER_RELATORIOS') }, relatoriosController.dre);
  // RBAC: DRE mensal/fluxo de caixa sao a pagina DRE (menu Financeiro).
  fastify.get('/dre-mensal/:mes_ano', { preHandler: fastify.requirePermission('VER_FINANCEIRO', 'VER_RELATORIOS') }, relatoriosController.dreMensal);
  fastify.get('/fluxo-caixa/:mes_ano', { preHandler: fastify.requirePermission('VER_FINANCEIRO', 'VER_RELATORIOS') }, relatoriosController.fluxoCaixa);
};
