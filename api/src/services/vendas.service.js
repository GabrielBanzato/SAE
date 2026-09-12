const AppError = require('../utils/AppError');

function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Registra uma venda de forma atomica: insere a venda, da baixa no estoque
 * do produto e (se aplicavel) dispara o alerta de estoque baixo - tudo
 * dentro de uma unica transacao, para nunca deixar o estoque dessincronizado
 * do historico de vendas caso algo falhe no meio do processo.
 *
 * `preco_unitario`/`total` sao sempre calculados a partir do
 * `produto.precoVenda` atual no banco, nunca aceitos do cliente - do
 * contrario um request forjado poderia registrar uma venda por um preco
 * arbitrario.
 */
async function registrarVenda(fastify, { tenantId, usuarioId, produtoId, quantidade, clienteId }) {
  const { prisma } = fastify;

  return prisma.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE: trava a linha do produto ate o fim da transacao,
    // evitando que duas vendas concorrentes vendam o mesmo estoque duas vezes
    // (race condition classica de overselling). O Prisma Client ainda nao tem
    // uma API nativa para isso, entao usamos query bruta so pelo efeito do
    // lock - o resultado em si e descartado, e lido a seguir de forma
    // tipada (findFirst ja enxerga o lock, por estar na mesma transacao).
    await tx.$queryRaw`SELECT id FROM produtos WHERE id = ${produtoId} AND empresa_id = ${tenantId} FOR UPDATE`;

    const produto = await tx.produto.findFirst({
      where: { id: produtoId, empresaId: tenantId },
    });

    if (!produto) {
      throw new AppError('Produto nao encontrado.', 404);
    }

    // Produto "sob demanda" (feito na hora, sem controle de estoque
    // tradicional - ver Produto.sobDemanda no schema) nunca bloqueia por
    // falta de estoque nem tem seu estoque debitado - ele sempre fica
    // parado em 0, que e o valor forcado pelo frontend na criacao/edicao
    // desse tipo de produto.
    if (!produto.sobDemanda && produto.estoqueAtual < quantidade) {
      throw new AppError(
        `Estoque insuficiente para "${produto.nome}". Disponivel: ${produto.estoqueAtual}, solicitado: ${quantidade}.`,
        422
      );
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

    const precoUnitario = produto.precoVenda.toNumber();
    const total = arredondar(precoUnitario * quantidade);
    const novoEstoque = produto.sobDemanda ? produto.estoqueAtual : produto.estoqueAtual - quantidade;

    const venda = await tx.venda.create({
      data: {
        empresaId: tenantId,
        usuarioId,
        produtoId,
        clienteId: clienteId || null,
        quantidade,
        precoUnitario,
        total,
      },
    });

    // Entrada automatica no caixa: toda venda do PDV ja nasce "paga" (nao
    // ha fluxo de venda a prazo/fiado no sistema ainda), entao o Lancamento
    // correspondente ja sai como ENTRADA/PAGO, com data de vencimento e de
    // pagamento no momento da venda. Fica na MESMA transacao (tx, nao
    // prisma) que a Venda e a baixa de estoque abaixo - se a criacao do
    // Lancamento falhar por qualquer motivo, o `throw` do Prisma sobe e o
    // `$transaction` reverte tudo (venda, baixa de estoque e o proprio
    // lancamento), nunca deixando uma venda registrada sem o dinheiro
    // correspondente entrar no caixa.
    const agora = new Date();
    const lancamento = await tx.lancamento.create({
      data: {
        empresaId: tenantId,
        descricao: cliente ? `Venda via PDV - Cliente: ${cliente.nome}` : 'Venda via PDV',
        valor: total,
        tipo: 'ENTRADA',
        status: 'PAGO',
        dataVencimento: agora,
        dataPagamento: agora,
      },
    });

    if (!produto.sobDemanda) {
      await tx.produto.update({
        where: { id: produtoId },
        data: { estoqueAtual: novoEstoque },
      });
    }

    const estoqueBaixo = !produto.sobDemanda && novoEstoque < produto.estoqueMinimo;

    if (estoqueBaixo) {
      // TODO: futuramente substituir por notificacao real (e-mail/push/webhook).
      fastify.log.warn(
        {
          tenantId,
          produtoId,
          produtoNome: produto.nome,
          estoqueAtual: novoEstoque,
          estoqueMinimo: produto.estoqueMinimo,
        },
        `Alerta de estoque baixo: "${produto.nome}" ficou com ${novoEstoque} unidade(s), abaixo do minimo de ${produto.estoqueMinimo}.`
      );
    }

    return { venda, lancamento, estoqueAtual: novoEstoque, alertaEstoqueBaixo: estoqueBaixo };
  });
}

module.exports = { registrarVenda };
