import { useEffect, useState } from 'react';
import { X, TrendingUp, Receipt, CalendarClock, History, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { dataCalendario } from '../../utils/datas';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// `Venda.data` e um campo "so calendario" (sem hora - ver comentario no
// schema.prisma), mesmo padrao de `dataVencimento` - precisa do mesmo
// truque de `dataCalendario()` que HistoricoVendas.jsx/ModalDetalhesVenda.jsx
// ja usam, senao o dia exibido desloca em fusos atras de UTC (ex.: Brasilia).
function formatarData(valor) {
  return dataCalendario(valor).toLocaleDateString('pt-BR');
}

// Chaves precisam bater com STATUS_CRM_VALIDOS em
// api/src/services/clientes.service.js.
const STATUS_CRM_OPCOES = ['Lead', 'Em Negociação', 'Cliente Ativo', 'Inativo'];

// Mesma classificacao de 3 vias que o backend calcula
// (`classificarStatusVenda` em clientes.service.js) - so o rotulo/cor de
// exibicao mora aqui, espelhando ROTULOS_FORMA_PAGAMENTO/StatusVenda de
// HistoricoVendas.jsx (duplicado ali tambem - mesmo padrao ja aceito no
// projeto pra esse tipo de badge pequeno, especifico de cada tela).
const STATUS_VENDA = {
  PAGO: { rotulo: 'Pago', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  PENDENTE: { rotulo: 'Pendente', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  CONSUMO_DOACAO: { rotulo: 'Consumo/Doação', classes: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

function CardMetrica({ icon: Icon, cor, titulo, valor, legenda }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
      <div className={`flex items-center gap-2 ${cor}`}>
        <Icon size={20} aria-hidden="true" />
        <span className="text-sm font-semibold">{titulo}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">{valor}</p>
      {legenda && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{legenda}</p>}
    </div>
  );
}

/**
 * Perfil 360 do cliente - modal (nao pagina dedicada) de proposito: mesma
 * arquitetura ja usada pro caso mais proximo do app (ver detalhes de uma
 * Venda -> `ModalDetalhesVenda.jsx`, aberto a partir de uma linha de
 * tabela) - "ver o perfil de um cliente" e o mesmo tipo de interacao,
 * "ver mais sobre esta linha", sem justificar uma rota propria.
 *
 * Busca `GET /clientes/:id/perfil-360` (LTV, ticket medio, ultima compra,
 * historico) ao montar. O `<select>` de status do funil (`statusCrm`) e
 * atualizacao otimista - muda a UI na hora e reverte sozinho se o
 * `PUT /clientes/:id` falhar (nao trava esperando o servidor responder pra
 * um clique tao simples quanto trocar um status).
 */
export default function ModalPerfil360({ clienteId, onFechar }) {
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [statusCrm, setStatusCrm] = useState('');
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [erroStatus, setErroStatus] = useState('');
  const [statusSalvo, setStatusSalvo] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch(`/clientes/${clienteId}/perfil-360`)
      .then((dados) => {
        if (ativo) {
          setPerfil(dados);
          setStatusCrm(dados.cliente.statusCrm);
        }
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar o perfil do cliente.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [clienteId]);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar]);

  async function handleAlterarStatus(event) {
    const novoStatus = event.target.value;
    const statusAnterior = statusCrm;

    setStatusCrm(novoStatus); // otimista - a troca no <select> ja reflete na hora
    setErroStatus('');
    setStatusSalvo(false);
    setSalvandoStatus(true);

    try {
      await apiFetch(`/clientes/${clienteId}`, {
        method: 'PUT',
        body: JSON.stringify({ status_crm: novoStatus }),
      });
      setStatusSalvo(true);
      setTimeout(() => setStatusSalvo(false), 2500);
    } catch (err) {
      setStatusCrm(statusAnterior); // reverte - o PUT nao foi confirmado
      setErroStatus(err.message || 'Não foi possível atualizar o status.');
    } finally {
      setSalvandoStatus(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-perfil-360"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-perfil-360" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {carregando ? 'Perfil do Cliente' : perfil?.cliente.nome}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {carregando && <p className="mt-8 py-6 text-center text-lg text-slate-500 dark:text-slate-400">Carregando perfil...</p>}

        {!carregando && erro && (
          <p className="mt-6 rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        )}

        {!carregando && perfil && (
          <>
            {/* Status do funil (CRM) */}
            <div className="mt-6 rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30">
              <label className="block">
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Status no Funil (CRM)</span>
                <div className="mt-2 flex items-center gap-3">
                  <select
                    value={statusCrm}
                    onChange={handleAlterarStatus}
                    disabled={salvandoStatus}
                    className="w-full rounded-xl border-2 border-blue-300 bg-white px-4 py-2.5 text-base font-bold text-blue-800 outline-none transition-all focus:border-blue-500 disabled:opacity-60 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:focus:border-blue-400"
                  >
                    {STATUS_CRM_OPCOES.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </select>
                  {salvandoStatus && (
                    <span className="shrink-0 text-sm font-medium text-blue-600 dark:text-blue-400">Salvando...</span>
                  )}
                  {statusSalvo && (
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      Salvo
                    </span>
                  )}
                </div>
              </label>
              {erroStatus && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{erroStatus}</p>}
            </div>

            {/* Cards de metrica */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CardMetrica
                icon={TrendingUp}
                cor="text-emerald-700 dark:text-emerald-400"
                titulo="LTV (Total Pago)"
                valor={formatarMoeda(perfil.ltv)}
              />
              <CardMetrica
                icon={Receipt}
                cor="text-blue-700 dark:text-blue-400"
                titulo="Ticket Médio"
                valor={formatarMoeda(perfil.ticketMedio)}
              />
              <CardMetrica
                icon={CalendarClock}
                cor="text-purple-700 dark:text-purple-400"
                titulo="Última Compra"
                valor={perfil.ultimaCompra ? formatarData(perfil.ultimaCompra) : '—'}
                legenda={!perfil.ultimaCompra ? 'Nenhuma compra paga ainda' : undefined}
              />
            </div>

            {/* Historico de vendas */}
            <div className="mt-6">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <History size={18} aria-hidden="true" />
                <h3 className="text-base font-bold uppercase tracking-wide">Histórico de Compras</h3>
              </div>

              {perfil.historicoVendas.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-base text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                  Este cliente ainda não tem nenhuma venda registrada.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
                  {perfil.historicoVendas.map((venda) => {
                    const status = STATUS_VENDA[venda.status] ?? STATUS_VENDA.PENDENTE;
                    return (
                      <li key={venda.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {formatarData(venda.data)}
                          </p>
                          <span
                            className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${status.classes}`}
                          >
                            {status.rotulo}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                          {formatarMoeda(venda.total)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl bg-slate-100 px-5 py-2.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
