const AppError = require('../utils/AppError');
const { limitesDoMesCalendario } = require('../utils/datas');

/**
 * Camada de dados de lancamentos (receitas/despesas avulsas). Mesmo padrao
 * das outras services: `tenantId` explicito em todo `where`, `updateMany`/
 * `deleteMany` com `id` + `empresaId` no WHERE para isolamento de tenant
 * atomico (nunca `update`/`delete` com so `id`) - ver produtos.service.js.
 */

// Categoria do lancamento - separa Receitas/Custos Variaveis/Custos
// Fixos/Deducoes pro DRE (ver relatorios.service.js#gerarDRE, que importa
// `BUCKET_DRE_POR_CATEGORIA` daqui pra nao duplicar a lista em 2 lugares).
// Mesmas chaves que ja existiam como heuristica de palavras-chave no
// filtro de Lancamentos.jsx (frontend) antes desta tarefa - mantidas de
// proposito pra continuidade, agora como dado real escolhido no cadastro
// (ModalLancamento.jsx), nao mais adivinhado a partir da `descricao`.
const CATEGORIAS_VALIDAS = ['vendas', 'fornecedores', 'aluguel', 'salarios', 'impostos', 'contas_servicos', 'outros'];

// So relevante pra lancamentos SAIDA - Receita Bruta do DRE soma TODO
// lancamento ENTRADA do mes, independente de categoria (mesmo criterio ja
// usado em relatorios.service.js#obterDre antes desta tarefa). 'deducao' =
// abate da Receita Bruta ANTES da Margem de Contribuicao (impostos sobre
// venda); 'custo_variavel'/'custo_fixo' = as duas linhas seguintes do DRE.
const BUCKET_DRE_POR_CATEGORIA = {
  impostos: 'deducao',
  fornecedores: 'custo_variavel',
  aluguel: 'custo_fixo',
  salarios: 'custo_fixo',
  contas_servicos: 'custo_fixo',
  // Fallback pra categorias sem mapeamento explicito (`vendas` - incomum
  // numa SAIDA - e `outros`): tratadas como custo fixo, o "balde"
  // operacional generico, em vez de sumirem do calculo do DRE.
  vendas: 'custo_fixo',
  outros: 'custo_fixo',
};

/**
 * `filtros.status` ('PENDENTE'|'PAGO') e `filtros.ano`+`filtros.mesNumero`
 * (filtra por `dataVencimento` dentro do mes) sao OPCIONAIS - omitidos,
 * devolve tudo (mesmo comportamento de antes desta tarefa). Lancamentos.jsx/
 * ControleFinanceiro.jsx continuam chamando sem filtro nenhum (buscam tudo
 * e filtram no proprio frontend, decisao ja documentada la) - estes
 * parametros existem pra outros consumidores (ex.: relatorios.service.js)
 * que precisam de uma fatia especifica sem baixar a lista inteira.
 */
async function list(prisma, tenantId, filtros = {}) {
  const { status, ano, mesNumero } = filtros;

  const where = { empresaId: tenantId };
  if (status) where.status = status;
  if (ano && mesNumero) {
    const { inicio, fim } = limitesDoMesCalendario(ano, mesNumero);
    where.dataVencimento = { gte: inicio, lt: fim };
  }

  return prisma.lancamento.findMany({
    where,
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
    categoria,
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
      // `categoria` opcional aqui - se vier `undefined`, o Prisma nao
      // inclui o campo no INSERT e o `@default("outros")` do schema assume
      // sozinho (mesmo padrao de `segmento` em auth.service.js#register).
      categoria,
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
    categoria,
  } = dados;

  const data = {};
  if (descricao !== undefined) data.descricao = descricao;
  if (valor !== undefined) data.valor = valor;
  if (tipo !== undefined) data.tipo = tipo;
  if (dataVencimento !== undefined) data.dataVencimento = new Date(dataVencimento);
  if (dataPagamento !== undefined) data.dataPagamento = dataPagamento ? new Date(dataPagamento) : null;
  if (status !== undefined) data.status = status;
  if (categoria !== undefined) data.categoria = categoria;

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

module.exports = { list, findById, create, update, remove, CATEGORIAS_VALIDAS, BUCKET_DRE_POR_CATEGORIA };
