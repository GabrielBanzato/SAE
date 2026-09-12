const ingredientesService = require('../services/ingredientes.service');

const UNIDADES_MEDIDA_VALIDAS = ['kg', 'g', 'l', 'ml', 'un'];
const CAMPOS_ATUALIZAVEIS = ['nome', 'unidade_medida', 'custo_unitario', 'estoque_atual'];

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

async function list(request, reply) {
  const ingredientes = await ingredientesService.list(request.server.prisma, request.tenantId);
  return reply.send(ingredientes);
}

async function create(request, reply) {
  const { nome, unidade_medida: unidadeMedida } = request.body || {};

  if (!nome || !unidadeMedida) {
    return reply.code(400).send({ error: 'nome e unidade_medida sao obrigatorios.' });
  }
  if (!UNIDADES_MEDIDA_VALIDAS.includes(unidadeMedida)) {
    return reply
      .code(400)
      .send({ error: `unidade_medida deve ser uma das seguintes: ${UNIDADES_MEDIDA_VALIDAS.join(', ')}.` });
  }

  const ingrediente = await ingredientesService.create(request.server.prisma, request.tenantId, request.body);
  return reply.code(201).send(ingrediente);
}

async function update(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const body = request.body || {};
  const temCampoValido = CAMPOS_ATUALIZAVEIS.some((campo) => body[campo] !== undefined);
  if (!temCampoValido) {
    return reply
      .code(400)
      .send({ error: `Informe ao menos um campo para atualizar: ${CAMPOS_ATUALIZAVEIS.join(', ')}.` });
  }
  if (body.unidade_medida !== undefined && !UNIDADES_MEDIDA_VALIDAS.includes(body.unidade_medida)) {
    return reply
      .code(400)
      .send({ error: `unidade_medida deve ser uma das seguintes: ${UNIDADES_MEDIDA_VALIDAS.join(', ')}.` });
  }

  const ingrediente = await ingredientesService.update(request.server.prisma, request.tenantId, id, body);
  return reply.send(ingrediente);
}

async function remove(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  await ingredientesService.remove(request.server.prisma, request.tenantId, id);
  return reply.code(204).send();
}

module.exports = { list, create, update, remove };
