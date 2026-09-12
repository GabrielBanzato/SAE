import { useEffect } from 'react';
import { Calculator, X } from 'lucide-react';
import CalculadoraLucros from './CalculadoraLucros';

/**
 * Modal secundario (empilhado sobre o ModalProduto - z-40, o ModalProduto
 * usa z-30) que abre a mesma Calculadora de Precificacao da pagina
 * `/precificacao`, so em modo embutido: nao pede nome nem cria produto
 * nenhum, so calcula e devolve `{ custo, precoVenda }` pro formulario de
 * cadastro que ja esta aberto por tras (via `onAplicarPreco`).
 */
export default function ModalCalculadoraLucros({ custoInicial, onFechar, onAplicarPreco }) {
  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-calculadora-lucros"
      >
        <div className="flex items-center justify-between">
          <h2
            id="titulo-modal-calculadora-lucros"
            className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100"
          >
            <Calculator size={22} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Calculadora de Lucros
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          Defina o preço de venda ideal com base no custo, na taxa da maquininha e na margem desejada.
        </p>

        <div className="mt-6">
          <CalculadoraLucros
            modoEmbutido
            custoInicial={custoInicial}
            onAplicarPreco={(dados) => {
              onAplicarPreco(dados);
              onFechar();
            }}
          />
        </div>
      </div>
    </div>
  );
}
