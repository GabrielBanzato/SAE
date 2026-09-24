import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../services/api';

const INTERVALO_POLLING_MS = 5000;

/** Blob -> base64 puro (sem o prefixo "data:...;base64,"). */
function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

/**
 * Estado + acoes do chat de UM chamado - compartilhado entre o lojista
 * (`baseUrl` = "/chamados/:id") e o Supra Admin ("/superadmin/chamados/:id");
 * a API decide escopo/remetente pela rota (ver chatChamado.controller.js).
 *
 * Polling INCREMENTAL a cada 5s: `GET baseUrl?apos=<ultimoId>` devolve o
 * cabecalho do chamado (status/atualizadoEm, pra refletir mudancas feitas
 * do outro lado) + SO as mensagens novas - nunca rebaixa a conversa
 * inteira. Pausa com a aba do navegador em segundo plano
 * (`document.hidden`) e volta a consultar na hora ao reabrir.
 */
export default function useChamadoChat(baseUrl) {
  const [chamado, setChamado] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ultimoIdRef = useRef(0);

  const mesclarMensagens = useCallback((novas) => {
    if (!novas?.length) return;
    setMensagens((atual) => {
      const ids = new Set(atual.map((m) => m.id));
      const filtradas = novas.filter((m) => !ids.has(m.id));
      return filtradas.length ? [...atual, ...filtradas] : atual;
    });
    ultimoIdRef.current = Math.max(ultimoIdRef.current, ...novas.map((m) => m.id));
  }, []);

  const buscar = useCallback(
    async (incremental) => {
      const url = incremental && ultimoIdRef.current ? `${baseUrl}?apos=${ultimoIdRef.current}` : baseUrl;
      try {
        const { mensagens: novas, ...cabecalho } = await apiFetch(url);
        setChamado(cabecalho);
        mesclarMensagens(novas);
        setErro('');
      } catch (err) {
        setErro(err.message || 'Não foi possível carregar o chamado.');
      }
    },
    [baseUrl, mesclarMensagens]
  );

  useEffect(() => {
    ultimoIdRef.current = 0;
    buscar(false);

    const intervalo = setInterval(() => {
      if (!document.hidden) buscar(true);
    }, INTERVALO_POLLING_MS);
    const aoVoltarParaAba = () => {
      if (!document.hidden) buscar(true);
    };
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  }, [buscar]);

  const enviar = useCallback(
    async (corpo) => {
      setEnviando(true);
      try {
        const { chamado: cabecalho, ...mensagem } = await apiFetch(`${baseUrl}/mensagens`, {
          method: 'POST',
          body: JSON.stringify(corpo),
        });
        mesclarMensagens([mensagem]);
        // Cabecalho (status + ultima alteracao) na hora, sem esperar o
        // proximo polling - inclui a REABERTURA automatica (RESOLVIDO ->
        // ABERTO) que a API faz ao receber mensagem num chamado finalizado.
        setChamado((atual) =>
          atual
            ? { ...atual, status: cabecalho?.status ?? atual.status, atualizadoEm: cabecalho?.atualizadoEm ?? mensagem.criadoEm }
            : atual
        );
        return true;
      } catch (err) {
        setErro(err.message || 'Não foi possível enviar a mensagem.');
        return false;
      } finally {
        setEnviando(false);
      }
    },
    [baseUrl, mesclarMensagens]
  );

  const enviarTexto = useCallback((texto) => enviar({ tipo: 'TEXTO', conteudo: texto }), [enviar]);

  const enviarAudio = useCallback(
    async (blob) => enviar({ tipo: 'AUDIO', mime: blob.type, audio_base64: await blobParaBase64(blob) }),
    [enviar]
  );

  return { chamado, setChamado, mensagens, erro, setErro, enviando, enviarTexto, enviarAudio, recarregar: buscar };
}
