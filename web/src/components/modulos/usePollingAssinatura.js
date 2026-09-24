import { useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';

const INTERVALO_MS = 4000;

/**
 * Short polling do status de uma assinatura (pagamentos Asaas, 2026-09-24)
 * - `GET /assinaturas/:id/status` a cada 4s ENQUANTO `ativo` (modal aberto
 * esperando o pagamento). Quem muda o status e o WEBHOOK do Asaas no
 * backend; isto so percebe a mudanca e avisa a tela.
 *
 * - Pausa com a aba em segundo plano (`document.hidden`) e consulta na hora
 *   ao voltar - quem foi pagar no app do banco volta pra aba e ja ve o
 *   resultado, sem esperar o proximo ciclo.
 * - Nunca sobrepoe requisicoes (a proxima so sai depois da anterior
 *   responder) e para sozinho ao desmontar/`ativo` virar false.
 * - Erro de rede pontual e ignorado (tenta no proximo ciclo) - o pagamento
 *   continua valendo do lado do Asaas de qualquer jeito.
 *
 * `onStatus(status)` e chamado a cada resposta; `onConfirmado()` uma unica
 * vez quando o status vira ATIVA.
 */
export default function usePollingAssinatura(assinaturaId, ativo, { onStatus, onConfirmado }) {
  // Refs: callbacks novos a cada render do pai nao reiniciam o polling.
  const onStatusRef = useRef(onStatus);
  const onConfirmadoRef = useRef(onConfirmado);
  useEffect(() => {
    onStatusRef.current = onStatus;
    onConfirmadoRef.current = onConfirmado;
  }, [onStatus, onConfirmado]);

  useEffect(() => {
    if (!ativo || !assinaturaId) return undefined;

    let cancelado = false;
    let timer = null;
    let emAndamento = false;

    async function consultar() {
      if (cancelado || emAndamento || document.hidden) return;
      emAndamento = true;
      try {
        const { status } = await apiFetch(`/assinaturas/${assinaturaId}/status`);
        if (cancelado) return;
        onStatusRef.current?.(status);
        if (status === 'ATIVA') {
          cancelado = true;
          onConfirmadoRef.current?.();
          return;
        }
      } catch {
        // falha pontual: tenta de novo no proximo ciclo
      } finally {
        emAndamento = false;
      }
      if (!cancelado) timer = setTimeout(consultar, INTERVALO_MS);
    }

    function aoVoltarParaAba() {
      if (!document.hidden && !cancelado) {
        clearTimeout(timer);
        consultar();
      }
    }

    timer = setTimeout(consultar, INTERVALO_MS);
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    return () => {
      cancelado = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  }, [assinaturaId, ativo]);
}
