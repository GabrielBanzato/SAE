import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '../../../services/api';

/**
 * Player de uma mensagem de audio. A rota do audio exige o token JWT, e
 * `<audio src>` nao consegue mandar header Authorization - entao o arquivo
 * e baixado via axios (interceptor ja injeta o token), vira um blob URL
 * local e so entao alimenta o `<audio controls>`. O blob URL e revogado ao
 * desmontar (libera a memoria).
 */
export default function AudioMensagem({ url }) {
  const [src, setSrc] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    let objectUrl = null;

    api
      .get(url, { responseType: 'blob' })
      .then(({ data }) => {
        if (!ativo) return;
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      })
      .catch((err) => {
        if (ativo) setErro(err.response?.status === 410 ? 'Áudio indisponível no servidor.' : 'Não foi possível carregar o áudio.');
      });

    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (erro) {
    return (
      <span className="flex items-center gap-1.5 text-sm opacity-80">
        <AlertCircle size={16} aria-hidden="true" />
        {erro}
      </span>
    );
  }

  if (!src) {
    return (
      <span className="flex h-10 w-56 items-center gap-2 text-sm opacity-70">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Carregando áudio...
      </span>
    );
  }

  return <audio controls preload="metadata" src={src} className="h-10 w-60 max-w-full sm:w-72" />;
}
