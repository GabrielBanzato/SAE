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
