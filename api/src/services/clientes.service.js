const AppError = require('../utils/AppError');

/**
 * Camada de dados de clientes + CRM basico (Perfil 360). Mesma convencao
 * das outras services: `tenantId` explicito em todo `where`, nunca confia
 * num id vindo do body.
 */

// Valores aceitos pra `Cliente.statusCrm` (classificacao no funil de
// vendas) - `String` solto no schema (nao enum), mesmo motivo de
// `Empresa.segmento`: a validacao mora aqui, nao no banco, pra poder
// evoluir sem migration.
const STATUS_CRM_VALIDOS = ['Lead', 'Em Negociação', 'Cliente Ativo', 'Inativo'];

function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Classifica uma Venda pro Perfil 360 (mesma logica de 3 vias ja usada em
 * HistoricoVendas.jsx/ModalDetalhesVenda.jsx no frontend, so que calculada
 * aqui no backend pra `historicoVendas` ja vir pronta): 'PAGO' (dinheiro
 * recebido de fato, `dataPagamento` preenchida), 'CONSUMO_DOACAO'
 * (consumo interno/doacao - nunca vira dinheiro, ver vendas.service.js) ou
 * 'PENDENTE' (ainda vai ser recebido).
 */
function classificarStatusVenda(venda) {
  if (venda.dataPagamento) return 'PAGO';
  if (venda.formaPagamento === 'consumo_interno' || venda.formaPagamento === 'doacao') return 'CONSUMO_DOACAO';
  return 'PENDENTE';
}

async function list(prisma, tenantId) {
  return prisma.cliente.findMany({
    where: { empresaId: tenantId },
    orderBy: { nome: 'asc' },
  });
}

async function findById(prisma, tenantId, id) {
  return prisma.cliente.findFirst({ where: { id, empresaId: tenantId } });
}

async function create(prisma, tenantId, dados) {
  const { nome, telefone, email } = dados;

  return prisma.cliente.create({
    data: {
      empresaId: tenantId, // sempre do token, nunca do body
      nome,
      telefone: telefone || null,
      email: email || null,
    },
  });
}

/**
 * Atualizacao parcial - so aplica os campos presentes no body, mesmo
 * padrao de produtos.service.js#update/lancamentos.service.js#update.
 * `status_crm` (se vier) precisa ser um dos `STATUS_CRM_VALIDOS`.
 */
async function update(prisma, tenantId, id, dados) {
  const { nome, telefone, email, status_crm: statusCrm } = dados;

  if (statusCrm !== undefined && !STATUS_CRM_VALIDOS.includes(statusCrm)) {
    throw new AppError(`status_crm deve ser um dos seguintes: ${STATUS_CRM_VALIDOS.join(', ')}.`, 422);
  }

  const data = {};
  if (nome !== undefined) data.nome = nome;
  if (telefone !== undefined) data.telefone = telefone || null;
  if (email !== undefined) data.email = email || null;
  if (statusCrm !== undefined) data.statusCrm = statusCrm;

  const resultado = await prisma.cliente.updateMany({ where: { id, empresaId: tenantId }, data });

  if (resultado.count === 0) {
    throw new AppError('Cliente nao encontrado.', 404);
  }

  return findById(prisma, tenantId, id);
}

/**
 * Perfil 360 do cliente: dados cadastrais + inteligencia de vendas
 * calculada em cima de TODAS as Vendas vinculadas a ele (`Venda.clienteId`).
 *
 * `ltv`/`ticketMedio` so consideram vendas "PAGO" (`dataPagamento`
 * preenchida - dinheiro que de fato entrou no caixa, ver
 * vendas.service.js#registrarVenda) - uma venda 'pendente' ainda nao virou
 * receita de verdade, e 'consumo_interno'/'doacao' nunca vira (mesmo
 * criterio ja usado no DRE, relatorios.service.js). `ultimaCompra` segue o
 * mesmo criterio (a "compra" mais recente = a venda PAGA mais recente, nao
 * qualquer venda registrada) - consistente com LTV, que so soma o que
 * realmente virou receita.
 *
 * `historicoVendas` (ate 10 mais recentes) e mais permissivo de proposito:
 * mostra TODAS as vendas do cliente, pagas ou nao, cada uma com seu
 * `status` classificado (`classificarStatusVenda`) - a equipe de vendas
 * precisa ver pendencias no historico, nao so o que ja foi pago.
 */
async function obterPerfil360(prisma, tenantId, id) {
  const cliente = await findById(prisma, tenantId, id);
  if (!cliente) {
    throw new AppError('Cliente nao encontrado.', 404);
  }

  const vendas = await prisma.venda.findMany({
    where: { clienteId: id, empresaId: tenantId },
    orderBy: { data: 'desc' },
    select: { id: true, data: true, total: true, dataPagamento: true, formaPagamento: true },
  });

  const vendasPagas = vendas.filter((venda) => venda.dataPagamento !== null);
  const ltv = arredondar(vendasPagas.reduce((soma, venda) => soma + venda.total.toNumber(), 0));
  const ticketMedio = vendasPagas.length > 0 ? arredondar(ltv / vendasPagas.length) : 0;
  const ultimaCompra = vendasPagas[0]?.data ?? null;

  const historicoVendas = vendas.slice(0, 10).map((venda) => ({
    id: venda.id,
    data: venda.data,
    total: venda.total.toNumber(),
    status: classificarStatusVenda(venda),
  }));

  return {
    cliente,
    ltv,
    ticketMedio,
    ultimaCompra,
    historicoVendas,
  };
}

module.exports = { list, findById, create, update, obterPerfil360, STATUS_CRM_VALIDOS };
