/**
 * Helpers de limites de mes, compartilhados entre agenda.service.js e
 * relatorios.service.js. Existem DUAS variantes porque este projeto tem
 * dois "tipos" de campo de data, com semanticas diferentes (mesma
 * distincao documentada no frontend, ver web/src/utils/datas.js):
 *
 * - Campos "so calendario" (Lancamento.dataVencimento, Tarefa.dataVencimento)
 *   sao gravados como meia-noite UTC pro dia que o usuario escolheu -
 *   comparar contra limites tambem em UTC evita que o resultado dependa
 *   do fuso horario de onde o processo da API roda.
 * - Campos que sao timestamps DE VERDADE (Venda.data, *.criadoEm) tem hora
 *   real de quando o evento aconteceu - o limite do mes precisa respeitar
 *   o fuso em que esse instante foi vivido (local), senao uma venda feita
 *   as 22h no Brasil (ja seria 01h UTC do dia seguinte) escaparia pro mes
 *   errado se comparada em UTC.
 */

/** "Mes atual" do ponto de vista de quem usa o sistema (fuso local do processo, nao UTC). */
function mesAtual() {
  const agora = new Date();
  return { ano: agora.getFullYear(), mesNumero: agora.getMonth() + 1 };
}

/** Limites [inicio, fim) em UTC - para campos "so calendario". `fim` e exclusivo (usar com `lt`). */
function limitesDoMesCalendario(ano, mesNumero) {
  const inicio = new Date(Date.UTC(ano, mesNumero - 1, 1, 0, 0, 0));
  const fim = new Date(Date.UTC(ano, mesNumero, 1, 0, 0, 0));
  return { inicio, fim };
}

/** Limites [inicio, fim) no fuso local do processo - para timestamps de verdade. `fim` e exclusivo (usar com `lt`). */
function limitesDoMesTimestamp(ano, mesNumero) {
  const inicio = new Date(ano, mesNumero - 1, 1, 0, 0, 0);
  const fim = new Date(ano, mesNumero, 1, 0, 0, 0);
  return { inicio, fim };
}

/**
 * Limites [inicio, fim) do dia de HOJE, em UTC - para campos "so
 * calendario" (mesmo raciocinio de `limitesDoMesCalendario`, mas
 * recortando só o dia atual em vez do mes inteiro). "Hoje" é decidido no
 * fuso LOCAL do processo (mesmo motivo de `mesAtual()` - é um conceito de
 * quem usa o sistema), só os limites de comparação em si são UTC.
 */
function limitesDeHoje() {
  const agora = new Date();
  const inicio = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0));
  const fim = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 0, 0, 0));
  return { inicio, fim };
}

/**
 * Limites [inicio, fim) da janela "de hoje até daqui `dias` dias"
 * (inclusive nos dois extremos), em UTC - para campos "so calendario".
 * Ex.: `limitesProximosDias(7)` cobre hoje + os proximos 7 dias (8 dias de
 * calendario ao todo), mesma janela usada em "Próximos Vencimentos"
 * (ControleFinanceiro.jsx, calculado la no frontend - este e o
 * equivalente pro backend).
 */
function limitesProximosDias(dias) {
  const agora = new Date();
  const inicio = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0));
  const fim = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias + 1, 0, 0, 0));
  return { inicio, fim };
}

module.exports = {
  mesAtual,
  limitesDoMesCalendario,
  limitesDoMesTimestamp,
  limitesDeHoje,
  limitesProximosDias,
};
