import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Building2, UserRound, Clock } from 'lucide-react';
import { apiFetch } from '../../services/api';
import ChatChamado from '../../components/suporte/chat/ChatChamado';
import useChamadoChat from '../../components/suporte/chat/useChamadoChat';
import BadgeStatusChamado from '../../components/suporte/BadgeStatusChamado';
import ControleStatusChamado from '../../components/suporte/ControleStatusChamado';
import { duracao, formatarDataHora } from '../../components/suporte/tempo';

/**
 * Chamado aberto no Painel Master (rota `/supra-admin/chamados/:id`, Chat de
 * Suporte 2026-09-23) - aberta pelo "Ver mais" da miniatura em
 * ChamadosSuporte.jsx. Fica dentro do `SupraAdminLayout` (mantem a sidebar
 * roxa; o item "Chamados de Suporte" continua marcado porque o NavLink
 * casa o prefixo), com seta pra voltar um nivel (a lista).
 *
 * Topo: empresa + quem abriu (nome/ID de 5 digitos), controle de status
 * (Em Análise / Sendo Solucionado / Resolvido) e o chat com o lojista,
 * mesmo componente do lado do lojista (remetente ADMIN decidido pela rota).
 */
export default function ChamadoDetalhe() {
  const { id } = useParams();
  const baseUrl = `/superadmin/chamados/${id}`;
  const { chamado, setChamado, mensagens, erro, setErro, enviando, enviarTexto, enviarAudio } = useChamadoChat(baseUrl);
  const [statusProcessando, setStatusProcessando] = useState(null);

  async function alterarStatus(status) {
    setStatusProcessando(status);
    try {
      const atualizado = await apiFetch(`${baseUrl}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setChamado((atual) => ({ ...atual, status: atualizado.status, atualizadoEm: atualizado.atualizadoEm }));
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar o status.');
    } finally {
      setStatusProcessando(null);
    }
  }

  const nomeEmpresa = chamado?.empresa?.nomeLoja || chamado?.empresa?.razaoSocial || 'Lojista';

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 md:h-[calc(100dvh-4rem)]">
      <header className="shrink-0 space-y-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6 sm:py-4">
        <div className="flex items-start gap-3">
          <Link
            to="/supra-admin/chamados"
            aria-label="Voltar para Chamados de Suporte"
            title="Voltar"
            className="mt-0.5 shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </Link>

          {chamado ? (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 truncate text-lg font-extrabold text-slate-900 dark:text-slate-100 sm:text-xl" title={chamado.titulo}>
                  <span className="mr-1.5 font-mono text-base text-slate-400 dark:text-slate-500">#{chamado.id}</span>
                  {chamado.titulo}
                </h1>
                <BadgeStatusChamado status={chamado.status} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                <span className="inline-flex items-center gap-1">
                  <Building2 size={14} aria-hidden="true" />
                  {nomeEmpresa}
                  {chamado.empresa?.codigoLoja && <strong className="font-mono">· Loja ID {chamado.empresa.codigoLoja}</strong>}
                </span>
                {chamado.usuario && (
                  <span className="inline-flex items-center gap-1">
                    <UserRound size={14} aria-hidden="true" />
                    {chamado.usuario.nome}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} aria-hidden="true" />
                  Aberto em {formatarDataHora(chamado.criadoEm)} · atualizado há {duracao(chamado.atualizadoEm)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 py-2 text-slate-400">Carregando chamado...</div>
          )}
        </div>

        {chamado && (
          <ControleStatusChamado status={chamado.status} onAlterar={alterarStatus} processando={statusProcessando} />
        )}
      </header>

      {erro && (
        <p className="shrink-0 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
      )}

      {chamado ? (
        <ChatChamado
          chamado={chamado}
          mensagens={mensagens}
          meuPapel="ADMIN"
          baseUrl={baseUrl}
          enviando={enviando}
          onEnviarTexto={enviarTexto}
          onEnviarAudio={enviarAudio}
          nomeLojista={chamado.usuario?.nome || nomeEmpresa}
          cor="roxo"
        />
      ) : (
        !erro && (
          <div className="flex flex-1 items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 size={22} className="animate-spin" aria-hidden="true" />
            Carregando conversa...
          </div>
        )
      )}
    </div>
  );
}
