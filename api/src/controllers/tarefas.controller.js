const tarefasService = require('../services/tarefas.service');
const { STATUS_VALIDOS } = tarefasService;

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

/** `?responsavel_id=` -> Number, ou `null` se ausente/invalido (marca "informado mas invalido" pro caller decidir o 400). */
function parseResponsavelId(valor) {
  if (valor === undefined) return { informado: false, valor: undefined };

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    return { informado: true, valor: null };
  }
  return { informado: true, valor: numero };
}

/** `?status=`/`?responsavel_id=` (ambos opcionais) - filtro de coluna do Kanban e "minhas tarefas". */
async function list(request, reply) {
  const { status, responsavel_id: responsavelIdRaw } = request.query || {};

  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    return reply.code(400).send({ error: `status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.` });
  }

  const { informado, valor: responsavelId } = parseResponsavelId(responsavelIdRaw);
  if (informado && responsavelId === null) {
    return reply.code(400).send({ error: 'responsavel_id deve ser um numero inteiro positivo.' });
  }

  const tarefas = await tarefasService.list(request.server.prisma, request.tenantId, { status, responsavelId });
  return reply.send(tarefas);
}

async function create(request, reply) {
  const { titulo } = request.body || {};

  if (!titulo) {
    return reply.code(400).send({ error: 'titulo e obrigatorio.' });
  }

  const tarefa = await tarefasService.create(request.server.prisma, request.tenantId, request.body);
  return reply.code(201).send(tarefa);
}

const CAMPOS_ATUALIZAVEIS = ['titulo', 'descricao', 'data_vencimento', 'status', 'responsavelId'];

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

  const tarefa = await tarefasService.update(request.server.prisma, request.tenantId, id, body);
  return reply.send(tarefa);
}

async function remove(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  await tarefasService.remove(request.server.prisma, request.tenantId, id);
  return reply.code(204).send();
}

module.exports = { list, create, update, remove };
