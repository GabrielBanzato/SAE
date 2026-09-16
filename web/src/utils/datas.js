/**
 * Datas "so calendario" (data de vencimento, de pagamento, de cadastro) sao
 * gravadas no banco como meia-noite UTC - o Prisma usa `DateTime` mesmo pra
 * um campo conceitualmente "so uma data", e `new Date('2026-09-08')` no
 * Node (ECMA-262) sempre vira meia-noite UTC, nao meia-noite local.
 *
 * Interpretado de volta com `new Date(isoString)` cru no navegador, esse
 * timestamp desloca 1 dia pra tras em qualquer fuso atras de UTC (ex.:
 * Brasilia, UTC-3): "2026-09-08T00:00:00.000Z" vira "07/09/2026 21:00"
 * local - `.getMonth()`/`.getDate()`/`.toLocaleDateString()` todos leem o
 * dia errado. Esta funcao reconstroi a data usando os componentes UTC
 * (ano/mes/dia) do valor original, ancorados na meia-noite LOCAL -
 * efetivamente trata o valor como "o dia X, seja qual for o fuso de quem
 * ve", que e o comportamento correto pra um campo de calendario (uma conta
 * que vence dia 8 vence dia 8 pra todo mundo, nao depende de onde o
 * usuario mora).
 *
 * Usar SO para campos de calendario puro (dataVencimento, dataPagamento,
 * dataCadastro) - nao para timestamps de verdade (criadoEm/atualizadoEm),
 * que carregam hora real e devem continuar sendo lidos normalmente.
 */
export function dataCalendario(valor) {
  const bruta = new Date(valor);
  return new Date(bruta.getUTCFullYear(), bruta.getUTCMonth(), bruta.getUTCDate());
}

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Grade de 7 colunas (semana) pra um mes de calendario: `null` nas celulas
 * vazias antes do dia 1 e depois do ultimo dia do mes (pra a grade sempre
 * fechar em multiplos de 7), numeros de 1 ao ultimo dia no meio. Extraida
 * de pages/Agenda.jsx (unico lugar que tinha essa logica antes) pra ser
 * reaproveitada por components/CampoData.jsx (date picker custom) sem
 * duplicar o calculo.
 */
export function gerarGradeDoMes(ano, mesIndice) {
  const primeiroDiaSemana = new Date(ano, mesIndice, 1).getDay();
  const totalDias = new Date(ano, mesIndice + 1, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= totalDias; dia++) celulas.push(dia);
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}
