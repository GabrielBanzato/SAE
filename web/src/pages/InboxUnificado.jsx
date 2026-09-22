import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Bot, Send, Phone, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';

// Polling simples (sem WebSocket na API ainda) - intervalo curto o
// suficiente pra parecer "quase em tempo real" no Inbox, sem martelar a API
// a cada segundo.
const INTERVALO_ATUALIZACAO_MS = 5000;

function formatarHora(valor) {
  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Balao verde (BOT/HUMANO - "a empresa") a direita, balao branco/cinza (CLIENTE) a esquerda - mesma convencao visual do WhatsApp Web. */
function BalaoMensagem({ mensagem }) {
  const daEmpresa = mensagem.remetente === 'BOT' || mensagem.remetente === 'HUMANO';

  return (
    <div className={`flex ${daEmpresa ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-base shadow-sm ${
          daEmpresa
            ? 'bg-emerald-500 text-white'
            : 'bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600'
        }`}
      >
        {mensagem.remetente === 'BOT' && (
          <span className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-100">
            <Bot size={12} aria-hidden="true" />
            IA
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{mensagem.conteudo}</p>
        <span
          className={`mt-1 block text-right text-xs ${daEmpresa ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-400'}`}
        >
          {formatarHora(mensagem.timestamp)}
        </span>
      </div>
    </div>
  );
}

function ItemAtendimento({ atendimento, selecionado, onSelecionar }) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors dark:border-slate-700 ${
        selecionado ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        {atendimento.cliente.nome?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{atendimento.cliente.nome}</p>
          {atendimento.ultimaMensagem && (
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              {formatarHora(atendimento.ultimaMensagem.timestamp)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {atendimento.ultimaMensagem?.conteudo || 'Sem mensagens ainda.'}
          </p>
          {!atendimento.iaAtiva && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Humano
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Inbox Unificado de WhatsApp (Passo 6 do roadmap): lista de atendimentos a
 * esquerda (estilo WhatsApp Web/Chatwoot) + chat do atendimento selecionado
 * a direita, com o toggle de handoff "Bot de IA Ativo" no topo.
 *
 * Sem WebSocket na API ainda - a "atualizacao em tempo real" e simulada por
 * polling (`INTERVALO_ATUALIZACAO_MS`) tanto na lista de atendimentos quanto
 * nas mensagens do atendimento aberto no momento.
 */
export default function InboxUnificado() {
  const [atendimentos, setAtendimentos] = useState(null);
  const [erroAtendimentos, setErroAtendimentos] = useState('');
  const [atendimentoSelecionadoId, setAtendimentoSelecionadoId] = useState(null);

  const [mensagens, setMensagens] = useState(null);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [erroMensagens, setErroMensagens] = useState('');

  const [textoNovo, setTextoNovo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alternandoIa, setAlternandoIa] = useState(false);

  const mensagensFimRef = useRef(null);

  const atendimentoSelecionado = atendimentos?.find((item) => item.id === atendimentoSelecionadoId) ?? null;

  useEffect(() => {
    let ativo = true;

    function buscar() {
      apiFetch('/whatsapp/atendimentos')
        .then((dados) => {
          if (ativo) setAtendimentos(dados);
        })
        .catch((err) => {
          if (ativo) setErroAtendimentos(err.message || 'Não foi possível carregar os atendimentos.');
        });
    }

    buscar();
    const intervalo = setInterval(buscar, INTERVALO_ATUALIZACAO_MS);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    if (!atendimentoSelecionadoId) {
      setMensagens(null);
      return undefined;
    }

    let ativo = true;
    setCarregandoMensagens(true);
    setErroMensagens('');

    function buscar(primeiraVez) {
      apiFetch(`/whatsapp/atendimentos/${atendimentoSelecionadoId}/mensagens`)
        .then((dados) => {
          if (ativo) setMensagens(dados);
        })
        .catch((err) => {
          if (ativo) setErroMensagens(err.message || 'Não foi possível carregar as mensagens.');
        })
        .finally(() => {
          if (ativo && primeiraVez) setCarregandoMensagens(false);
        });
    }

    buscar(true);
    const intervalo = setInterval(() => buscar(false), INTERVALO_ATUALIZACAO_MS);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [atendimentoSelecionadoId]);

  useEffect(() => {
    mensagensFimRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens]);

  async function handleAlternarIa() {
    if (!atendimentoSelecionado) return;

    setAlternandoIa(true);
    try {
      const atualizado = await apiFetch(`/whatsapp/atendimentos/${atendimentoSelecionado.id}/ia-ativa`, {
        method: 'PATCH',
        body: JSON.stringify({ ia_ativa: !atendimentoSelecionado.iaAtiva }),
      });
      setAtendimentos((atual) => atual.map((item) => (item.id === atualizado.id ? { ...item, iaAtiva: atualizado.iaAtiva } : item)));
    } catch (err) {
      setErroMensagens(err.message || 'Não foi possível alternar o bot de IA.');
    } finally {
      setAlternandoIa(false);
    }
  }

  async function handleEnviar(event) {
    event.preventDefault();
    const texto = textoNovo.trim();
    if (!texto || !atendimentoSelecionado) return;

    setEnviando(true);
    setErroMensagens('');
    try {
      const mensagem = await apiFetch(`/whatsapp/atendimentos/${atendimentoSelecionado.id}/mensagens`, {
        method: 'POST',
        body: JSON.stringify({ texto }),
      });
      setMensagens((atual) => [...(atual || []), mensagem]);
      setTextoNovo('');
    } catch (err) {
      setErroMensagens(err.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <MessageCircle size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Inbox Unificado
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Atendimentos de WhatsApp com handoff entre IA e equipe.
        </p>
      </div>

      {erroAtendimentos && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erroAtendimentos}
        </p>
      )}

      <div className="flex h-[75vh] min-h-[500px] overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        {/* Coluna esquerda - lista de atendimentos, ordenada pela ultima mensagem (ver whatsapp.service.js#listarAtendimentosAbertos). */}
        <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-slate-100 dark:border-slate-700">
          <div className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Atendimentos ({atendimentos?.length ?? 0})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {atendimentos === null && (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 dark:text-slate-500">
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                Carregando...
              </div>
            )}

            {atendimentos?.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Nenhum atendimento aberto no momento.
              </p>
            )}

            {atendimentos?.map((atendimento) => (
              <ItemAtendimento
                key={atendimento.id}
                atendimento={atendimento}
                selecionado={atendimento.id === atendimentoSelecionadoId}
                onSelecionar={() => setAtendimentoSelecionadoId(atendimento.id)}
              />
            ))}
          </div>
        </aside>

        {/* Coluna direita - historico do chat selecionado. */}
        <section className="flex min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-900/40">
          {!atendimentoSelecionado && (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
              <div>
                <MessageCircle size={40} className="mx-auto mb-3" aria-hidden="true" />
                <p className="text-lg font-semibold">Selecione um atendimento para ver a conversa.</p>
              </div>
            </div>
          )}

          {atendimentoSelecionado && (
            <>
              {/* Cabecalho: identificacao do cliente + toggle de handoff IA <-> Humano. */}
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
                    {atendimentoSelecionado.cliente.nome}
                  </p>
                  {atendimentoSelecionado.cliente.telefone && (
                    <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <Phone size={13} aria-hidden="true" />
                      {atendimentoSelecionado.cliente.telefone}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAlternarIa}
                  disabled={alternandoIa}
                  aria-pressed={atendimentoSelecionado.iaAtiva}
                  className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700"
                >
                  <Bot
                    size={20}
                    className={atendimentoSelecionado.iaAtiva ? 'text-emerald-600' : 'text-slate-400'}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Bot de IA Ativo</span>
                  <span
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      atendimentoSelecionado.iaAtiva ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        atendimentoSelecionado.iaAtiva ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              </div>

              {/* Historico de mensagens - balao verde (BOT/HUMANO, "a empresa") a direita, branco/cinza (CLIENTE) a esquerda. */}
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {carregandoMensagens && (
                  <div className="flex items-center justify-center gap-2 py-8 text-slate-400 dark:text-slate-500">
                    <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                    Carregando mensagens...
                  </div>
                )}

                {!carregandoMensagens && mensagens?.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Nenhuma mensagem ainda.</p>
                )}

                {mensagens?.map((mensagem) => (
                  <BalaoMensagem key={mensagem.id} mensagem={mensagem} />
                ))}

                <div ref={mensagensFimRef} />
              </div>

              {erroMensagens && (
                <p className="shrink-0 bg-red-50 px-5 py-2 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {erroMensagens}
                </p>
              )}

              {/* Input de envio manual - guarda como HUMANO e dispara de verdade no WhatsApp (whatsapp.service.js#enviarMensagemManual). */}
              <form
                onSubmit={handleEnviar}
                className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
              >
                <input
                  type="text"
                  value={textoNovo}
                  onChange={(event) => setTextoNovo(event.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-800 outline-none transition-colors focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={enviando || !textoNovo.trim()}
                  className="flex shrink-0 items-center justify-center rounded-2xl bg-blue-600 p-3 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Enviar mensagem"
                >
                  <Send size={20} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
