import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const DURACAO_PADRAO_MS = 5000;

const ESTILOS_TIPO = {
  sucesso: { icon: CheckCircle2, classes: 'bg-emerald-600' },
  erro: { icon: AlertTriangle, classes: 'bg-red-600' },
  aviso: { icon: AlertTriangle, classes: 'bg-amber-500' },
  info: { icon: Info, classes: 'bg-slate-800 dark:bg-slate-700' },
};

/**
 * Sistema de toast do projeto - nao existia nenhum antes desta tarefa
 * (conferido em tarefas anteriores, ex.: Relatorios.jsx/Lancamentos.jsx
 * tiveram feedback "Gerando arquivo..." inline por falta disso). Pedido
 * explicito de usar "a biblioteca de notificacoes do projeto" pra um alerta
 * de exportacao motivou criar esta versao minima (Context + pilha de
 * mensagens fixas no canto da tela) - sem instalar nenhuma dependencia
 * nova, no mesmo espirito de Auth/ThemeContext ja existentes.
 *
 * `mostrarToast(mensagem, tipo, duracaoMs)` - `tipo` e uma das chaves de
 * `ESTILOS_TIPO` ('sucesso'/'erro'/'aviso'/'info', default 'info').
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removerToast = useCallback((id) => {
    setToasts((atual) => atual.filter((toast) => toast.id !== id));
  }, []);

  const mostrarToast = useCallback(
    (mensagem, tipo = 'info', duracaoMs = DURACAO_PADRAO_MS) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((atual) => [...atual, { id, mensagem, tipo }]);
      setTimeout(() => removerToast(id), duracaoMs);
    },
    [removerToast]
  );

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}

      {/* z-[100]: acima de qualquer modal (z-40) ou da Sidebar mobile
          (z-50) do app - um toast precisa ficar visivel por cima de tudo,
          sempre. `pointer-events-none` no container + `pointer-events-auto`
          em cada toast individual: o espaco vazio ao redor dos toasts (a
          maior parte do container, que ocupa a tela inteira em largura no
          mobile) nao deve bloquear cliques no conteudo por baixo. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((toast) => {
          const { icon: Icon, classes } = ESTILOS_TIPO[toast.tipo] || ESTILOS_TIPO.info;
          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-white shadow-xl ${classes}`}
            >
              <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-base font-semibold">{toast.mensagem}</p>
              <button
                type="button"
                onClick={() => removerToast(toast.id)}
                aria-label="Fechar aviso"
                className="shrink-0 opacity-80 transition-opacity hover:opacity-100"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error('useToast precisa ser usado dentro de um <ToastProvider>.');
  }
  return contexto;
}
