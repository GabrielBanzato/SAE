import { useEffect, useState } from 'react';
import { QrCode, CreditCard, X } from 'lucide-react';

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Checkout simulado (motor de pricing da App Store, 2026-09-22) - aberto
 * quando a empresa clica no Switch de um módulo pago que ainda não consta
 * em `pagamentosAtivos` (ver Modulos.jsx#abrirPagamento). Mesmo espírito
 * "simulado" já usado em Assinatura.jsx (`atualizarAssinatura`, sem gateway
 * real integrado) - o QR Code aqui é só um placeholder visual, os dois
 * botões (Pix/Cartão) fazem exatamente a mesma coisa: confirmam o
 * pagamento na hora, sem processar nada de verdade.
 *
 * `preco`/`precoComDesconto` já vêm calculados de quem abriu o modal
 * (Modulos.jsx) - este componente só decide QUAL dos dois mostrar,
 * conforme `isDoador`.
 */
export default function ModalPagamento({ nome, preco, precoComDesconto, isDoador, onFechar, onConfirmar }) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !processando) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, processando]);

  const precoFinal = isDoador ? precoComDesconto : preco;

  async function handleConfirmar() {
    setErro('');
    setProcessando(true);
    try {
      await onConfirmar();
    } catch (err) {
      setErro(err.message || 'Não foi possível confirmar o pagamento agora.');
      setProcessando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !processando && onFechar()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-pagamento"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-pagamento" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Assinar {nome}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={processando}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex items-baseline gap-2">
          {isDoador && (
            <s className="text-lg font-semibold text-slate-400 dark:text-slate-500">{formatarMoeda(preco)}</s>
          )}
          <span
            className={`text-3xl font-extrabold ${
              isDoador ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {formatarMoeda(precoFinal)}
          </span>
          <span className="text-base font-medium text-slate-400 dark:text-slate-500">/mês</span>
        </div>
        {isDoador && (
          <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            Desconto de Apoiador já aplicado
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-6 dark:border-slate-700">
          <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900">
            <QrCode size={72} className="text-slate-400 dark:text-slate-600" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Escaneie para pagar com Pix</p>
        </div>

        {erro && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={processando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processando ? 'Confirmando...' : 'Pagar com Pix'}
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={processando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 px-6 py-3 text-lg font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <CreditCard size={20} aria-hidden="true" />
            Pagar com Cartão
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Checkout simulado - nenhuma cobrança real é feita.
        </p>
      </div>
    </div>
  );
}
