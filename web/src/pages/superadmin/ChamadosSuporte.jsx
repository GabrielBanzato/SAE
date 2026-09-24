import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Headset, Loader2, MessageSquare, ArrowRight, Building2, UserRound } from 'lucide-react';
import { apiFetch } from '../../services/api';
import BadgeStatusChamado from '../../components/suporte/BadgeStatusChamado';
import ControleStatusChamado from '../../components/suporte/ControleStatusChamado';
import { STATUS_CHAMADO } from '../../components/suporte/statusChamado';
import { duracao, formatarDataHora } from '../../components/suporte/tempo';

const FILTRO_TODOS = 'TODOS';

/**
 * Aba/rota "Chamados de Suporte" do Painel Master (`/supra-admin/chamados`).
 *
 * Chat de Suporte (2026-09-23): cada chamado virou uma MINIATURA - titulo
 * numa linha, descricao cortada em 3 linhas (chamados grandes nao esticam
 * mais a lista), empresa/quem abriu, qtd. de mensagens e "atualizado ha".
 * Duas acoes por miniatura:
 *   - controle de status (Em Análise / Sendo Solucionado / Resolvido)
 *   - "Ver mais" -> `/supra-admin/chamados/:id` (ChamadoDetalhe.jsx): chamado
 *     completo + chat com o lojista (texto e audio), mesma sidebar roxa.
 * Filtro por status no topo; ordem = ultima movimentacao primeiro (API).
 */
export default function ChamadosSuporte() {
  const [chamados, setChamados] = useState(null);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(null); // { id, status }
  const [filtro, setFiltro] = useState(FILTRO_TODOS);

  useEffect(() => {
    apiFetch('/superadmin/chamados')
      .then(setChamados)
      .catch((err) => setErro(err.message || 'Não foi possível carregar os chamados.'));
  }, []);

  async function alterarStatus(chamado, status) {
    setErro('');
    setProcessando({ id: chamado.id, status });
    try {
      const atualizado = await apiFetch(`/superadmin/chamados/${chamado.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setChamados((atual) =>
        atual.map((item) => (item.id === chamado.id ? { ...item, status: atualizado.status, atualizadoEm: atualizado.atualizadoEm } : item))
      );
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar este chamado.');
    } finally {
      setProcessando(null);
    }
  }

  const contagem = useMemo(() => {
    const porStatus = {};
    (chamados ?? []).forEach((item) => {
      porStatus[item.status] = (porStatus[item.status] || 0) + 1;
    });
    return porStatus;
  }, [chamados]);

  const visiveis = (chamados ?? []).filter((item) => filtro === FILTRO_TODOS || item.status === filtro);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <Headset size={28} className="shrink-0 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          Chamados de Suporte
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">Chamados abertos pelos clientes da plataforma SAE.</p>
      </div>

      {chamados?.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por status">
          {[FILTRO_TODOS, ...Object.keys(STATUS_CHAMADO)].map((valor) => {
            const ativo = filtro === valor;
            const total = valor === FILTRO_TODOS ? chamados.length : contagem[valor] || 0;
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setFiltro(valor)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                  ativo
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700'
                }`}
              >
                {valor === FILTRO_TODOS ? 'Todos' : STATUS_CHAMADO[valor].rotulo} ({total})
              </button>
            );
          })}
        </div>
      )}

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
      )}

      {chamados === null ? (
        !erro && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
            <Loader2 size={24} className="animate-spin" aria-hidden="true" />
            Carregando...
          </div>
        )
      ) : visiveis.length === 0 ? (
        <p className="rounded-3xl bg-white p-10 text-center text-lg text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          {chamados.length === 0 ? 'Nenhum chamado de suporte aberto.' : 'Nenhum chamado com este status.'}
        </p>
      ) : (
        // 2 colunas so em tela bem larga - abaixo disso a miniatura fica estreita e o controle de status quebra linha.
        <div className="grid gap-4 2xl:grid-cols-2">
          {visiveis.map((chamado) => {
            const qtdMensagens = chamado._count?.mensagens ?? 0;
            return (
              <article
                key={chamado.id}
                className="flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-base font-bold text-slate-900 dark:text-slate-100" title={chamado.titulo}>
                    <span className="mr-1.5 font-mono text-sm text-slate-400 dark:text-slate-500">#{chamado.id}</span>
                    {chamado.titulo}
                  </h2>
                  <BadgeStatusChamado status={chamado.status} />
                </div>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={13} aria-hidden="true" />
                    {chamado.empresa?.nomeLoja || chamado.empresa?.razaoSocial}
                  </span>
                  {chamado.usuario && (
                    <span className="inline-flex items-center gap-1">
                      <UserRound size={13} aria-hidden="true" />
                      {chamado.usuario.nome} (ID {chamado.usuario.codigoUsuario})
                    </span>
                  )}
                  <span>{formatarDataHora(chamado.criadoEm)}</span>
                </div>

                {chamado.descricao && (
                  <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{chamado.descricao}</p>
                )}

                {/* Empurra o rodape pra baixo - miniaturas da mesma linha do grid ficam alinhadas. */}
                <div className="min-h-3 flex-1" />

                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare size={13} aria-hidden="true" />
                      {qtdMensagens} {qtdMensagens === 1 ? 'mensagem' : 'mensagens'}
                    </span>
                    <span>Atualizado há {duracao(chamado.atualizadoEm ?? chamado.criadoEm)}</span>
                  </div>
                  <Link
                    to={`/supra-admin/chamados/${chamado.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
                  >
                    Ver mais
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <ControleStatusChamado
                    compacto
                    status={chamado.status}
                    onAlterar={(status) => alterarStatus(chamado, status)}
                    processando={processando?.id === chamado.id ? processando.status : null}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
