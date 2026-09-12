const AppError = require('../utils/AppError');

/**
 * Camada de dados de lancamentos (receitas/despesas avulsas). Mesmo padrao
 * das outras services: `tenantId` explicito em todo `where`, `updateMany`/
 * `deleteMany` com `id` + `empresaId` no WHERE para isolamento de tenant
 * atomico (nunca `update`/`delete` com so `id`) - ver produtos.service.js.
 */

async function list(prisma, tenantId) {
  return prisma.lancamento.findMany({
    where: { empresaId: tenantId },
    orderBy: { dataVencimento: 'asc' },
  });
}

async function findById(prisma, tenantId, id) {
  return prisma.lancamento.findFirst({ where: { id, empresaId: tenantId } });
}

async function create(prisma, tenantId, dados) {
  const {
    descricao,
    valor,
    tipo,
    data_vencimento: dataVencimento,
    data_pagamento: dataPagamento,
    status = 'PENDENTE',
  } = dados;

  return prisma.lancamento.create({
    data: {
      empresaId: tenantId, // sempre do token, nunca do body
      descricao,
      valor,
      tipo,
      dataVencimento: new Date(dataVencimento),
      dataPagamento: dataPagamento ? new Date(dataPagamento) : null,
      status,
    },
  });
}

/**
 * Atualizacao parcial - so aplica os campos presentes no body, igual
 * produtos.service.js#update.
 */
async function update(prisma, tenantId, id, dados) {
  const {
    descricao,
    valor,
    tipo,
    data_vencimento: dataVencimento,
    data_pagamento: dataPagamento,
    status,
  } = dados;

  const data = {};
  if (descricao !== undefined) data.descricao = descricao;
  if (valor !== undefined) data.valor = valor;
  if (tipo !== undefined) data.tipo = tipo;
  if (dataVencimento !== undefined) data.dataVencimento = new Date(dataVencimento);
  if (dataPagamento !== undefined) data.dataPagamento = dataPagamento ? new Date(dataPagamento) : null;
  if (status !== undefined) data.status = status;

  const resultado = await prisma.lancamento.updateMany({
    where: { id, empresaId: tenantId },
    data,
  });

  if (resultado.count === 0) {
    throw new AppError('Lancamento nao encontrado.', 404);
  }

  return findById(prisma, tenantId, id);
}

async function remove(prisma, tenantId, id) {
  const resultado = await prisma.lancamento.deleteMany({ where: { id, empresaId: tenantId } });

  if (resultado.count === 0) {
    throw new AppError('Lancamento nao encontrado.', 404);
  }
}

module.exports = { list, findById, create, update, remove };
