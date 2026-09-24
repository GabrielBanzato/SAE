import AudioMensagem from './AudioMensagem';
import { formatarHora } from '../tempo';

/**
 * Balao de mensagem estilo WhatsApp - `minha` (enviada por quem esta
 * vendo) fica a direita, colorida; a do outro lado a esquerda, neutra.
 * `cor` diferencia as pontas: azul no app do lojista, roxo no Painel Master
 * (mesma identidade visual de cada area).
 */
const CORES_MINHA = {
  azul: 'bg-blue-600 text-white rounded-br-md',
  roxo: 'bg-purple-600 text-white rounded-br-md',
};

export default function BalaoMensagem({ mensagem, minha, autor, urlAudio, cor = 'azul' }) {
  return (
    <div className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[70%] ${
          minha
            ? CORES_MINHA[cor]
            : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
        }`}
      >
        {!minha && autor && (
          <p className="mb-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">{autor}</p>
        )}

        {mensagem.tipoMensagem === 'AUDIO' ? (
          <AudioMensagem url={urlAudio} />
        ) : (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{mensagem.conteudo}</p>
        )}

        <p className={`mt-1 text-right text-[11px] ${minha ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
          {formatarHora(mensagem.criadoEm)}
        </p>
      </div>
    </div>
  );
}
