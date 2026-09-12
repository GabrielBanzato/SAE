import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, User, UserPlus } from 'lucide-react';

/**
 * Dropdown customizado (substitui o <select> nativo) pra "Atrelar a um
 * Cliente" no PDV. Feito so com Tailwind (sem lib externa) pra bater com o
 * visual de card arredondado do resto da tela - um <select> nativo nao da
 * pra estilizar direito (a lista suspensa e renderizada pelo SO/browser).
 */
export default function SeletorCliente({ clientes, clienteId, onSelecionar, onNovoCliente }) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  const clienteSelecionado = clientes.find((cliente) => String(cliente.id) === String(clienteId));

  useEffect(() => {
    function handleClickFora(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setAberto(false);
      }
    }
    function handleEsc(event) {
      if (event.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', handleClickFora);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  function selecionar(id) {
    onSelecionar(id);
    setAberto(false);
  }

  return (
    <div ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setAberto((atual) => !atual)}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-left transition-all hover:border-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:focus:border-blue-400"
        >
          <User size={20} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <span
            className={`flex-1 truncate text-lg font-medium ${
              clienteSelecionado ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {clienteSelecionado ? clienteSelecionado.nome : 'Nenhum cliente'}
          </span>
          <ChevronDown
            size={20}
            className={`shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${aberto ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {aberto && (
          <div
            role="listbox"
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              role="option"
              aria-selected={!clienteId}
              onClick={() => selecionar('')}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-base font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Nenhum cliente
              {!clienteId && <Check size={16} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
            </button>

            {clientes.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500">
                Nenhum cliente cadastrado ainda.
              </p>
            )}

            {clientes.map((cliente) => {
              const selecionadoAtual = String(cliente.id) === String(clienteId);
              return (
                <button
                  key={cliente.id}
                  type="button"
                  role="option"
                  aria-selected={selecionadoAtual}
                  onClick={() => selecionar(String(cliente.id))}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-base font-medium transition-colors ${
                    selecionadoAtual
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="truncate">{cliente.nome}</span>
                  {selecionadoAtual && <Check size={16} className="shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNovoCliente}
        className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <UserPlus size={16} aria-hidden="true" />
        Novo Cliente
      </button>
    </div>
  );
}
