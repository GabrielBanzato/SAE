import { useEffect, useState } from 'react';
import { Building2, Ban, Power, Gift, CreditCard, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import ModalAssinaturas from '../../components/superadmin/ModalAssinaturas';
import ModalDoador from '../../components/superadmin/ModalDoador';

/**
 * Aba/rota "Empresas/Clientes" (Painel Master, rota `/supra-admin/empresas`)
 * - tabela com TODAS as empresas cadastradas (unica tela do app que le
 * dados fora do proprio tenant, por design - protegida pelo hook SUPERADMIN
 * em superadmin.routes.js, e pelo gate de rota em App.jsx). Acoes:
 * suspender/reativar acesso, tornar/remover doador, gerenciar assinaturas.
 *
 * Extraida de SupraAdmin.jsx (que antes reunia as 3 abas num estado local
 * `abaAtiva`) pro Painel Master - etapa 1 (2026-09-23): agora e uma rota de
 * verdade dentro do layout dedicado `SupraAdminLayout`, nao mudou nenhuma
 * logica de negocio, so onde o componente mora.
 *
 * "Gerenciar Assinaturas" abre `ModalAssinaturas` (Painel Master - etapa 2,
 * 2026-09-23) - visao detalhada por modulo (antes era so um dropdown de 1
 * modulo por vez); o modal cuida das proprias chamadas de API, aqui so
 * abre/fecha e reusa `carregar()` como callback de "algo mudou".
 *
 * "Doador" abre `ModalDoador` (Painel Master - etapa 3, 2026-09-23) -
 * antes o icone de presente virava/desvirava o status na hora, sem
 * confirmacao nem detalhe (valor, ha quanto tempo, vencimento) - mesmo
 * padrao autocontido do `ModalAssinaturas` (o modal cuida das proprias
 * chamadas de API).
 */
export default function EmpresasClientes() {
  const [empresas, setEmpresas] = useState(null);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);
  const [empresaAssinatura, setEmpresaAssinatura] = useState(null);
  const [empresaDoador, setEmpresaDoador] = useState(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <Building2 size={28} className="shrink-0 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          Empresas/Clientes
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">Gestão de todos os clientes da plataforma SAE.</p>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {empresas === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          Carregando...
        </div>
      ) : (
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
                                onClick={() => setEmpresaDoador(empresa)}
                                title="Gestão de Doadores"
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
      )}

      {empresaAssinatura && (
        <ModalAssinaturas
          empresa={empresaAssinatura}
          onFechar={() => setEmpresaAssinatura(null)}
          onAtualizado={carregar}
        />
      )}

      {empresaDoador && (
        <ModalDoador empresa={empresaDoador} onFechar={() => setEmpresaDoador(null)} onAtualizado={carregar} />
      )}
    </div>
  );
}
