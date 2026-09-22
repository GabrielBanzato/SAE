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

/** "MM-AAAA" -> `{ ano, mesNumero }`, ou `null` se invalido - mesma convencao de agenda.controller.js/lancamentos.controller.js. */
function parseMesAno(mesAno) {
  const match = /^(\d{2})-(\d{4})$/.exec(mesAno || '');
  if (!match) return null;

  const mesNumero = Number(match[1]);
  const ano = Number(match[2]);
  if (mesNumero < 1 || mesNumero > 12) return null;

  return { ano, mesNumero };
}

/** GET /relatorios/dre-mensal/:mes_ano - DRE em escadinha pro mes escolhido (nao so o atual). Mesmo gate de plano de `dre` acima. */
async function dreMensal(request, reply) {
  const parsed = parseMesAno(request.params.mes_ano);
  if (!parsed) {
    return reply.code(400).send({ error: 'mes_ano deve estar no formato MM-AAAA (ex.: 09-2026).' });
  }

  const dados = await relatoriosService.gerarDRE(request.server.prisma, request.tenantId, parsed.ano, parsed.mesNumero);
  return reply.send(dados);
}

/** GET /relatorios/fluxo-caixa/:mes_ano - saldo atual + a receber/a pagar pendente do mes. Disponivel pra qualquer plano. */
async function fluxoCaixa(request, reply) {
  const parsed = parseMesAno(request.params.mes_ano);
  if (!parsed) {
    return reply.code(400).send({ error: 'mes_ano deve estar no formato MM-AAAA (ex.: 09-2026).' });
  }

  const dados = await relatoriosService.obterFluxoCaixa(
    request.server.prisma,
    request.tenantId,
    parsed.ano,
    parsed.mesNumero
  );
  return reply.send(dados);
}

module.exports = { resumo, dre, dreMensal, fluxoCaixa };
