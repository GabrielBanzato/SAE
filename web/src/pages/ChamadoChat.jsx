import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Clock, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ChatChamado from '../components/suporte/chat/ChatChamado';
import useChamadoChat from '../components/suporte/chat/useChamadoChat';
import BadgeStatusChamado from '../components/suporte/BadgeStatusChamado';
import { duracao, formatarDataHora } from '../components/suporte/tempo';

/** Re-renderiza a cada 30s - mantem "há X min" do cabecalho vivo sem recarregar nada. */
function useAgora(intervaloMs = 30000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

/**
 * Chat de um chamado, visao do LOJISTA (rota `/suporte/chamado/:id`, Chat
 * de Suporte 2026-09-23) - aberta pelo "Ver mais" de Meus Chamados.
 * Mantem a Sidebar normal (rota dentro do `<Layout>`), com seta pra voltar
 * pra /suporte. Cabecalho: status atual, data da ultima alteracao e ha
 * quanto tempo o chamado esta aberto (conta ate a ultima alteracao se ja
 * foi RESOLVIDO - um chamado resolvido nao continua "aberto").
 */
export default function ChamadoChat() {
  const { id } = useParams();
  const { empresa } = useAuth();
  const agora = useAgora();
  const { chamado, mensagens, erro, enviando, enviarTexto, enviarAudio } = useChamadoChat(`/chamados/${id}`);

  const resolvido = chamado?.status === 'RESOLVIDO';

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[420px] flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 md:h-[calc(100dvh-4rem)]">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6 sm:py-4">
        <Link
          to="/suporte"
          aria-label="Voltar para Suporte"
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
                <History size={14} aria-hidden="true" />
                Última alteração: {formatarDataHora(chamado.atualizadoEm)} (há {duracao(chamado.atualizadoEm, agora)})
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden="true" />
                {resolvido
                  ? `Ficou aberto por ${duracao(chamado.criadoEm, chamado.atualizadoEm)}`
                  : `Aberto há ${duracao(chamado.criadoEm, agora)}`}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 py-2 text-slate-400">Carregando chamado...</div>
        )}
      </header>

      {erro && (
        <p className="shrink-0 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
      )}

      {resolvido && (
        <p className="shrink-0 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Este chamado foi marcado como resolvido. Se o problema voltou, é só mandar uma mensagem.
        </p>
      )}

      {chamado ? (
        <ChatChamado
          chamado={chamado}
          mensagens={mensagens}
          meuPapel="LOJISTA"
          baseUrl={`/chamados/${id}`}
          enviando={enviando}
          onEnviarTexto={enviarTexto}
          onEnviarAudio={enviarAudio}
          nomeLojista={empresa?.nomeLoja || empresa?.razaoSocial || 'Você'}
          cor="azul"
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
