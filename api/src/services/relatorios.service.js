const AppError = require('../utils/AppError');
const { mesAtual, limitesDoMesCalendario, limitesDoMesTimestamp } = require('../utils/datas');

function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
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
  const empresa = await prisma.empresa.findUnique({ where: { id: tenantId }, select: { plano: true } });

  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  if (empresa.plano !== 'apoiador') {
    throw new AppError('Acesso negado - funcionalidade premium disponivel apenas para o plano Apoiador.', 403);
  }

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

module.exports = { obterResumo, obterDre };
