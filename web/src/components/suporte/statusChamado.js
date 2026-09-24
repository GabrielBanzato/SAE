/**
 * Catalogo UNICO de status de chamado do frontend (reestruturacao do
 * Suporte, 2026-09-23) - antes cada tela (Suporte.jsx, ChamadosSuporte.jsx)
 * tinha o seu proprio ternario `status === 'ABERTO' ? ... : ...`, que so
 * conhecia 2 status e quebraria (mostrando "Resolvido" pra qualquer valor
 * novo) assim que o chat introduzisse EM_ANALISE/SENDO_SOLUCIONADO.
 *
 * Espelha `STATUS_CHAMADO_VALIDOS` de api/src/services/superadmin.service.js
 * - a ordem aqui e a ordem do fluxo de atendimento.
 */
export const STATUS_CHAMADO = {
  ABERTO: {
    rotulo: 'Aberto',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  EM_ANALISE: {
    rotulo: 'Em Análise',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  SENDO_SOLUCIONADO: {
    rotulo: 'Sendo Solucionado',
    classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  RESOLVIDO: {
    rotulo: 'Resolvido',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
};

const DESCONHECIDO = {
  classes: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

/** Rotulo + classes de um status - cai num estilo neutro (com o valor cru como rotulo) se vier um status que o frontend ainda nao conhece. */
export function infoStatusChamado(status) {
  return STATUS_CHAMADO[status] ?? { ...DESCONHECIDO, rotulo: status || '-' };
}
