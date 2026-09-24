import { useCallback, useEffect, useRef, useState } from 'react';

export const DURACAO_MAX_SEGUNDOS = 180;

// Ordem de preferencia - Chrome/Edge/Firefox gravam webm/ogg com opus
// (arquivo pequeno); Safari (iOS/macOS) so grava mp4/aac. Todos aceitos
// pela API (MIMES_AUDIO em chatChamado.service.js).
const FORMATOS_PREFERIDOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

function escolherFormato() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return FORMATOS_PREFERIDOS.find((formato) => MediaRecorder.isTypeSupported(formato)) || '';
}

/**
 * Gravacao de audio no navegador via MediaRecorder API (Chat de Suporte,
 * 2026-09-23). `iniciar()` pede permissao do microfone; `finalizar()`
 * resolve com o Blob gravado; `cancelar()` descarta. Corta sozinho em
 * `DURACAO_MAX_SEGUNDOS` (entrega o que gravou ate ali). Sempre libera o
 * microfone (para as tracks) ao terminar/cancelar/desmontar - sem isso o
 * indicador de "microfone em uso" do navegador ficaria aceso.
 *
 * Observacao: getUserMedia so funciona em contexto seguro (HTTPS ou
 * localhost) - em producao o site ja e servido via HTTPS pelo Cloudflare.
 */
export default function useGravadorAudio({ onLimiteAtingido } = {}) {
  // Ref (nao dependencia) - o callback pode mudar a cada render do pai.
  const onLimiteRef = useRef(onLimiteAtingido);
  useEffect(() => {
    onLimiteRef.current = onLimiteAtingido;
  }, [onLimiteAtingido]);

  const suportado =
    typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const pedacosRef = useRef([]);
  const timerRef = useRef(null);
  const resolverRef = useRef(null);

  const liberar = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setGravando(false);
    setSegundos(0);
  }, []);

  useEffect(() => liberar, [liberar]);

  const iniciar = useCallback(async () => {
    setErro('');
    if (!suportado) {
      setErro('Seu navegador não suporta gravação de áudio.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const formato = escolherFormato();
      const recorder = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined);

      streamRef.current = stream;
      recorderRef.current = recorder;
      pedacosRef.current = [];

      recorder.ondataavailable = (evento) => {
        if (evento.data.size > 0) pedacosRef.current.push(evento.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(pedacosRef.current, { type: recorder.mimeType || formato || 'audio/webm' });
        if (resolverRef.current) {
          resolverRef.current(blob);
          resolverRef.current = null;
        } else {
          // Parou sozinho no limite de duracao (ninguem chamou finalizar) -
          // entrega o audio pro pai em vez de descartar o que foi gravado.
          onLimiteRef.current?.(blob);
        }
        liberar();
      };

      recorder.start();
      setGravando(true);
      setSegundos(0);
      let decorridos = 0;
      timerRef.current = setInterval(() => {
        decorridos += 1;
        setSegundos(decorridos);
        if (decorridos >= DURACAO_MAX_SEGUNDOS && recorder.state === 'recording') recorder.stop();
      }, 1000);
      return true;
    } catch (err) {
      liberar();
      setErro(
        err?.name === 'NotAllowedError'
          ? 'Permissão do microfone negada. Libere o microfone nas configurações do navegador.'
          : 'Não foi possível acessar o microfone.'
      );
      return false;
    }
  }, [suportado, liberar]);

  /** Para a gravacao e resolve com o Blob (ou `null` se nao havia gravacao). */
  const finalizar = useCallback(
    () =>
      new Promise((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
          resolve(null);
          return;
        }
        resolverRef.current = resolve;
        recorder.stop();
      }),
    []
  );

  const cancelar = useCallback(() => {
    resolverRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => liberar();
      recorder.stop();
    } else {
      liberar();
    }
  }, [liberar]);

  return { suportado, gravando, segundos, erro, setErro, iniciar, finalizar, cancelar };
}
