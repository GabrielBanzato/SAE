import { useEffect, useState } from 'react';
import { X, CheckCircle2, XCircle, Gift, Ban, Loader2, Clock } from 'lucide-react';
import { apiFetch } from '../../services/api';

/** Rotulo/descricao de cada modulo do catalogo - mesmo catalogo de MODULOS_VALIDOS (api/src/services/auth.service.js), so pra exibicao aqui. */
const NOME_MODULO = {
  vendas: 'Vendas',
  financeiro: 'Financeiro',
  produtos: 'Produtos',
  precificacao: 'Precificação',
  estoque_avancado: 'Estoque Avançado',
  agenda: 'Agenda',
  relatorios: 'Relatórios',
  pdv_touch: 'Frente de Loja (PDV)',
  clientes: 'CRM e Perfil 360',
  tarefas: 'Gestão de Equipe/Kanban',
  ia_whatsapp: 'Inbox de Inteligência Artificial',
};

const PLANOS_IA_WHATSAPP = [
  { chave: 'whatsapp_web', nome: 'Conexão Alternativa (WhatsApp Web)' },
  { chave: 'meta_api', nome: 'Conexão Oficial (API Meta)' },
];

const TITULO_SECAO = {
  base: 'Módulos Base (sempre incluídos)',
  legado: 'Módulos Inclusos no Cadastro',
  pago: 'Módulos Pagos',
};

function formatarData(valor) {
  return valor ? new Date(valor).toLocaleDateString('pt-BR') : '-';
}

function BadgeStatus({ status }) {
  const estilos = {
    EM_DIA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ATRASADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    SEM_ACESSO: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };
  const rotulo = { EM_DIA: 'Em dia', ATRASADO: 'Atrasado', SEM_ACESSO: 'Sem acesso' };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${estilos[status]}`}>
      {status === 'ATRASADO' && <Clock size={12} aria-hidden="true" />}
      {rotulo[status]}
    </span>
  );
}

/** Linha de um modulo PAGO - a unica categoria com info financeira e acoes (Liberar Gratuitamente/Restringir). */
function LinhaModuloPago({ assinatura, processando, onLiberar, onRestringir }) {
  const [planoIa, setPlanoIa] = useState('whatsapp_web');
  const ehWhatsapp = assinatura.chave === 'ia_whatsapp';

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">{NOME_MODULO[assinatura.chave]}</p>
          {assinatura.ativo ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} aria-hidden="true" />
              Ativo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 dark:text-slate-500">
              <XCircle size={14} aria-hidden="true" />
              Inativo
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <BadgeStatus status={assinatura.status} />
          {assinatura.pago && (
            <span className="text-xs text-slate-500 dark:text-slate-400">Próximo vencimento: {formatarData(assinatura.proximoVencimento)}</span>
          )}
          {ehWhatsapp && assinatura.planoIa && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ({PLANOS_IA_WHATSAPP.find((p) => p.chave === assinatura.planoIa)?.nome})
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {processando ? (
          <Loader2 size={18} className="animate-spin text-slate-400" aria-hidden="true" />
        ) : (
          <>
            {ehWhatsapp && (
              <select
                value={planoIa}
                onChange={(event) => setPlanoIa(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                {PLANOS_IA_WHATSAPP.map((plano) => (
                  <option key={plano.chave} value={plano.chave}>
                    {plano.nome}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onLiberar(assinatura.chave, ehWhatsapp ? planoIa : undefined)}
              title="Liberar Gratuitamente"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <Gift size={14} aria-hidden="true" />
              Liberar Gratuitamente
            </button>
            {assinatura.pago && (
              <button
                type="button"
                onClick={() => onRestringir(assinatura.chave)}
                title="Restringir"
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-red-300 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Ban size={14} aria-hidden="true" />
                Restringir
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Linha de um modulo BASE ou LEGADO - so leitura, sem info financeira (nunca tiveram preco/cobranca). */
function LinhaModuloSimples({ chave, ativo, semToggle }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
      <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{NOME_MODULO[chave]}</p>
      {semToggle ? (
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Sempre incluso</span>
      ) : ativo ? (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={14} aria-hidden="true" />
          Ativo
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 dark:text-slate-500">
          <XCircle size={14} aria-hidden="true" />
          Inativo
        </span>
      )}
    </div>
  );
}

/**
 * "Gestão Detalhada de Assinaturas" (Painel Master - Etapa 2, 2026-09-23) -
 * substitui o antigo `ModalGerenciarAssinatura` (dropdown de 1 modulo por
 * vez) por uma visão completa de TODOS os módulos do catálogo pra uma
 * empresa, cada um com seu próprio indicador de acesso - e, pros módulos
 * pagos, status de cobrança (`EM_DIA`/`ATRASADO`/`SEM_ACESSO`, derivado em
 * `empresaService.calcularStatusPagamento`) + próxima data de vencimento +
 * os 2 controles manuais (Liberar Gratuitamente/Restringir).
 *
 * Carrega os dados na abertura via `GET /superadmin/empresas/:id/assinaturas`
 * (não vem junto de `GET /superadmin/empresas` - custo desnecessário
 * calcular isso pra TODA empresa da tabela quando só uma está sendo
 * detalhada por vez).
 */
export default function ModalAssinaturas({ empresa, onFechar, onAtualizado }) {
  const [assinaturas, setAssinaturas] = useState(null);
  const [erro, setErro] = useState('');
  const [processandoChave, setProcessandoChave] = useState(null);

  function carregar() {
    apiFetch(`/superadmin/empresas/${empresa.id}/assinaturas`)
      .then(setAssinaturas)
      .catch((err) => setErro(err.message || 'Não foi possível carregar as assinaturas.'));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa.id]);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !processandoChave) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, processandoChave]);

  async function liberarGratuitamente(modulo, planoIa) {
    setErro('');
    setProcessandoChave(modulo);
    try {
      await apiFetch(`/superadmin/empresas/${empresa.id}/pagamentos`, {
        method: 'PUT',
        body: JSON.stringify({ modulo, plano_ia: planoIa }),
      });
      carregar();
      onAtualizado?.();
    } catch (err) {
      setErro(err.message || 'Não foi possível liberar este módulo.');
    } finally {
      setProcessandoChave(null);
    }
  }

  async function restringir(modulo) {
    setErro('');
    setProcessandoChave(modulo);
    try {
      await apiFetch(`/superadmin/empresas/${empresa.id}/pagamentos/${modulo}`, { method: 'DELETE' });
      carregar();
      onAtualizado?.();
    } catch (err) {
      setErro(err.message || 'Não foi possível restringir este módulo.');
    } finally {
      setProcessandoChave(null);
    }
  }

  const porTipo = assinaturas
    ? { base: assinaturas.filter((a) => a.tipo === 'base'), legado: assinaturas.filter((a) => a.tipo === 'legado'), pago: assinaturas.filter((a) => a.tipo === 'pago') }
    : null;

  return (
    <div
      // z-[60] (nao z-40, como os outros modais do app) - a sidebar do
      // Painel Master (SupraAdminLayout.jsx) usa z-50, e este modal e mais
      // largo (max-w-2xl) que os modais comuns do app - num viewport medio,
      // um `fixed inset-0` centralizado na tela INTEIRA (nao so na area de
      // conteudo, que ja tem margem pra sidebar) comeca antes do fim da
      // sidebar, entao com z-40 ela ficava por cima, cortando as primeiras
      // letras de cada linha. Achado testando visualmente (ver
      // NOTAS_IMPORTANTES.md).
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !processandoChave && onFechar()}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-assinaturas"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-modal-assinaturas" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Gestão de Assinaturas
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{empresa.nomeLoja || empresa.razaoSocial}</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={Boolean(processandoChave)}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {erro && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        )}

        {assinaturas === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
            <Loader2 size={24} className="animate-spin" aria-hidden="true" />
            Carregando...
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {['pago', 'legado', 'base'].map((tipo) => (
              <div key={tipo}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {TITULO_SECAO[tipo]}
                </p>
                <div className="space-y-2">
                  {porTipo[tipo].map((assinatura) =>
                    tipo === 'pago' ? (
                      <LinhaModuloPago
                        key={assinatura.chave}
                        assinatura={assinatura}
                        processando={processandoChave === assinatura.chave}
                        onLiberar={liberarGratuitamente}
                        onRestringir={restringir}
                      />
                    ) : (
                      <LinhaModuloSimples
                        key={assinatura.chave}
                        chave={assinatura.chave}
                        ativo={assinatura.ativo}
                        semToggle={tipo === 'base'}
                      />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
