import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

// Evento global pra "so um audio tocando por vez" (comportamento do
// WhatsApp) - quem da play avisa os outros players da pagina pra pausarem.
const EVENTO_PLAY = 'sae:audio-play';

function formatarTempo(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) return '0:00';
  const total = Math.floor(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Player de audio customizado pros baloes do chat (substitui o
 * `<audio controls>` nativo, que renderiza uma caixa branca/cinza do
 * navegador e quebra o visual dos baloes coloridos/escuros).
 *
 * COR SEM PROPS: tudo e desenhado com `currentColor` (`text-current`,
 * `bg-current/30`...), entao o player herda a cor do TEXTO do balao onde
 * esta: branco nos baloes roxo/azul, escuro no balao claro, claro no balao
 * escuro do dark mode. (Um `bg-white/30` fixo sumiria no balao claro.)
 *
 * - `<audio>` continua na arvore (e ele que toca), so escondido (`hidden`).
 * - Barra de progresso: um `<input type="range">` invisivel por cima da
 *   barra desenhada - ganha arrastar/clicar/teclado (setas) e
 *   acessibilidade de graca, sem reimplementar pointer events.
 * - Correcao do "Infinity": audio webm gravado pelo MediaRecorder do
 *   Chrome nao traz a duracao no cabecalho (`duration === Infinity` ate o
 *   arquivo ser lido inteiro). Truque padrao: pular pro fim uma vez pra
 *   forcar o navegador a calcular a duracao real, e voltar pro inicio.
 */
export default function CustomAudioPlayer({ src }) {
  const audioRef = useRef(null);
  const corrigindoDuracaoRef = useRef(false);

  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [pronto, setPronto] = useState(false);

  // Pausa este player quando OUTRO comecar a tocar.
  useEffect(() => {
    function aoOutroTocar(evento) {
      if (evento.detail !== audioRef.current) audioRef.current?.pause();
    }
    window.addEventListener(EVENTO_PLAY, aoOutroTocar);
    return () => window.removeEventListener(EVENTO_PLAY, aoOutroTocar);
  }, []);

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (audio.duration === Infinity || Number.isNaN(audio.duration)) {
      corrigindoDuracaoRef.current = true;
      audio.currentTime = 1e101; // forca o calculo da duracao real
      return;
    }
    setDuracao(audio.duration);
    setPronto(true);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (corrigindoDuracaoRef.current) {
      // Chegou ao fim "virtual" - agora a duracao real e conhecida.
      corrigindoDuracaoRef.current = false;
      audio.currentTime = 0;
      setDuracao(audio.duration);
      setPronto(true);
      return;
    }
    setAtual(audio.currentTime);
  }

  function handleDurationChange() {
    const audio = audioRef.current;
    if (Number.isFinite(audio.duration) && !corrigindoDuracaoRef.current) setDuracao(audio.duration);
  }

  function alternar() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent(EVENTO_PLAY, { detail: audio }));
      audio.play().catch(() => setTocando(false));
    } else {
      audio.pause();
    }
  }

  function buscar(event) {
    const audio = audioRef.current;
    const valor = Number(event.target.value);
    if (!audio || !Number.isFinite(valor)) return;
    audio.currentTime = valor;
    setAtual(valor);
  }

  const progresso = duracao > 0 ? Math.min(100, (atual / duracao) * 100) : 0;

  return (
    <div className="flex w-60 max-w-full items-center gap-3 sm:w-72">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        hidden
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setAtual(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
      />

      <button
        type="button"
        onClick={alternar}
        disabled={!pronto}
        aria-label={tocando ? 'Pausar áudio' : 'Reproduzir áudio'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-current/20 transition-colors hover:bg-current/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-wait disabled:opacity-60"
      >
        {!pronto ? (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        ) : tocando ? (
          <Pause size={18} className="fill-current" aria-hidden="true" />
        ) : (
          <Play size={18} className="ml-0.5 fill-current" aria-hidden="true" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Barra desenhada + range invisivel por cima (interacao/teclado/leitor de tela). */}
        <div className="group relative h-4">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-current/30">
            <div className="h-full rounded-full bg-current" style={{ width: `${progresso}%` }} />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current shadow transition-transform group-hover:scale-125"
            style={{ left: `${progresso}%` }}
            aria-hidden="true"
          />
          <input
            type="range"
            min={0}
            max={duracao || 0}
            step={0.01}
            value={atual}
            onChange={buscar}
            disabled={!pronto}
            aria-label="Posição do áudio"
            aria-valuetext={`${formatarTempo(atual)} de ${formatarTempo(duracao)}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
          />
        </div>

        <span className="text-xs tabular-nums opacity-80">
          {formatarTempo(atual)} / {formatarTempo(duracao)}
        </span>
      </div>
    </div>
  );
}
