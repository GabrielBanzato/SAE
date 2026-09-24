import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, Users, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import ModalPerfil from './ModalPerfil';

/**
 * Aba "Perfis de Acesso" de Configuracoes (RBAC, 2026-09-24) - o admin cria
 * cargos (ex.: Vendas, Produção, Financeiro) e marca o que cada um acessa.
 * Quem usa cada perfil e definido na aba Equipe (convite / troca de perfil).
 *
 * Dados: GET /perfis (lista com `totalUsuarios`) + GET /perfis/catalogo
 * (grupos/rotulos das permissoes - usados aqui pros chips e no modal).
 * Exclusao com confirmacao inline; perfil em uso volta 409 da API com a
 * explicacao (mover as pessoas antes) - mostrada como erro da pagina.
 */
export default function PerfisAcesso() {
  const [perfis, setPerfis] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null); // null | { perfil: null | objeto }
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(() => {
    Promise.all([apiFetch('/perfis'), apiFetch('/perfis/catalogo')])
      .then(([listaPerfis, cat]) => {
        setPerfis(listaPerfis);
        setCatalogo(cat);
      })
      .catch((err) => {
        setErro(err.message || 'Não foi possível carregar os perfis.');
        setPerfis((atual) => atual ?? []);
      });
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // chave -> rotulo, pros chips de cada cartao.
  const rotulos = useMemo(
    () => Object.fromEntries(catalogo.flatMap((g) => g.permissoes.map((p) => [p.chave, p.rotulo]))),
    [catalogo]
  );

  async function salvar(dados) {
    const perfil = modal?.perfil;
    await apiFetch(perfil ? `/perfis/${perfil.id}` : '/perfis', {
      method: perfil ? 'PUT' : 'POST',
      body: JSON.stringify(dados),
    });
    setModal(null);
    setErro('');
    carregar();
  }

  async function excluir(perfil) {
    setExcluindo(true);
    setErro('');
    try {
      await apiFetch(`/perfis/${perfil.id}`, { method: 'DELETE' });
      setConfirmandoExclusao(null);
      carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível excluir o perfil.');
      setConfirmandoExclusao(null);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-col items-start gap-4 rounded-3xl bg-blue-600 p-6 text-white shadow-sm dark:bg-blue-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck size={24} aria-hidden="true" />
            Perfis de Acesso
          </h2>
          <p className="mt-1 text-lg text-blue-100">Crie cargos e escolha o que cada um pode ver no sistema.</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ perfil: null })}
          disabled={!catalogo.length}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
        >
          <Plus size={22} aria-hidden="true" />
          Novo Perfil
        </button>
      </div>

      <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Administradores sempre têm acesso total. Os perfis valem para as demais pessoas da equipe — mudanças passam a valer
        na hora.
      </p>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
      )}

      {perfis === null ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400 dark:text-slate-500">
          <Loader2 size={22} className="animate-spin" aria-hidden="true" />
          Carregando...
        </div>
      ) : perfis.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhum perfil criado ainda.</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Crie um perfil (ex.: “Vendas”) antes de convidar pessoas para a equipe.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {perfis.map((perfil) => (
            <li key={perfil.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{perfil.nome}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <Users size={15} aria-hidden="true" />
                    {perfil.totalUsuarios} {perfil.totalUsuarios === 1 ? 'pessoa' : 'pessoas'} com este perfil
                  </p>
                </div>

                {confirmandoExclusao === perfil.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">Excluir este perfil?</span>
                    <button
                      type="button"
                      onClick={() => excluir(perfil)}
                      disabled={excluindo}
                      className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {excluindo ? 'Excluindo...' : 'Excluir'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoExclusao(null)}
                      className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setModal({ perfil })}
                      aria-label={`Editar perfil ${perfil.nome}`}
                      className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoExclusao(perfil.id)}
                      aria-label={`Excluir perfil ${perfil.nome}`}
                      className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {perfil.permissoes.length === 0 ? (
                  <span className="text-sm italic text-slate-400 dark:text-slate-500">Nenhuma área liberada</span>
                ) : (
                  perfil.permissoes.map((chave) => (
                    <span
                      key={chave}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {rotulos[chave] || chave}
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && <ModalPerfil perfil={modal.perfil} catalogo={catalogo} onFechar={() => setModal(null)} onSalvar={salvar} />}
    </div>
  );
}
