const chatService = require('../services/chatChamado.service');

function parseInteiroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

/**
 * Handlers do chat de suporte, gerados pra cada ponta (Chat de Suporte,
 * 2026-09-23) - mesma logica, so muda o ESCOPO e o REMETENTE, ambos
 * decididos pela rota (nunca pelo corpo da requisicao):
 *   - lojista (chamados.routes.js):      escopo = tenant do token, remetente LOJISTA
 *   - Supra Admin (superadmin.routes.js): escopo = todos,           remetente ADMIN
 */
function criarHandlersChat({ admin }) {
  const remetente = admin ? 'ADMIN' : 'LOJISTA';
  const escopo = (request) => (admin ? null : request.tenantId);

  /** GET .../chamados/:id?apos=<ultimoIdDeMensagem> */
  async function obter(request, reply) {
    const id = parseInteiroPositivo(request.params.id);
    if (!id) return reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });

    const aposId = request.query?.apos ? parseInteiroPositivo(request.query.apos) : null;
    const chamado = await chatService.obterChamado(request.server.prisma, id, escopo(request), { aposId });
    return reply.send(chamado);
  }

  /** POST .../chamados/:id/mensagens - { tipo: 'TEXTO', conteudo } | { tipo: 'AUDIO', audio_base64, mime } */
  async function enviar(request, reply) {
    const id = parseInteiroPositivo(request.params.id);
    if (!id) return reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });

    const { tipo, conteudo, audio_base64: audioBase64, mime } = request.body || {};
    const mensagem = await chatService.enviarMensagem(request.server.prisma, id, escopo(request), remetente, {
      tipo,
      conteudo,
      audioBase64,
      mime,
    });
    return reply.code(201).send(mensagem);
  }

  /** GET .../chamados/:id/mensagens/:mensagemId/audio - binario do audio (o frontend busca com o token e cria um blob URL). */
  async function audio(request, reply) {
    const id = parseInteiroPositivo(request.params.id);
    const mensagemId = parseInteiroPositivo(request.params.mensagemId);
    if (!id || !mensagemId) return reply.code(400).send({ error: 'ids invalidos.' });

    const { buffer, mime } = await chatService.lerAudio(request.server.prisma, id, mensagemId, escopo(request));
    // Audio de uma mensagem nunca muda depois de gravado - cache privado (so no navegador de quem ouviu).
    return reply.header('Cache-Control', 'private, max-age=86400').type(mime).send(buffer);
  }

  return { obter, enviar, audio };
}

module.exports = { criarHandlersChat, BODY_LIMIT_MENSAGEM: chatService.BODY_LIMIT_MENSAGEM };
