const dashboardService = require('../services/dashboard.service');

/** GET /dashboard - vendas de hoje, estoque baixo e contas a pagar proximas do vencimento, tudo num objeto so. */
async function resumo(request, reply) {
  const dados = await dashboardService.obterResumo(request.server.prisma, request.tenantId);
  return reply.send(dados);
}

module.exports = { resumo };
