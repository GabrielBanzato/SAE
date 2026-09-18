const AppError = require('../utils/AppError');

function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

const FORMAS_PAGAMENTO_VALIDAS = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'pendente',
  'consumo_interno',
  'doacao',
];

// So aparecem no select do PDV (e so sao aceitas pelo backend) pra empresas
// do segmento "alimenticio" - ver Empresa.segmento.
const FORMAS_EXCLUSIVAS_ALIMENTICIO = ['consumo_interno', 'doacao'];

// Essas formas representam dinheiro de verdade entrando no caixa no ato da
// venda - as demais ('pendente', que ainda vai ser recebido, e
// 'consumo_interno'/'doacao', que nunca viram dinheiro) nao.
const FORMAS_PAGAS_NO_ATO = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'];

// Sempre inclui itens (com o nome do produto), cliente, vendedor e o
// funcionario do consumo interno (quando houver) - e o formato que tanto o
// Historico de Vendas quanto o modal de Detalhes precisam.
const INCLUDE_VENDA_COMPLETA = {
  itens: { include: { produto: { select: { id: true, nome: true } } } },
  cliente: { select: { id: true, nome: true } },
  usuario: { select: { id: true, nome: true } },
  funcionario: { select: { id: true, nome: true } },
};

/**
 * Registra uma venda com 1+ itens de forma atomica: valida e da baixa no
 * estoque de cada produto do carrinho, cria o cabecalho da Venda + os
 * VendaItem (ver schema.prisma - "1 produto por venda" foi a decisao
 * original, evoluida nesta tarefa pra suportar carrinho com varios
 * produtos, exigido pelo Historico de Vendas) e, quando a forma de
 * pagamento representa dinheiro de verdade (a vista) ou uma pendencia real
 * a receber, o Lancamento correspondente no caixa - tudo dentro de uma
 * unica transacao, pra nunca deixar o estoque/caixa dessincronizados do
 * historico de vendas caso algo falhe no meio do processo.
 *
 * `precoUnitario`/`subtotal`/`total` sao sempre calculados a partir do
 * `produto.precoVenda` atual no banco, nunca aceitos do cliente - do
 * contrario um request forjado poderia registrar uma venda por um preco
 * arbitrario.
 */
async function registrarVenda(
  fastify,
  { tenantId, usuarioId, itens, clienteId, funcionarioId, formaPagamento, data }
) {
  const { prisma } = fastify;

  if (!Array.isArray(itens) || itens.length === 0) {
    throw new AppError('itens deve ser um array com pelo menos 1 produto.', 400);
  }

  const forma = formaPagamento || 'dinheiro';
  if (!FORMAS_PAGAMENTO_VALIDAS.includes(forma)) {
    throw new AppError(`forma_pagamento deve ser um dos seguintes: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')}.`, 422);
  }

  return prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.findUnique({ where: { id: tenantId }, select: { segmento: true } });
    if (!empresa) {
      throw new AppError('Empresa nao encontrada.', 404);
    }

    // Regra de negocio 2 (pedido explicito): "Consumo Interno"/"Doacao" so
    // existem pra empresas do segmento alimenticio - validado aqui no
    // backend, nao so escondendo a opcao no frontend (um request forjado
    // pra uma empresa de outro segmento nao pode contornar a regra so
    // omitindo essas opcoes na UI).
    if (FORMAS_EXCLUSIVAS_ALIMENTICIO.includes(forma) && empresa.segmento !== 'alimenticio') {
      throw new AppError(`forma_pagamento '${forma}' so e permitida para empresas do segmento alimenticio.`, 403);
    }

    // Regra de negocio 2: "Consumo Interno" exige um funcionario (da
    // propria equipe desta empresa) que consumiu o produto.
    let funcionario = null;
    if (forma === 'consumo_interno') {
      if (!funcionarioId) {
        throw new AppError("funcionario_id e obrigatorio quando forma_pagamento e 'consumo_interno'.", 400);
      }
      funcionario = await tx.usuario.findFirst({ where: { id: funcionarioId, empresaId: tenantId } });
      if (!funcionario) {
        throw new AppError('Funcionario nao encontrado.', 404);
      }
    }

    // clienteId e opcional - so valida que, SE informado, pertence a esta
    // empresa (nunca confia num id de outro tenant vindo do body). O
    // registro e mantido (nao so um boolean) porque o nome do cliente
    // entra na descricao do Lancamento criado logo abaixo.
    let cliente = null;
    if (clienteId) {
      cliente = await tx.cliente.findFirst({ where: { id: clienteId, empresaId: tenantId } });
      if (!cliente) {
        throw new AppError('Cliente nao encontrado.', 404);
      }
    }

    let total = 0;
    const itensValidados = [];

    for (const item of itens) {
      const produtoId = item.produto_id;
      const quantidade = item.quantidade;

      if (!produtoId || !Number.isInteger(quantidade) || quantidade <= 0) {
        throw new AppError('Cada item precisa de produto_id e quantidade (inteiro > 0).', 400);
      }

      // SELECT ... FOR UPDATE: trava a linha do produto ate o fim da
      // transacao, evitando que duas vendas concorrentes vendam o mesmo
      // estoque duas vezes (race condition classica de overselling) -
      // mesma tecnica da versao anterior desta funcao, repetida por item
      // agora que uma venda pode ter varios.
      await tx.$queryRaw`SELECT id FROM produtos WHERE id = ${produtoId} AND empresa_id = ${tenantId} FOR UPDATE`;

      const produto = await tx.produto.findFirst({ where: { id: produtoId, empresaId: tenantId } });
      if (!produto) {
        throw new AppError(`Produto ${produtoId} nao encontrado.`, 404);
      }

      // Produto "sob demanda" (feito na hora, sem controle de estoque
      // tradicional) nunca bloqueia por falta de estoque nem tem seu
      // estoque debitado.
      if (!produto.sobDemanda && produto.estoqueAtual < quantidade) {
        throw new AppError(
          `Estoque insuficiente para "${produto.nome}". Disponivel: ${produto.estoqueAtual}, solicitado: ${quantidade}.`,
          422
        );
      }

      const precoUnitario = produto.precoVenda.toNumber();
      const subtotal = arredondar(precoUnitario * quantidade);
      total = arredondar(total + subtotal);

      itensValidados.push({ produto, quantidade, precoUnitario, subtotal });
    }

    // Data da venda: o PDV manda a data escolhida no date picker (pode ser
    // retroativa) - so cai no "agora" se, por algum motivo, nao vier nada.
    const dataVenda = data ? new Date(data) : new Date();
    const pagoNoAto = FORMAS_PAGAS_NO_ATO.includes(forma);

    const venda = await tx.venda.create({
      data: {
        empresaId: tenantId,
        usuarioId,
        clienteId: clienteId || null,
        funcionarioId: funcionario ? funcionario.id : null,
        formaPagamento: forma,
        total,
        data: dataVenda,
        dataPagamento: pagoNoAto ? dataVenda : null,
        itens: {
          create: itensValidados.map(({ produto, quantidade, precoUnitario, subtotal }) => ({
            produtoId: produto.id,
            quantidade,
            precoUnitario,
            subtotal,
          })),
        },
      },
      include: INCLUDE_VENDA_COMPLETA,
    });

    // Entrada automatica no caixa - so quando a forma de pagamento
    // representa dinheiro que ja entrou (a vista) ou vai entrar de verdade
    // ('pendente', vira uma conta a receber igual as de Lancamentos).
    // "Consumo Interno"/"Doacao" NUNCA geram Lancamento: o produto saiu do
    // estoque, mas nenhum dinheiro entrou nem vai entrar no caixa por essa
    // saida - registrar um Lancamento ali inflaria o faturamento
    // artificialmente.
    let lancamento = null;
    if (forma !== 'consumo_interno' && forma !== 'doacao') {
      lancamento = await tx.lancamento.create({
        data: {
          empresaId: tenantId,
          descricao: cliente ? `Venda via PDV - Cliente: ${cliente.nome}` : 'Venda via PDV',
          valor: total,
          tipo: 'ENTRADA',
          status: pagoNoAto ? 'PAGO' : 'PENDENTE',
          dataVencimento: dataVenda,
          dataPagamento: pagoNoAto ? dataVenda : null,
        },
      });
    }

    const alertasEstoqueBaixo = [];

    for (const { produto, quantidade } of itensValidados) {
      if (produto.sobDemanda) continue;

      const novoEstoque = produto.estoqueAtual - quantidade;
      await tx.produto.update({ where: { id: produto.id }, data: { estoqueAtual: novoEstoque } });

      if (novoEstoque < produto.estoqueMinimo) {
        alertasEstoqueBaixo.push({
          produtoId: produto.id,
          produtoNome: produto.nome,
          estoqueAtual: novoEstoque,
          estoqueMinimo: produto.estoqueMinimo,
        });
        // TODO: futuramente substituir por notificacao real (e-mail/push/webhook).
        fastify.log.warn(
          { tenantId, produtoId: produto.id, produtoNome: produto.nome, estoqueAtual: novoEstoque },
          `Alerta de estoque baixo: "${produto.nome}" ficou com ${novoEstoque} unidade(s), abaixo do minimo de ${produto.estoqueMinimo}.`
        );
      }
    }

    return { venda, lancamento, alertasEstoqueBaixo };
  });
}

/** Historico de vendas (mais recentes primeiro) - usado pela tela nova de Historico de Vendas. */
async function listar(prisma, tenantId) {
  return prisma.venda.findMany({
    where: { empresaId: tenantId },
    orderBy: { data: 'desc' },
    include: INCLUDE_VENDA_COMPLETA,
  });
}

/** Uma venda especifica com todos os itens - usado pelo modal de Detalhes. */
async function buscarPorId(prisma, tenantId, id) {
  const venda = await prisma.venda.findFirst({
    where: { id, empresaId: tenantId },
    include: INCLUDE_VENDA_COMPLETA,
  });

  if (!venda) {
    throw new AppError('Venda nao encontrada.', 404);
  }

  return venda;
}

module.exports = {
  registrarVenda,
  listar,
  buscarPorId,
  FORMAS_PAGAMENTO_VALIDAS,
  FORMAS_EXCLUSIVAS_ALIMENTICIO,
};
