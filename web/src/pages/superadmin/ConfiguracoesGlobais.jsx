import { useEffect, useState } from 'react';
import { SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

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
 * Aba/rota "Configurações Globais" (Painel Master, rota
 * `/supra-admin/configuracoes`) - os precos daqui NAO sao so um mock
 * visual: persistem em `ConfiguracaoGlobal` (schema.prisma) e Modulos.jsx
 * de TODA empresa le esse mesmo valor via `GET /configuracoes/precos` -
 * mudar um preco aqui reflete pra todo mundo na hora (proximo F5/reload de
 * Modulos.jsx, sem cache local). Extraida de SupraAdmin.jsx pro Painel
 * Master - etapa 1 (2026-09-23), mesma logica de antes, so virou uma rota
 * propria.
 */
export default function ConfiguracoesGlobais() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <SlidersHorizontal size={28} className="shrink-0 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          Configurações Globais
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Preços base cobrados de toda empresa cliente pelos módulos pagos.
        </p>
      </div>

      {precos === null ? (
        erro ? (
          <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        ) : (
          <p className="text-lg text-slate-400 dark:text-slate-500">Carregando...</p>
        )
      ) : (
        <form
          onSubmit={handleSalvar}
          className="max-w-2xl space-y-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-8"
        >
          <p className="text-base text-slate-500 dark:text-slate-400">
            Refletem na página Módulos de todo mundo assim que salvos aqui.
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
      )}
    </div>
  );
}
