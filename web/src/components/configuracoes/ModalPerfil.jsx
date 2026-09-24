import { useEffect, useState } from 'react';
import { X, ShieldCheck, Loader2 } from 'lucide-react';

/**
 * Criar/editar um Perfil de Acesso (RBAC, 2026-09-24): nome do cargo +
 * checkboxes das permissoes, agrupados como no menu. Os grupos/rotulos vem
 * do `catalogo` (GET /perfis/catalogo, fonte unica no backend - nada de
 * lista duplicada aqui). Cada grupo tem um "marcar todos".
 *
 * So coleta os dados e chama `onSalvar({ nome, permissoes })` - quem faz a
 * chamada a API e o pai (PerfisAcesso.jsx). Erro do backend (ex.: 409 nome
 * repetido) volta via exception e aparece dentro do proprio modal.
 */
export default function ModalPerfil({ perfil, catalogo, onFechar, onSalvar }) {
  const editando = Boolean(perfil);
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [marcadas, setMarcadas] = useState(() => new Set(perfil?.permissoes ?? []));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !salvando) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, salvando]);

  function alternar(chave) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function alternarGrupo(chavesDoGrupo, marcarTodas) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      chavesDoGrupo.forEach((chave) => (marcarTodas ? novo.add(chave) : novo.delete(chave)));
      return novo;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!nome.trim()) {
      setErro('Dê um nome ao perfil (ex.: Vendas, Produção, Financeiro).');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      // Ordem do catalogo (nao a ordem de clique) - o backend normaliza de novo de qualquer jeito.
      const permissoes = catalogo.flatMap((g) => g.permissoes.map((p) => p.chave)).filter((c) => marcadas.has(c));
      await onSalvar({ nome: nome.trim(), permissoes });
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o perfil.');
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !salvando && onFechar()}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-perfil"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <h2 id="titulo-modal-perfil" className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            <ShieldCheck size={24} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            {editando ? 'Editar Perfil' : 'Novo Perfil de Acesso'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="text-base font-semibold text-slate-800 dark:text-slate-200">Nome do cargo</span>
            <input
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              maxLength={60}
              autoFocus
              placeholder="Ex.: Vendas, Produção, Financeiro"
              className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
            />
          </label>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-slate-800 dark:text-slate-200">O que este perfil pode acessar</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{marcadas.size} selecionada(s)</span>
            </div>

            <div className="mt-3 space-y-4">
              {catalogo.map(({ grupo, permissoes }) => {
                const chaves = permissoes.map((p) => p.chave);
                const todasMarcadas = chaves.every((c) => marcadas.has(c));
                return (
                  <fieldset key={grupo} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <legend className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{grupo}</legend>
                      {chaves.length > 1 && (
                        <button
                          type="button"
                          onClick={() => alternarGrupo(chaves, !todasMarcadas)}
                          className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {todasMarcadas ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {permissoes.map(({ chave, rotulo, descricao }) => (
                        <label
                          key={chave}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                            marcadas.has(chave)
                              ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcadas.has(chave)}
                            onChange={() => alternar(chave)}
                            className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                          />
                          <span>
                            <span className="block font-semibold text-slate-900 dark:text-slate-100">{rotulo}</span>
                            <span className="block text-sm text-slate-500 dark:text-slate-400">{descricao}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>

          {erro && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="rounded-2xl px-5 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {editando ? 'Salvar Alterações' : 'Criar Perfil'}
          </button>
        </div>
      </form>
    </div>
  );
}
