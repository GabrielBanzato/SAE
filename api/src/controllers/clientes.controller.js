const clientesService = require('../services/clientes.service');

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

async function list(request, reply) {
  const clientes = await clientesService.list(request.server.prisma, request.tenantId);
  return reply.send(clientes);
}

async function create(request, reply) {
  const { nome } = request.body || {};

  if (!nome) {
    return reply.code(400).send({ error: 'nome e obrigatorio.' });
  }

  const cliente = await clientesService.create(request.server.prisma, request.tenantId, request.body);
  return reply.code(201).send(cliente);
}

const CAMPOS_ATUALIZAVEIS = ['nome', 'telefone', 'email', 'status_crm'];

async function atualizar(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const body = request.body || {};
  const temCampoValido = CAMPOS_ATUALIZAVEIS.some((campo) => body[campo] !== undefined);
  if (!temCampoValido) {
    return reply
      .code(400)
      .send({ error: `Informe ao menos um campo para atualizar: ${CAMPOS_ATUALIZAVEIS.join(', ')}.` });
  }

  const cliente = await clientesService.update(request.server.prisma, request.tenantId, id, body);
  return reply.send(cliente);
}

/** GET /clientes/:id/perfil-360 - dados cadastrais + LTV/ticket medio/ultima compra/historico de vendas. */
async function obterPerfil360(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const perfil = await clientesService.obterPerfil360(request.server.prisma, request.tenantId, id);
  return reply.send(perfil);
}

module.exports = { list, create, atualizar, obterPerfil360 };
