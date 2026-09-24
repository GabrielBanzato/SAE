import { History, Loader2, RefreshCw } from 'lucide-react';
import BadgeStatusChamado from './BadgeStatusChamado';

function formatarDataHora(valor) {
  return valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

/**
 * "Meus Chamados" do lojista (extraido de pages/Suporte.jsx na
 * reestruturacao de 2026-09-23). Componente de apresentacao - quem busca
 * os dados (`GET /chamados`) e a pagina, que tambem recarrega a lista
 * depois de um envio pelo FormularioChamado.
 *
 * Tabela virou lista de cartoes: cabe em tela de celular sem scroll
 * horizontal, e o titulo longo e truncado numa linha (`truncate`) em vez
 * de esticar a linha da tabela. Mostra tambem "Atualizado em"
 * (`ChamadoSuporte.atualizadoEm`, migration 20260923170000).
 */
export default function MeusChamados({ chamados, erro, carregando, onRecarregar }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
          <History size={22} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          Meus Chamados
          {chamados?.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {chamados.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onRecarregar}
          disabled={carregando}
          aria-label="Atualizar lista de chamados"
          title="Atualizar"
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <RefreshCw size={18} className={carregando ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {erro && (
        <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {chamados === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400 dark:text-slate-500">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          Carregando...
        </div>
      ) : chamados.length === 0 ? (
        <p className="py-6 text-center text-base text-slate-400 dark:text-slate-500">Você ainda não abriu nenhum chamado.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {chamados.map((chamado) => (
            <li
              key={chamado.id}
              className="rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-800 dark:text-slate-200" title={chamado.titulo}>
                    <span className="mr-2 font-mono text-sm text-slate-400 dark:text-slate-500">#{chamado.id}</span>
                    {chamado.titulo}
                  </p>
                  {chamado.descricao && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{chamado.descricao}</p>
                  )}
                </div>
                <BadgeStatusChamado status={chamado.status} />
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Aberto em {formatarDataHora(chamado.criadoEm)}
                {chamado.atualizadoEm && <> · Atualizado em {formatarDataHora(chamado.atualizadoEm)}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
