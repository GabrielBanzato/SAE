const whatsappService = require('../services/whatsapp.service');

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

/** POST /whatsapp/webhook/:empresaId - publico (ver routes), chamado a cada mensagem recebida via WhatsApp. */
async function webhook(request, reply) {
  const empresaId = Number(request.params.empresaId);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return reply.code(400).send({ error: 'empresaId deve ser um numero inteiro positivo.' });
  }

  const { from, text } = request.body || {};
  const resultado = await whatsappService.processarMensagemRecebida(request.server.prisma, empresaId, { from, text });
  return reply.send(resultado);
}

async function listarAtendimentosAbertos(request, reply) {
  const atendimentos = await whatsappService.listarAtendimentosAbertos(request.server.prisma, request.tenantId);
  return reply.send(atendimentos);
}

async function listarMensagens(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const mensagens = await whatsappService.listarMensagens(request.server.prisma, request.tenantId, id);
  return reply.send(mensagens);
}

async function enviarMensagemManual(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { texto } = request.body || {};
  if (!texto) {
    return reply.code(400).send({ error: 'texto e obrigatorio.' });
  }

  const mensagem = await whatsappService.enviarMensagemManual(request.server.prisma, request.tenantId, id, texto);
  return reply.code(201).send(mensagem);
}

async function alternarIaAtiva(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { ia_ativa: iaAtiva } = request.body || {};
  if (typeof iaAtiva !== 'boolean') {
    return reply.code(400).send({ error: 'ia_ativa deve ser um booleano.' });
  }

  const atendimento = await whatsappService.alternarIaAtiva(request.server.prisma, request.tenantId, id, iaAtiva);
  return reply.send(atendimento);
}

module.exports = { webhook, listarAtendimentosAbertos, listarMensagens, enviarMensagemManual, alternarIaAtiva };
