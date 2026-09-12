const { limitesDeHoje, limitesProximosDias } = require('../utils/datas');

/**
 * Camada de dados do Dashboard: combina 3 metricas independentes (vendas
 * de hoje, estoque baixo, contas a pagar proximas do vencimento) numa so
 * chamada - as 3 queries rodam em paralelo (`Promise.all`), ja que nenhuma
 * depende do resultado da outra.
 */
async function obterResumo(prisma, tenantId) {
  const { inicio: inicioHoje, fim: fimHoje } = limitesDeHoje();
  const { inicio: inicioProximos, fim: fimProximos } = limitesProximosDias(7);

  const [vendasHojeAgg, estoqueBaixo, contasPendentes] = await Promise.all([
    // "Lancamentos de ENTRADA com data de hoje" - inclui tanto as entradas
    // automaticas de vendas do PDV (ver vendas.service.js) quanto qualquer
    // entrada manual cadastrada em Lancamentos.jsx com vencimento hoje.
    // Sem filtro de status (PAGO/PENDENTE) - mesma leitura ja usada em
    // ControleFinanceiro.jsx e no DRE (relatorios.service.js): "todo
    // lancamento do periodo", nao so o que ja foi efetivamente pago.
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'ENTRADA', dataVencimento: { gte: inicioHoje, lt: fimHoje } },
      _sum: { valor: true },
      _count: { _all: true },
    }),

    // `estoque_atual <= estoque_minimo` compara 2 colunas da MESMA linha -
    // o filtro fluente do Prisma Client so compara uma coluna contra um
    // valor literal (nao contra outra coluna), entao essa condicao exige
    // query bruta (unico jeito de expressar isso direto no SQL). Mesma
    // convencao de `$queryRaw` ja usada em vendas.service.js (SELECT ...
    // FOR UPDATE).
    //
    // Achado rodando isto pela primeira vez: diferente do Prisma Client
    // normal (que mapeia `INT UNSIGNED` para `number` - decisao registrada
    // na migracao Knex->Prisma, ver secao acima), `$queryRaw` devolve
    // colunas UNSIGNED como `BigInt` cru - `JSON.stringify`/`reply.send`
    // quebra com "Do not know how to serialize a BigInt". Por isso o
    // `.map(Number(...))` logo abaixo, convertendo de volta pra `number`
    // antes de retornar.
    prisma.$queryRaw`
      SELECT id, nome, estoque_atual AS estoqueAtual, estoque_minimo AS estoqueMinimo
      FROM produtos
      WHERE empresa_id = ${tenantId} AND sob_demanda = false AND estoque_atual <= estoque_minimo
      ORDER BY estoque_atual ASC
      LIMIT 5
    `,

    prisma.lancamento.findMany({
      where: {
        empresaId: tenantId,
        tipo: 'SAIDA',
        status: 'PENDENTE',
        dataVencimento: { gte: inicioProximos, lt: fimProximos },
      },
      select: { id: true, descricao: true, valor: true, dataVencimento: true, status: true },
      orderBy: { dataVencimento: 'asc' },
    }),
  ]);

  return {
    vendasHoje: {
      total: vendasHojeAgg._sum.valor ? vendasHojeAgg._sum.valor.toNumber() : 0,
      quantidade: vendasHojeAgg._count._all,
    },
    estoqueBaixo: estoqueBaixo.map((produto) => ({
      id: Number(produto.id),
      nome: produto.nome,
      estoqueAtual: Number(produto.estoqueAtual),
      estoqueMinimo: Number(produto.estoqueMinimo),
    })),
    contasPendentes: contasPendentes.map((lancamento) => ({
      ...lancamento,
      valor: lancamento.valor.toNumber(),
    })),
  };
}

module.exports = { obterResumo };
