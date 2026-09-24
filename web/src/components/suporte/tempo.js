/** Formatadores de data/tempo do Suporte (lista de chamados + chat). */

export function formatarDataHora(valor) {
  return valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

export function formatarHora(valor) {
  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "Hoje" / "Ontem" / "12/09/2026" - separador de dia do chat. */
export function rotuloDia(valor) {
  const data = new Date(valor);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === hoje.toDateString()) return 'Hoje';
  if (data.toDateString() === ontem.toDateString()) return 'Ontem';
  return data.toLocaleDateString('pt-BR');
}

/**
 * Duracao legivel entre `desde` e `ate` (padrao: agora) - "menos de 1 min",
 * "12 min", "3 h e 5 min", "2 dias e 4 h". Usado em "Aberto há ..." e
 * "Atualizado há ..." no cabecalho do chat.
 */
export function duracao(desde, ate = Date.now()) {
  const minutos = Math.max(0, Math.floor((new Date(ate).getTime() - new Date(desde).getTime()) / 60000));
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const restoMin = minutos % 60;
  if (horas < 24) return restoMin ? `${horas} h e ${restoMin} min` : `${horas} h`;

  const dias = Math.floor(horas / 24);
  const restoHoras = horas % 24;
  const parteDias = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return restoHoras ? `${parteDias} e ${restoHoras} h` : parteDias;
}

/** "0:07", "2:45" - cronometro da gravacao de audio. */
export function formatarCronometro(segundos) {
  const m = Math.floor(segundos / 60);
  const s = String(segundos % 60).padStart(2, '0');
  return `${m}:${s}`;
}
