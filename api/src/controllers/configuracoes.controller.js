const configuracoesService = require('../services/configuracoes.service');
const { DESCONTO_APOIADOR_PERCENTUAL, valorMinimoCobranca } = require('../services/assinaturas/precos');

/**
 * GET /configuracoes/precos - liberado pra qualquer usuario autenticado
 * (Modulos.jsx de toda empresa le isto). Desde os pagamentos reais
 * (2026-09-24) tambem devolve o % de desconto de Apoiador e o valor minimo
 * por cobranca - o frontend EXIBE com a mesma regra que o backend COBRA
 * (services/assinaturas/precos.js), sem duplicar o numero la.
 */
async function obterPrecos(request, reply) {
  const precos = await configuracoesService.obterPrecos(request.server.prisma);
  return reply.send({
    ...precos,
    descontoApoiadorPercentual: DESCONTO_APOIADOR_PERCENTUAL,
    valorMinimoCobranca: valorMinimoCobranca(),
  });
}

module.exports = { obterPrecos };
