const relatoriosService = require('../services/relatorios.service');

/** GET /relatorios/resumo - vendas e pedidos do mes atual. Disponivel pra qualquer plano. */
async function resumo(request, reply) {
  const dados = await relatoriosService.obterResumo(request.server.prisma, request.tenantId);
  return reply.send(dados);
}

/**
 * GET /relatorios/dre - Demonstrativo do Resultado do Exercicio do mes
 * atual. Exclusivo do plano 'apoiador' - o gate (403 se 'gratuito') mora
 * em relatoriosService.obterDre, propagado aqui pelo setErrorHandler
 * global (ver api/src/app.js) como qualquer outro AppError da API.
 */
async function dre(request, reply) {
  const dados = await relatoriosService.obterDre(request.server.prisma, request.tenantId);
  return reply.send(dados);
}

module.exports = { resumo, dre };
