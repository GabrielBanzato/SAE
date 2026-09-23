import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Building2,
  Headset,
  SlidersHorizontal,
  Ban,
  Power,
  Gift,
  CreditCard,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { apiFetch } from '../services/api';

const ABAS = [
  { chave: 'empresas', label: 'Empresas/Clientes', icon: Building2 },
  { chave: 'chamados', label: 'Chamados de Suporte', icon: Headset },
  { chave: 'configuracoes', label: 'Configurações Globais', icon: SlidersHorizontal },
];

function formatarData(valor) {
  return new Date(valor).toLocaleDateString('pt-BR');
}

/** Catalogo dos modulos pagos pro select do modal "Gerenciar Assinaturas" - mesmas chaves de MODULOS_PAGOS (empresa.service.js). */
const MODULOS_PAGOS_INFO = [
  { chave: 'pdv_touch', nome: 'Frente de Loja (PDV)' },
  { chave: 'clientes', nome: 'CRM e Perfil 360' },
  { chave: 'tarefas', nome: 'Gestão de Equipe/Kanban' },
  {
    chave: 'ia_whatsapp',
    nome: 'Inbox de Inteligência Artificial',
    planos: [
      { chave: 'whatsapp_web', nome: 'Conexão Alternativa (WhatsApp Web)' },
      { chave: 'meta_api', nome: 'Conexão Oficial (API Meta)' },
    ],
  },
];

/**
 * "Gerenciar Assinaturas" (aba Empresas/Clientes) - forca a ativacao de um
 * modulo pago pra uma empresa especifica, sem ela precisar passar pelo
 * checkout simulado (mesmo endpoint que `ModalPagamento.jsx` usa,
 * `PUT /.../pagamentos`, so que aqui o Supra Admin escolhe o alvo).
 */
function ModalGerenciarAssinatura({ empresa, onFechar, onConfirmar }) {
  const [moduloSelecionado, setModuloSelecionado] = useState(MODULOS_PAGOS_INFO[0].chave);
  const [planoIa, setPlanoIa] = useState('whatsapp_web');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const moduloInfo = MODULOS_PAGOS_INFO.find((modulo) => modulo.chave === moduloSelecionado);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !salvando) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, salvando]);

  async function handleConfirmar() {
    setErro('');
    setSalvando(true);
    try {
      await onConfirmar({
        modulo: moduloSelecionado,
        planoIa: moduloSelecionado === 'ia_whatsapp' ? planoIa : undefined,
      });
    } catch (err) {
      setErro(err.message || 'Não foi possível liberar o módulo.');
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !salvando && onFechar()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-assinatura"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-assinatura" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Gerenciar Assinatura
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{empresa.nomeLoja || empresa.razaoSocial}</p>

        <label className="mt-6 block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Módulo</span>
          <select
            value={moduloSelecionado}
            onChange={(event) => setModuloSelecionado(event.target.value)}
            className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 text-base font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
          >
            {MODULOS_PAGOS_INFO.map((modulo) => (
              <option key={modulo.chave} value={modulo.chave}>
                {modulo.nome}
              </option>
            ))}
          </select>
        </label>

        {moduloInfo.planos && (
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Plano</span>
            <select
              value={planoIa}
              onChange={(event) => setPlanoIa(event.target.value)}
              className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 text-base font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
            >
              {moduloInfo.planos.map((plano) => (
                <option key={plano.chave} value={plano.chave}>
                  {plano.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        {erro && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="rounded-xl px-5 py-2.5 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-base font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}
            Liberar Módulo
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Aba "Empresas/Clientes" - tabela com TODAS as empresas cadastradas (unica
 * tela do app que le dados fora do proprio tenant, por design - protegida
 * pelo hook SUPERADMIN em superadmin.routes.js). Acoes: suspender/reativar
 * acesso, tornar/remover doador, gerenciar assinaturas.
 */
function AbaEmpresas() {
  const [empresas, setEmpresas] = useState(null);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);
  const [empresaAssinatura, setEmpresaAssinatura] = useState(null);

  function carregar() {
    apiFetch('/superadmin/empresas')
      .then(setEmpresas)
      .catch((err) => setErro(err.message || 'Não foi possível carregar as empresas.'));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alternarStatus(empresa) {
    setErro('');
    setProcessandoId(empresa.id);
    try {
      await apiFetch(`/superadmin/empresas/${empresa.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ ativo: !empresa.ativo }),
      });
      carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar o status desta empresa.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function alternarDoador(empresa) {
    setErro('');
    setProcessandoId(empresa.id);
    try {
      await apiFetch(`/superadmin/empresas/${empresa.id}/doador`, {
        method: 'PUT',
        body: JSON.stringify({ is_doador: !empresa.isDoador }),
      });
      carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar o status de doador.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function confirmarAssinatura({ modulo, planoIa }) {
    await apiFetch(`/superadmin/empresas/${empresaAssinatura.id}/pagamentos`, {
      method: 'PUT',
      body: JSON.stringify({ modulo, plano_ia: planoIa }),
    });
    setEmpresaAssinatura(null);
    carregar();
  }

  if (empresas === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
        <Loader2 size={24} className="animate-spin" aria-hidden="true" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Empresa
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Segmento
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Usuários
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Doador
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {empresas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-lg text-slate-500 dark:text-slate-400">
                    Nenhuma empresa cadastrada.
                  </td>
                </tr>
              )}

              {empresas.map((empresa) => {
                const processando = processandoId === empresa.id;
                return (
                  <tr key={empresa.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30">
                    <td className="px-6 py-4">
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {empresa.nomeLoja || empresa.razaoSocial}
                      </p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">{empresa.documento}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{empresa.segmento}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{empresa.totalUsuarios}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          empresa.ativo
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        }`}
                      >
                        {empresa.ativo ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {empresa.isDoador && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          <Gift size={12} aria-hidden="true" />
                          Doador
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {processando ? (
                          <Loader2 size={18} className="animate-spin text-slate-400" aria-hidden="true" />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => alternarStatus(empresa)}
                              title={empresa.ativo ? 'Suspender Acesso' : 'Reativar Acesso'}
                              className={`rounded-lg p-2 transition-colors ${
                                empresa.ativo
                                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                              }`}
                            >
                              {empresa.ativo ? (
                                <Ban size={16} aria-hidden="true" />
                              ) : (
                                <Power size={16} aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => alternarDoador(empresa)}
                              title={empresa.isDoador ? 'Remover status de Doador' : 'Tornar Doador'}
                              className={`rounded-lg p-2 transition-colors ${
                                empresa.isDoador
                                  ? 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Gift size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmpresaAssinatura(empresa)}
                              title="Gerenciar Assinaturas"
                              className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              <CreditCard size={16} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {empresaAssinatura && (
        <ModalGerenciarAssinatura
          empresa={empresaAssinatura}
          onFechar={() => setEmpresaAssinatura(null)}
          onConfirmar={confirmarAssinatura}
        />
      )}
    </div>
  );
}

/** Aba "Chamados de Suporte" - todos os chamados abertos pelos clientes (pages/Suporte.jsx), com nome da empresa junto. */
function AbaChamados() {
  const [chamados, setChamados] = useState(null);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);

  function carregar() {
    apiFetch('/superadmin/chamados')
      .then(setChamados)
      .catch((err) => setErro(err.message || 'Não foi possível carregar os chamados.'));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alternarStatus(chamado) {
    setErro('');
    setProcessandoId(chamado.id);
    try {
      const novoStatus = chamado.status === 'ABERTO' ? 'RESOLVIDO' : 'ABERTO';
      await apiFetch(`/superadmin/chamados/${chamado.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: novoStatus }),
      });
      carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar este chamado.');
    } finally {
      setProcessandoId(null);
    }
  }

  if (chamados === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
        <Loader2 size={24} className="animate-spin" aria-hidden="true" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {chamados.length === 0 ? (
        <p className="rounded-3xl bg-white p-10 text-center text-lg text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          Nenhum chamado de suporte aberto.
        </p>
      ) : (
        <div className="space-y-3">
          {chamados.map((chamado) => {
            const processando = processandoId === chamado.id;
            return (
              <div
                key={chamado.id}
                className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100">{chamado.titulo}</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      {chamado.empresa?.nomeLoja || chamado.empresa?.razaoSocial} - {formatarData(chamado.criadoEm)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ${
                      chamado.status === 'ABERTO'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}
                  >
                    {chamado.status === 'ABERTO' ? 'Aberto' : 'Resolvido'}
                  </span>
                </div>

                {chamado.descricao && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{chamado.descricao}</p>
                )}

                <button
                  type="button"
                  onClick={() => alternarStatus(chamado)}
                  disabled={processando}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {processando ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  )}
                  {chamado.status === 'ABERTO' ? 'Marcar como Resolvido' : 'Reabrir Chamado'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CAMPOS_PRECO_SIMPLES = [
  { chave: 'pdv_touch', label: 'Frente de Loja (PDV)' },
  { chave: 'clientes', label: 'CRM e Perfil 360' },
  { chave: 'tarefas', label: 'Gestão de Equipe/Kanban' },
  { chave: 'notas_fiscais', label: 'Emissão de Notas Fiscais (estimativa)' },
];

function CampoPreco({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-4 py-2.5 focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-blue-400">
        <span className="text-slate-400 dark:text-slate-500">R$</span>
        <input
          type="number"
          step="0.10"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none dark:text-slate-100"
        />
        <span className="text-sm text-slate-400 dark:text-slate-500">/mês</span>
      </div>
    </label>
  );
}

/**
 * Aba "Configurações Globais" - os precos daqui NAO sao so um mock visual:
 * persistem em `ConfiguracaoGlobal` (schema.prisma) e Modulos.jsx de TODA
 * empresa le esse mesmo valor via `GET /configuracoes/precos` - mudar um
 * preco aqui reflete pra todo mundo na hora (proximo F5/reload de
 * Modulos.jsx, sem cache local).
 */
function AbaConfiguracoes() {
  const [precos, setPrecos] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    apiFetch('/superadmin/configuracoes/precos')
      .then(setPrecos)
      .catch((err) => setErro(err.message || 'Não foi possível carregar os preços.'));
  }, []);

  function handleChange(chave, valor) {
    setPrecos((atual) => ({ ...atual, [chave]: valor }));
    setSalvo(false);
  }

  function handleChangeIa(chave, valor) {
    setPrecos((atual) => ({ ...atual, ia_whatsapp: { ...atual.ia_whatsapp, [chave]: valor } }));
    setSalvo(false);
  }

  async function handleSalvar(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const atualizados = await apiFetch('/superadmin/configuracoes/precos', {
        method: 'PUT',
        body: JSON.stringify({
          pdv_touch: Number(precos.pdv_touch),
          clientes: Number(precos.clientes),
          tarefas: Number(precos.tarefas),
          notas_fiscais: Number(precos.notas_fiscais),
          ia_whatsapp: {
            whatsapp_web: Number(precos.ia_whatsapp.whatsapp_web),
            meta_api: Number(precos.ia_whatsapp.meta_api),
          },
        }),
      });
      setPrecos(atualizados);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar os preços.');
    } finally {
      setSalvando(false);
    }
  }

  if (precos === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
        <Loader2 size={24} className="animate-spin" aria-hidden="true" />
        Carregando...
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSalvar}
      className="max-w-2xl space-y-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-8"
    >
      <p className="text-base text-slate-500 dark:text-slate-400">
        Preços base cobrados de toda empresa cliente pelos módulos pagos - refletem na página Módulos de todo mundo
        assim que salvos aqui.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {CAMPOS_PRECO_SIMPLES.map(({ chave, label }) => (
          <CampoPreco key={chave} label={label} value={precos[chave]} onChange={(valor) => handleChange(chave, valor)} />
        ))}
      </div>

      <div className="border-t border-slate-100 pt-5 dark:border-slate-700">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Inbox de Inteligência Artificial
        </p>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <CampoPreco
            label="Conexão Alternativa (WhatsApp Web)"
            value={precos.ia_whatsapp.whatsapp_web}
            onChange={(valor) => handleChangeIa('whatsapp_web', valor)}
          />
          <CampoPreco
            label="Conexão Oficial (API Meta)"
            value={precos.ia_whatsapp.meta_api}
            onChange={(valor) => handleChangeIa('meta_api', valor)}
          />
        </div>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Salvar Preços'}
        </button>
        {salvo && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} aria-hidden="true" />
            Salvo!
          </span>
        )}
      </div>
    </form>
  );
}

/**
 * Painel Supra Admin (2026-09-22, nivel mais alto do sistema) - exclusivo
 * pro dono do software (`usuario.nivelAcesso === 'SUPERADMIN'`, ver gate em
 * App.jsx/Sidebar.jsx). 3 abas simples (botoes, sem lib de tabs) - mesma
 * filosofia "sem dependencia nova pra algo simples" ja usada no Kanban
 * (sem lib de drag-and-drop).
 */
export default function SupraAdmin() {
  const [abaAtiva, setAbaAtiva] = useState('empresas');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <ShieldAlert size={28} className="shrink-0 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          Painel Supra Admin
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">Gestão de todos os clientes da plataforma SAE.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700" role="tablist">
        {ABAS.map(({ chave, label, icon: Icon }) => (
          <button
            key={chave}
            type="button"
            role="tab"
            aria-selected={abaAtiva === chave}
            onClick={() => setAbaAtiva(chave)}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-3 text-base font-bold transition-colors ${
              abaAtiva === chave
                ? 'border-b-2 border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {abaAtiva === 'empresas' && <AbaEmpresas />}
      {abaAtiva === 'chamados' && <AbaChamados />}
      {abaAtiva === 'configuracoes' && <AbaConfiguracoes />}
    </div>
  );
}
