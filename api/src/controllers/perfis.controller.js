const perfisService = require('../services/perfis.service');
const { CATALOGO_PERMISSOES } = require('../services/permissoes');

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

/** GET /perfis/catalogo - grupos + permissoes disponiveis (monta os checkboxes da tela). */
async function catalogo(request, reply) {
  return reply.send(CATALOGO_PERMISSOES);
}

async function listar(request, reply) {
  return reply.send(await perfisService.listar(request.server.prisma, request.tenantId));
}

async function criar(request, reply) {
  const { nome, permissoes } = request.body || {};
  const perfil = await perfisService.criar(request.server.prisma, request.tenantId, { nome, permissoes });
  return reply.code(201).send(perfil);
}

async function atualizar(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;
  const { nome, permissoes } = request.body || {};
  return reply.send(await perfisService.atualizar(request.server.prisma, request.tenantId, id, { nome, permissoes }));
}

async function remover(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;
  await perfisService.remover(request.server.prisma, request.tenantId, id);
  return reply.code(204).send();
}

module.exports = { catalogo, listar, criar, atualizar, remover };
