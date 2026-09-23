const configuracoesService = require('../services/configuracoes.service');

/** GET /configuracoes/precos - liberado pra qualquer usuario autenticado (Modulos.jsx de toda empresa le isto). */
async function obterPrecos(request, reply) {
  const precos = await configuracoesService.obterPrecos(request.server.prisma);
  return reply.send(precos);
}

module.exports = { obterPrecos };
