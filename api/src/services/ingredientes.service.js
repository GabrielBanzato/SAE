const AppError = require('../utils/AppError');

/**
 * Camada de dados de ingredientes (materia-prima de empresas do segmento
 * "varejo_alimentacao" - ver Empresa.segmento). Mesmo padrao de isolamento de tenant
 * do resto do projeto: `tenantId` explicito em todo `where`, `updateMany`/
 * `deleteMany` com `id` + `empresaId` no WHERE (nunca `update`/`delete`
 * so com `id`).
 */

async function list(prisma, tenantId) {
  return prisma.ingrediente.findMany({
    where: { empresaId: tenantId },
    orderBy: { nome: 'asc' },
  });
}

async function findById(prisma, tenantId, id) {
  return prisma.ingrediente.findFirst({ where: { id, empresaId: tenantId } });
}

async function create(prisma, tenantId, dados) {
  const {
    nome,
    unidade_medida: unidadeMedida,
    custo_unitario: custoUnitario = 0,
    estoque_atual: estoqueAtual = 0,
  } = dados;

  return prisma.ingrediente.create({
    data: {
      empresaId: tenantId, // sempre do token, nunca do body
      nome,
      unidadeMedida,
      custoUnitario,
      estoqueAtual,
    },
  });
}

/** Atualizacao parcial - mesmo padrao de produtos.service.js#update. */
async function update(prisma, tenantId, id, dados) {
  const {
    nome,
    unidade_medida: unidadeMedida,
    custo_unitario: custoUnitario,
    estoque_atual: estoqueAtual,
  } = dados;

  const data = {};
  if (nome !== undefined) data.nome = nome;
  if (unidadeMedida !== undefined) data.unidadeMedida = unidadeMedida;
  if (custoUnitario !== undefined) data.custoUnitario = custoUnitario;
  if (estoqueAtual !== undefined) data.estoqueAtual = estoqueAtual;

  const resultado = await prisma.ingrediente.updateMany({
    where: { id, empresaId: tenantId },
    data,
  });

  if (resultado.count === 0) {
    throw new AppError('Ingrediente nao encontrado.', 404);
  }

  return findById(prisma, tenantId, id);
}

/**
 * `FichaTecnica.ingredienteId` tem `onDelete: Restrict` no schema -
 * excluir um ingrediente que ja esta vinculado a receita de algum produto
 * falha no MySQL com violacao de FK (Prisma `P2003`), traduzida aqui pra
 * um erro de negocio legivel, mesmo padrao de produtos.service.js#remove.
 */
async function remove(prisma, tenantId, id) {
  try {
    const resultado = await prisma.ingrediente.deleteMany({ where: { id, empresaId: tenantId } });

    if (resultado.count === 0) {
      throw new AppError('Ingrediente nao encontrado.', 404);
    }
  } catch (err) {
    if (err.code === 'P2003') {
      throw new AppError(
        'Nao e possivel excluir um ingrediente que ja esta vinculado a ficha tecnica de um produto.',
        409
      );
    }
    throw err;
  }
}

module.exports = { list, findById, create, update, remove };
