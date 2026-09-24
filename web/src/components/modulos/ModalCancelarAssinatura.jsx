import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { apiFetch } from '../../services/api';

/**
 * Confirmacao de CANCELAMENTO de assinatura (2026-09-24) - aberta quando o
 * admin desliga, na App Store, um modulo que tem assinatura viva no Asaas.
 * Desligar = cancelar a cobranca recorrente (DELETE /assinaturas/:modulo);
 * o acesso sai NA HORA.
 *
 * - Foco inicial em "Manter assinatura" (a opcao segura): Enter/Espaco sem
 *   querer nunca cancela.
 * - Texto explicito sobre os efeitos, inclusive que NAO ha estorno
 *   proporcional do periodo ja pago (doc do Asaas: cobrancas pagas ficam).
 * - Enquanto o DELETE roda, nao fecha (Esc/clique fora ignorados) - evita a
 *   pessoa achar que desistiu quando o cancelamento ja estava em andamento.
 */
export default function ModalCancelarAssinatura({ modulo, nome, valor, onFechar, onCancelada }) {
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState('');
  const botaoManterRef = useRef(null);

  useEffect(() => {
    botaoManterRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !cancelando) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, cancelando]);

  async function confirmar() {
    setErro('');
    setCancelando(true);
    try {
      const resultado = await apiFetch(`/assinaturas/${encodeURIComponent(modulo)}`, { method: 'DELETE' });
      await onCancelada?.(resultado);
    } catch (err) {
      // Falha no Asaas = NADA mudou (backend so revoga depois de cancelar la) - pode tentar de novo.
      setErro(err.message || 'Não foi possível cancelar agora. Nada foi alterado - tente novamente.');
      setCancelando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !cancelando && onFechar()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-cancelar-assinatura"
        aria-describedby="texto-cancelar-assinatura"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
              <AlertTriangle size={22} aria-hidden="true" />
            </span>
            <h2 id="titulo-cancelar-assinatura" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Cancelar assinatura?
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={cancelando}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div id="texto-cancelar-assinatura" className="mt-4 space-y-3 text-base text-slate-600 dark:text-slate-300">
          <p>
            Tem certeza que deseja cancelar a assinatura de <strong className="text-slate-900 dark:text-slate-100">{nome}</strong>
            {valor ? ` (${Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês)` : ''}?
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>O acesso é removido imediatamente</strong> - o módulo some do menu de toda a equipe.
            </li>
            <li>As próximas cobranças mensais são canceladas.</li>
            <li>Não há estorno proporcional do período já pago.</li>
            <li>Você pode assinar de novo quando quiser.</li>
          </ul>
        </div>

        {erro && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={botaoManterRef}
            type="button"
            onClick={onFechar}
            disabled={cancelando}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            Manter assinatura
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={cancelando}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-red-300 px-5 py-3 text-base font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {cancelando && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {cancelando ? 'Cancelando...' : 'Sim, cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
