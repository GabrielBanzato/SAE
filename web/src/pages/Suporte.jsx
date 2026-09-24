import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, IdCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import FormularioChamado from '../components/suporte/FormularioChamado';
import MeusChamados from '../components/suporte/MeusChamados';
import { formatarVersao } from '../utils/versao';

/**
 * Helpdesk do lojista. Reestruturado em 2026-09-23 - a pagina (antes ~290
 * linhas com formulario + tabela + fetch tudo junto) virou so COMPOSICAO:
 *   - components/suporte/FormularioChamado.jsx - abertura de chamado
 *   - components/suporte/MeusChamados.jsx      - lista (cartoes) com status
 *   - components/suporte/BadgeStatusChamado.jsx + statusChamado.js - catalogo
 *     unico de status, compartilhado com o Supra Admin (ChamadosSuporte.jsx)
 * Base pronta pro chat de suporte (MensagemChamado) entrar como componentes
 * novos dessa mesma pasta, sem inchar a pagina de novo.
 *
 * `codigoUsuario` ("Seu ID"): vem do AuthContext, reidratado por
 * `GET /auth/me` a cada boot (antes so vinha do login, e sessoes antigas
 * ficavam com "-----"). Enquanto a reidratacao nao chega, mostra
 * "Carregando..." em vez de um placeholder que parece um valor.
 */
export default function Suporte() {
  const { usuario } = useAuth();
  const codigoUsuario = usuario?.codigoUsuario ?? null;

  const [chamados, setChamados] = useState(null);
  const [erroLista, setErroLista] = useState('');
  const [carregandoLista, setCarregandoLista] = useState(true);

  // So atualiza estado quando a resposta chega (nunca sincrono) - pode ser
  // chamada direto do efeito de montagem sem render em cascata.
  const buscarChamados = useCallback(() => {
    apiFetch('/chamados')
      .then((dados) => {
        setChamados(dados);
        setErroLista('');
      })
      .catch((err) => {
        setErroLista(err.message || 'Não foi possível carregar seus chamados anteriores.');
        setChamados((atual) => atual ?? []);
      })
      .finally(() => setCarregandoLista(false));
  }, []);

  useEffect(() => {
    buscarChamados();
  }, [buscarChamados]);

  // Recarga manual (botao da lista / depois de enviar um chamado).
  function carregarChamados() {
    setCarregandoLista(true);
    buscarChamados();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
            <LifeBuoy size={30} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Suporte
          </h1>
          <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
            Encontrou um problema ou tem alguma dúvida? Conta pra gente.
          </p>
        </div>

        {/* ID sempre visivel no topo - e o que a equipe de suporte pede primeiro por telefone/WhatsApp. */}
        <div className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
          <IdCard size={24} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600/80 dark:text-blue-300/80">Seu ID</p>
            <p className="font-mono text-xl font-extrabold tracking-widest text-blue-700 dark:text-blue-300">
              {codigoUsuario ?? '…'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-8">
        <FormularioChamado usuario={usuario} codigoUsuario={codigoUsuario} onEnviado={carregarChamados} />
      </div>

      <MeusChamados
        chamados={chamados}
        erro={erroLista}
        carregando={carregandoLista}
        onRecarregar={carregarChamados}
      />

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">Versão do sistema: {formatarVersao()}</p>
    </div>
  );
}
