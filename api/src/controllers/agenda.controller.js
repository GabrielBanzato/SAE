const agendaService = require('../services/agenda.service');

/**
 * GET /agenda/:mes_ano (ex.: "09-2026") - lista os eventos daquele mes pra
 * empresa do token, unificando Lancamentos e Tarefas (ver
 * agenda.service.js). Antes retornava dados mockados (10 eventos ficticios
 * gerados na hora) so pra validar o visual da Agenda no frontend - agora
 * consulta o banco de verdade.
 */
async function listarPorMes(request, reply) {
  const { mes_ano: mesAno } = request.params;

  const match = /^(\d{2})-(\d{4})$/.exec(mesAno || '');
  if (!match) {
    return reply.code(400).send({ error: 'mes_ano deve estar no formato MM-AAAA (ex.: 09-2026).' });
  }

  const mesNumero = Number(match[1]);
  const ano = Number(match[2]);

  if (mesNumero < 1 || mesNumero > 12) {
    return reply.code(400).send({ error: 'O mes em mes_ano deve ser entre 01 e 12.' });
  }

  const eventos = await agendaService.listarEventosDoMes(request.server.prisma, request.tenantId, ano, mesNumero);
  return reply.send(eventos);
}

module.exports = { listarPorMes };
