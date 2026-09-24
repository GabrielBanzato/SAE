import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mic, Send, Trash2, Loader2 } from 'lucide-react';
import BalaoMensagem from './BalaoMensagem';
import useGravadorAudio, { DURACAO_MAX_SEGUNDOS } from './useGravadorAudio';
import { rotuloDia, formatarCronometro } from '../tempo';

const CORES = {
  azul: { botao: 'bg-blue-600 hover:bg-blue-700', foco: 'focus:border-blue-500 dark:focus:border-blue-400' },
  roxo: { botao: 'bg-purple-600 hover:bg-purple-700', foco: 'focus:border-purple-500 dark:focus:border-purple-400' },
};

/**
 * Interface de chat de um chamado (Chat de Suporte, 2026-09-23) - usada
 * pelo lojista (pages/ChamadoChat.jsx) e pelo Supra Admin
 * (pages/superadmin/ChamadoDetalhe.jsx). So apresentacao + entrada: quem
 * busca/envia e o hook `useChamadoChat` da pagina.
 *
 * - `meuPapel` ('LOJISTA'|'ADMIN') decide quais baloes sao "meus" (direita).
 * - A `descricao` original do chamado vira o PRIMEIRO balao (do lojista, na
 *   data de abertura) - ela nao e duplicada em `mensagens_chamado`.
 * - Separador de dia ("Hoje"/"Ontem"/data) entre mensagens de dias diferentes.
 * - Entrada estilo WhatsApp: com texto vazio o botao principal e o
 *   microfone; com texto, vira "enviar". Enter envia, Shift+Enter quebra linha.
 */
export default function ChatChamado({
  chamado,
  mensagens,
  meuPapel,
  baseUrl,
  enviando,
  onEnviarTexto,
  onEnviarAudio,
  nomeLojista,
  cor = 'azul',
}) {
  const [texto, setTexto] = useState('');
  const listaRef = useRef(null);
  const textareaRef = useRef(null);
  const ultimaQtdRef = useRef(0);

  const gravador = useGravadorAudio({ onLimiteAtingido: (blob) => onEnviarAudio(blob) });
  const estilo = CORES[cor];

  const todas = [
    ...(chamado.descricao
      ? [{ id: 'descricao', remetente: 'LOJISTA', tipoMensagem: 'TEXTO', conteudo: chamado.descricao, criadoEm: chamado.criadoEm }]
      : []),
    ...mensagens,
  ];

  // Rola pro fim ao abrir e a cada mensagem nova - mas so "puxa" o usuario
  // pra baixo se ele ja estava perto do fim (ou se a nova e dele mesmo);
  // quem subiu pra reler o historico nao e arrancado de la pelo polling.
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!lista || todas.length === ultimaQtdRef.current) return;
    const primeiraCarga = ultimaQtdRef.current === 0;
    const pertoDoFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 160;
    const ultimaEhMinha = todas[todas.length - 1]?.remetente === meuPapel;
    if (primeiraCarga || pertoDoFim || ultimaEhMinha) lista.scrollTop = lista.scrollHeight;
    ultimaQtdRef.current = todas.length;
  });

  // Textarea cresce com o conteudo (ate ~5 linhas).
  useEffect(() => {
    const campo = textareaRef.current;
    if (!campo) return;
    campo.style.height = 'auto';
    campo.style.height = `${Math.min(campo.scrollHeight, 140)}px`;
  }, [texto]);

  async function enviarTexto() {
    const valor = texto.trim();
    if (!valor || enviando) return;
    const ok = await onEnviarTexto(valor);
    if (ok) {
      setTexto('');
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      enviarTexto();
    }
  }

  async function concluirGravacao() {
    const blob = await gravador.finalizar();
    if (blob && blob.size > 0) await onEnviarAudio(blob);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listaRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-100/70 px-3 py-4 dark:bg-slate-950/40 sm:px-6"
        aria-live="polite"
      >
        {todas.map((mensagem, indice) => {
          const anterior = todas[indice - 1];
          const novoDia = !anterior || new Date(anterior.criadoEm).toDateString() !== new Date(mensagem.criadoEm).toDateString();
          const minha = mensagem.remetente === meuPapel;
          const autor = mensagem.remetente === 'ADMIN' ? 'Suporte SAE' : nomeLojista;
          return (
            <Fragment key={mensagem.id}>
              {novoDia && (
                <div className="flex justify-center py-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                    {rotuloDia(mensagem.criadoEm)}
                  </span>
                </div>
              )}
              <BalaoMensagem
                mensagem={mensagem}
                minha={minha}
                autor={autor}
                cor={cor}
                urlAudio={`${baseUrl}/mensagens/${mensagem.id}/audio`}
              />
            </Fragment>
          );
        })}
        {todas.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Nenhuma mensagem ainda.</p>
        )}
      </div>

      {gravador.erro && (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-300">
          {gravador.erro}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 sm:p-4">
        {gravador.gravando ? (
          <>
            <button
              type="button"
              onClick={gravador.cancelar}
              aria-label="Descartar gravação"
              title="Descartar"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <Trash2 size={22} aria-hidden="true" />
            </button>
            <div className="flex h-12 flex-1 items-center gap-3 rounded-2xl bg-red-50 px-4 dark:bg-red-900/20">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
              <span className="font-mono text-base font-semibold text-red-700 dark:text-red-300">
                {formatarCronometro(gravador.segundos)}
              </span>
              <span className="truncate text-sm text-red-600/80 dark:text-red-300/70">
                Gravando... (máx. {formatarCronometro(DURACAO_MAX_SEGUNDOS)})
              </span>
            </div>
          </>
        ) : (
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem"
            rows={1}
            maxLength={4000}
            className={`min-h-12 flex-1 resize-none rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-900 outline-none transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${estilo.foco}`}
          />
        )}

        {gravador.gravando || !texto.trim() ? (
          <button
            type="button"
            onClick={gravador.gravando ? concluirGravacao : gravador.iniciar}
            disabled={enviando || (!gravador.gravando && !gravador.suportado)}
            aria-label={gravador.gravando ? 'Enviar áudio' : 'Gravar áudio'}
            title={
              gravador.gravando ? 'Enviar áudio' : gravador.suportado ? 'Gravar áudio' : 'Gravação de áudio não suportada neste navegador'
            }
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilo.botao}`}
          >
            {enviando ? (
              <Loader2 size={22} className="animate-spin" aria-hidden="true" />
            ) : gravador.gravando ? (
              <Send size={20} aria-hidden="true" />
            ) : (
              <Mic size={22} aria-hidden="true" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={enviarTexto}
            disabled={enviando}
            aria-label="Enviar mensagem"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${estilo.botao}`}
          >
            {enviando ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <Send size={20} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}
