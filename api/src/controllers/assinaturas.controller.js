const crypto = require('crypto');
const assinaturasService = require('../services/assinaturas.service');

/** POST /assinaturas/checkout - { modulo, plano_ia?, forma: 'PIX'|'CARTAO' } */
async function checkout(request, reply) {
  const { modulo, plano_ia: planoIa, forma } = request.body || {};
  if (!modulo || !forma) {
    return reply.code(400).send({ error: 'modulo e forma sao obrigatorios.' });
  }
  const resultado = await assinaturasService.iniciarCheckout(request.server.prisma, request.tenantId, request.userId, {
    modulo,
    planoIa,
    forma: String(forma).toUpperCase(),
  });
  return reply.code(201).send(resultado);
}

/** GET /assinaturas/:id/status - polling do modal de pagamento. */
async function status(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
  }
  return reply.send(await assinaturasService.obterStatus(request.server.prisma, request.tenantId, id));
}

async function listar(request, reply) {
  return reply.send(await assinaturasService.listar(request.server.prisma, request.tenantId));
}

/** Compara em tempo constante (nao vaza, por tempo de resposta, quantos caracteres do token acertaram). */
function tokenValido(recebido, esperado) {
  if (typeof recebido !== 'string' || !esperado) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * POST /webhooks/asaas - rota PUBLICA (o Asaas nao tem JWT nosso). A
 * autenticacao e o token configurado no painel do Asaas, enviado por ele
 * no header `asaas-access-token` e comparado com ASAAS_WEBHOOK_TOKEN.
 *
 * Fail-closed: sem ASAAS_WEBHOOK_TOKEN configurado no servidor, recusa
 * TUDO (503) - nunca aceita webhook sem autenticacao "por padrao".
 *
 * Codigos de resposta pensados pro comportamento do Asaas (fila pausa
 * depois de 15 falhas seguidas): 200 pra tudo que foi entendido (inclusive
 * evento ignorado/repetido); 401 so pra token errado; 5xx so se o banco
 * falhar de verdade (ai o reenvio do Asaas e o que queremos).
 */
async function webhookAsaas(request, reply) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) {
    request.log.error('Webhook do Asaas recebido, mas ASAAS_WEBHOOK_TOKEN nao esta configurado - recusado.');
    return reply.code(503).send({ error: 'Webhook nao configurado.' });
  }
  if (!tokenValido(request.headers['asaas-access-token'], esperado)) {
    request.log.warn({ ip: request.ip }, 'Webhook do Asaas com token invalido - recusado.');
    return reply.code(401).send({ error: 'Token invalido.' });
  }

  const resultado = await assinaturasService.processarWebhook(request.server.prisma, request.body);
  request.log.info({ evento: request.body?.event, id: request.body?.id, ...resultado }, 'Webhook do Asaas');
  return reply.code(200).send({ recebido: true });
}

module.exports = { checkout, status, listar, webhookAsaas };
