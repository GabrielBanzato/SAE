const AppError = require('../utils/AppError');

/**
 * Camada de dados do Quadro de Tarefas Kanban (modulo de Produtividade).
 * Mesma convencao das outras services: `tenantId` explicito em todo
 * `where`, nunca confia num id vindo do body.
 *
 * A tabela `Tarefa` e compartilhada com a Agenda (ver schema.prisma e
 * agenda.service.js) - uma tarefa sem `dataVencimento` so nao aparece la,
 * sem precisar de uma tabela separada so pro Kanban.
 */

// Valores aceitos pra `Tarefa.status` - String solto no schema (nao enum),
// mesmo motivo de Cliente.statusCrm: a validacao mora aqui, nao no banco.
const STATUS_VALIDOS = ['A_FAZER', 'EM_ANDAMENTO', 'CONCLUIDO'];

async function findById(prisma, tenantId, id) {
  return prisma.tarefa.findFirst({ where: { id, empresaId: tenantId } });
}

/** Garante que `responsavelId` (se informado) e um Usuario de verdade desta empresa - nunca de outro tenant. */
async function validarResponsavel(prisma, tenantId, responsavelId) {
  if (responsavelId === undefined || responsavelId === null) return;

  const usuario = await prisma.usuario.findFirst({ where: { id: responsavelId, empresaId: tenantId, ativo: true } });
  if (!usuario) {
    throw new AppError('responsavelId nao corresponde a um usuario desta empresa.', 422);
  }
}

/** `?status=`/`?responsavel_id=` (ambos opcionais) - filtros do Quadro Kanban (coluna) e "minhas tarefas". */
async function list(prisma, tenantId, { status, responsavelId } = {}) {
  const where = { empresaId: tenantId };
  if (status !== undefined) where.status = status;
  if (responsavelId !== undefined) where.responsavelId = responsavelId;

  return prisma.tarefa.findMany({
    where,
    orderBy: { criadoEm: 'asc' },
  });
}

async function create(prisma, tenantId, dados) {
  const { titulo, descricao, data_vencimento: dataVencimento, status, responsavelId } = dados;

  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    throw new AppError(`status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.`, 422);
  }
  await validarResponsavel(prisma, tenantId, responsavelId);

  return prisma.tarefa.create({
    data: {
      empresaId: tenantId, // sempre do token, nunca do body
      titulo,
      descricao: descricao || null,
      dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
      status: status || undefined, // undefined -> deixa o @default("A_FAZER") do schema decidir
      responsavelId: responsavelId ?? null,
    },
  });
}

/**
 * Atualizacao parcial - so aplica os campos presentes no body, mesmo
 * padrao de clientes.service.js#update/lancamentos.service.js#update. E o
 * caminho usado tanto pra editar titulo/descricao quanto pra mover um card
 * de coluna no Kanban (so `status` no body).
 */
async function update(prisma, tenantId, id, dados) {
  const { titulo, descricao, data_vencimento: dataVencimento, status, responsavelId } = dados;

  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    throw new AppError(`status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.`, 422);
  }
  await validarResponsavel(prisma, tenantId, responsavelId);

  const data = {};
  if (titulo !== undefined) data.titulo = titulo;
  if (descricao !== undefined) data.descricao = descricao || null;
  if (dataVencimento !== undefined) data.dataVencimento = dataVencimento ? new Date(dataVencimento) : null;
  if (status !== undefined) data.status = status;
  if (responsavelId !== undefined) data.responsavelId = responsavelId;

  const resultado = await prisma.tarefa.updateMany({ where: { id, empresaId: tenantId }, data });

  if (resultado.count === 0) {
    throw new AppError('Tarefa nao encontrada.', 404);
  }

  return findById(prisma, tenantId, id);
}

async function remove(prisma, tenantId, id) {
  const resultado = await prisma.tarefa.deleteMany({ where: { id, empresaId: tenantId } });

  if (resultado.count === 0) {
    throw new AppError('Tarefa nao encontrada.', 404);
  }
}

module.exports = { list, findById, create, update, remove, STATUS_VALIDOS };
