const AppError = require('../utils/AppError');
const { mesAtual, limitesDoMesCalendario, limitesDoMesTimestamp } = require('../utils/datas');
const { BUCKET_DRE_POR_CATEGORIA } = require('./lancamentos.service');

function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Lanca 403 se a empresa nao for do plano 'apoiador' - mesmo gate ja usado por `obterDre` abaixo, reaproveitado por `gerarDRE`. */
async function exigirPlanoApoiador(prisma, tenantId) {
  const empresa = await prisma.empresa.findUnique({ where: { id: tenantId }, select: { plano: true } });

  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }
  if (empresa.plano !== 'apoiador') {
    throw new AppError('Acesso negado - funcionalidade premium disponivel apenas para o plano Apoiador.', 403);
  }
}

/**
 * Resumo simples (plano Gratuito, sem nenhum gate de plano - todo mundo
 * ve isso). `Venda.data` e um timestamp de verdade (hora real da venda),
 * nao um campo "so calendario" - por isso usa `limitesDoMesTimestamp`
 * (fuso local), nao `limitesDoMesCalendario` (UTC) que o resto deste
 * arquivo usa pros Lancamentos - ver a explicacao completa em
 * api/src/utils/datas.js.
 */
async function obterResumo(prisma, tenantId) {
  const { ano, mesNumero } = mesAtual();
  const { inicio, fim } = limitesDoMesTimestamp(ano, mesNumero);

  const resultado = await prisma.venda.aggregate({
    where: { empresaId: tenantId, data: { gte: inicio, lt: fim } },
    _sum: { total: true },
    _count: { _all: true },
  });

  return {
    totalVendasMes: resultado._sum.total ? resultado._sum.total.toNumber() : 0,
    quantidadePedidos: resultado._count._all,
  };
}

/**
 * DRE (Demonstrativo do Resultado do Exercicio) - funcionalidade premium,
 * exclusiva do plano 'apoiador'. O gate mora aqui no service (nao no
 * controller) pra seguir a mesma convencao ja usada em
 * empresa.service.js#adicionarUsuario (regra de negocio ligada a plano
 * fica na camada que fala com o Prisma, nao espalhada pelo controller).
 *
 * Receita Bruta / Custos somam TODO Lancamento do mes (ENTRADA/SAIDA),
 * independente de status (PAGO ou PENDENTE) - mesma decisao ja tomada no
 * grafico "Receitas vs Despesas" de ControleFinanceiro.jsx (o "resultado
 * do exercicio" no sentido amplo, nao so o que ja foi efetivamente pago -
 * o app nao distingue regime de caixa vs competencia em lugar nenhum
 * ainda, entao mantive a mesma leitura ja usada alhures pra nao introduzir
 * um terceiro criterio de agregacao no sistema).
 */
async function obterDre(prisma, tenantId) {
  await exigirPlanoApoiador(prisma, tenantId);

  const { ano, mesNumero } = mesAtual();
  const { inicio: inicioCalendario, fim: fimCalendario } = limitesDoMesCalendario(ano, mesNumero);
  const { inicio: inicioTimestamp, fim: fimTimestamp } = limitesDoMesTimestamp(ano, mesNumero);

  const [entradas, saidas, vendas] = await Promise.all([
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'ENTRADA', dataVencimento: { gte: inicioCalendario, lt: fimCalendario } },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'SAIDA', dataVencimento: { gte: inicioCalendario, lt: fimCalendario } },
      _sum: { valor: true },
    }),
    prisma.venda.findMany({
      where: { empresaId: tenantId, data: { gte: inicioTimestamp, lt: fimTimestamp } },
      select: { data: true, total: true },
    }),
  ]);

  const receitaBruta = entradas._sum.valor ? entradas._sum.valor.toNumber() : 0;
  const custos = saidas._sum.valor ? saidas._sum.valor.toNumber() : 0;
  const lucroLiquido = arredondar(receitaBruta - custos);

  // Serie completa do mes (todo dia presente, 0 pros dias sem venda) - um
  // grafico de barras com "buracos" nos dias sem dado fica mais dificil de
  // ler/montar no frontend do que uma serie continua.
  const totalDiasNoMes = new Date(ano, mesNumero, 0).getDate();
  const vendasPorDia = Array.from({ length: totalDiasNoMes }, (_, indice) => ({ dia: indice + 1, total: 0 }));

  for (const venda of vendas) {
    const dia = venda.data.getDate();
    vendasPorDia[dia - 1].total = arredondar(vendasPorDia[dia - 1].total + venda.total.toNumber());
  }

  return { receitaBruta, custos, lucroLiquido, vendasPorDia };
}

/**
 * DRE em "escadinha" pro mes/ano escolhido (ao contrario de `obterDre`
 * acima, que so olha o mes atual e devolve so o resultado final +
 * `vendasPorDia` pro grafico) - mesma exclusividade de plano 'apoiador'
 * (regra de negocio ligada a plano, gate mora aqui na service, nao no
 * controller - mesma convencao de sempre).
 *
 * Receita Bruta soma TODO Lancamento ENTRADA do mes, independente de
 * categoria (mesmo criterio de `obterDre`) - `categoria` so importa pro
 * lado SAIDA, onde decide em qual das 3 linhas seguintes cada lancamento
 * cai (`BUCKET_DRE_POR_CATEGORIA`, importado de lancamentos.service.js
 * pra nao duplicar essa lista em 2 arquivos). Cada bucket e a soma de um
 * `groupBy` só (1 query), nao 3 aggregates separados.
 *
 * Independe de status (PAGO/PENDENTE) - mesma leitura "regime largo" ja
 * usada em `obterDre`/ControleFinanceiro.jsx (o app nao distingue regime
 * de caixa vs competencia em lugar nenhum ainda).
 */
async function gerarDRE(prisma, tenantId, ano, mesNumero) {
  await exigirPlanoApoiador(prisma, tenantId);

  const { inicio, fim } = limitesDoMesCalendario(ano, mesNumero);

  const [entradas, saidasPorCategoria] = await Promise.all([
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'ENTRADA', dataVencimento: { gte: inicio, lt: fim } },
      _sum: { valor: true },
    }),
    prisma.lancamento.groupBy({
      by: ['categoria'],
      where: { empresaId: tenantId, tipo: 'SAIDA', dataVencimento: { gte: inicio, lt: fim } },
      _sum: { valor: true },
    }),
  ]);

  const receitaBruta = entradas._sum.valor ? entradas._sum.valor.toNumber() : 0;

  let deducoes = 0;
  let custosVariaveis = 0;
  let custosFixos = 0;

  for (const grupo of saidasPorCategoria) {
    const valor = grupo._sum.valor ? grupo._sum.valor.toNumber() : 0;
    const bucket = BUCKET_DRE_POR_CATEGORIA[grupo.categoria] ?? 'custo_fixo';

    if (bucket === 'deducao') deducoes += valor;
    else if (bucket === 'custo_variavel') custosVariaveis += valor;
    else custosFixos += valor;
  }

  deducoes = arredondar(deducoes);
  custosVariaveis = arredondar(custosVariaveis);
  custosFixos = arredondar(custosFixos);

  const receitaLiquida = arredondar(receitaBruta - deducoes);
  const margemContribuicao = arredondar(receitaLiquida - custosVariaveis);
  const lucroOperacional = arredondar(margemContribuicao - custosFixos);

  return {
    ano,
    mes: mesNumero,
    receitaBruta: arredondar(receitaBruta),
    deducoes,
    receitaLiquida,
    custosVariaveis,
    margemContribuicao,
    custosFixos,
    lucroOperacional,
  };
}

/**
 * Fluxo de caixa - mesmas 3 metricas que ControleFinanceiro.jsx ja calcula
 * no frontend (a partir de `GET /lancamentos` sem filtro, agregando tudo
 * em memoria), agora tambem disponiveis prontas do backend pra quem
 * precisar (ex.: a nova pagina DRE.jsx). Sem gate de plano - fluxo de
 * caixa basico e livre pra qualquer plano, mesma regra ja aplicada em
 * `obterResumo` acima e em ControleFinanceiro.jsx (que nunca teve gate).
 *
 * `saldoAtual` e SEMPRE all-time (soma de TUDO que ja foi pago, nao so o
 * mes escolhido) - mesma semantica ja documentada em
 * ControleFinanceiro.jsx: um saldo de caixa nao "zera" a cada mes.
 * `totalAReceber`/`totalAPagar` (pendencias) SAO escopados ao mes/ano
 * escolhido - mesma leitura de "aReceberMes"/"aPagarMes" ja usada la.
 */
async function obterFluxoCaixa(prisma, tenantId, ano, mesNumero) {
  const { inicio, fim } = limitesDoMesCalendario(ano, mesNumero);

  const [entradasPagas, saidasPagas, aReceber, aPagar] = await Promise.all([
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'ENTRADA', status: 'PAGO' },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'SAIDA', status: 'PAGO' },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'ENTRADA', status: 'PENDENTE', dataVencimento: { gte: inicio, lt: fim } },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { empresaId: tenantId, tipo: 'SAIDA', status: 'PENDENTE', dataVencimento: { gte: inicio, lt: fim } },
      _sum: { valor: true },
    }),
  ]);

  const saldoAtual = arredondar(
    (entradasPagas._sum.valor ? entradasPagas._sum.valor.toNumber() : 0) -
      (saidasPagas._sum.valor ? saidasPagas._sum.valor.toNumber() : 0)
  );

  return {
    ano,
    mes: mesNumero,
    saldoAtual,
    totalAReceber: arredondar(aReceber._sum.valor ? aReceber._sum.valor.toNumber() : 0),
    totalAPagar: arredondar(aPagar._sum.valor ? aPagar._sum.valor.toNumber() : 0),
  };
}

module.exports = { obterResumo, obterDre, gerarDRE, obterFluxoCaixa };
