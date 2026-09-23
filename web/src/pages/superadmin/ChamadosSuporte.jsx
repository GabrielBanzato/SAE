import { useEffect, useState } from 'react';
import { Headset, CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

function formatarData(valor) {
  return new Date(valor).toLocaleDateString('pt-BR');
}

/**
 * Aba/rota "Chamados de Suporte" (Painel Master, rota `/supra-admin/chamados`)
 * - todos os chamados abertos pelos clientes (pages/Suporte.jsx), com nome
 * da empresa junto. Extraida de SupraAdmin.jsx pro Painel Master - etapa 1
 * (2026-09-23), mesma logica de antes, so virou uma rota propria.
 */
export default function ChamadosSuporte() {
  const [chamados, setChamados] = useState(null);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);

  function carregar() {
    apiFetch('/superadmin/chamados')
      .then(setChamados)
      .catch((err) => setErro(err.message || 'Não foi possível carregar os chamados.'));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alternarStatus(chamado) {
    setErro('');
    setProcessandoId(chamado.id);
    try {
      const novoStatus = chamado.status === 'ABERTO' ? 'RESOLVIDO' : 'ABERTO';
      await apiFetch(`/superadmin/chamados/${chamado.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: novoStatus }),
      });
      carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar este chamado.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <Headset size={28} className="shrink-0 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          Chamados de Suporte
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Chamados abertos pelos clientes da plataforma SAE.
        </p>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {chamados === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          Carregando...
        </div>
      ) : chamados.length === 0 ? (
        <p className="rounded-3xl bg-white p-10 text-center text-lg text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          Nenhum chamado de suporte aberto.
        </p>
      ) : (
        <div className="space-y-3">
          {chamados.map((chamado) => {
            const processando = processandoId === chamado.id;
            return (
              <div
                key={chamado.id}
                className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100">{chamado.titulo}</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      {chamado.empresa?.nomeLoja || chamado.empresa?.razaoSocial} - {formatarData(chamado.criadoEm)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ${
                      chamado.status === 'ABERTO'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}
                  >
                    {chamado.status === 'ABERTO' ? 'Aberto' : 'Resolvido'}
                  </span>
                </div>

                {chamado.descricao && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{chamado.descricao}</p>
                )}

                <button
                  type="button"
                  onClick={() => alternarStatus(chamado)}
                  disabled={processando}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {processando ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  )}
                  {chamado.status === 'ABERTO' ? 'Marcar como Resolvido' : 'Reabrir Chamado'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
