import { useEffect, useState } from 'react';
import { UserPlus, UserCircle2, Users, Lock, Heart, KeyRound, UserMinus, Clock, Loader2, ShieldAlert, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import ModalConvidarUsuario from './ModalConvidarUsuario';
import SenhaTemporaria from './SenhaTemporaria';

/**
 * Resultado de "Redefinir senha": nova senha temporaria, mostrada UMA vez.
 * So fecha pelo botao (sem Esc/clique fora) - mesmo cuidado do convite.
 */
function ModalSenhaRedefinida({ usuario, onFechar }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-senha-redefinida"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-senha-redefinida" className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            <KeyRound size={24} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Nova senha gerada
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
          A senha anterior de <strong>{usuario.nome}</strong> deixou de valer. Envie os dados abaixo para a pessoa.
        </p>
        <div className="mt-5">
          <SenhaTemporaria email={usuario.email} senha={usuario.senhaTemporaria} />
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="mt-4 w-full rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}

const CORES_ROLE = {
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  gerente: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  vendedor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const ROTULOS_PLANO = {
  gratuito: 'Gratuito',
  apoiador: 'Apoiador',
};

// Espelha LIMITE_USUARIOS_POR_PLANO em api/src/services/empresa.service.js -
// precisa ficar em sincronia se o limite mudar no backend (usado so pra
// exibir o contador e desabilitar o botao antes de bater no 403 real).
// So tem entrada "apoiador": a Gestao de Equipe inteira agora e exclusiva
// desse plano (ver bloqueio logo no topo do componente) - o plano
// "gratuito" nunca chega a renderizar essa lista, entao o limite dele
// deixou de ser relevante aqui.
const LIMITES_POR_PLANO = { apoiador: 5 };

function ContadorUsuarios({ total, limite, plano }) {
  const atingiuLimite = total >= limite;
  const percentual = Math.min(100, Math.round((total / limite) * 100));

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200">
          <Users size={18} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          Usuários: {total}/{limite} no Plano {ROTULOS_PLANO[plano] || plano}
        </span>
        {atingiuLimite && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Limite atingido
          </span>
        )}
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            atingiuLimite ? 'bg-amber-500' : 'bg-blue-600'
          }`}
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Lista de usuarios da empresa (GET /empresa/usuarios) + contador de
 * uso do limite do plano + convite. RBAC (2026-09-24): o convite e real
 * (ModalConvidarUsuario - e-mail + perfil, senha temporaria) e cada membro
 * nao-admin tem um select pra trocar o perfil de acesso. O botao reflete o limite REAL do plano
 * (LIMITE_USUARIOS_POR_PLANO no backend: apoiador=5, contando o admin),
 * desabilitando antes mesmo de tentar convidar.
 *
 * Pedido explicito (tarefa de redesign do Plano Apoiador): a Gestao de
 * Equipe inteira virou um beneficio exclusivo de quem e Apoiador (ver
 * "Liberação da Gestão de Equipe" em Assinatura.jsx) - antes disso, o
 * plano gratuito tinha acesso limitado (2 pessoas) em vez de bloqueio
 * total. `onIrParaAssinatura` (passado por Configuracoes.jsx) leva direto
 * pra aba onde a pessoa pode virar Apoiador.
 */
export default function UsuariosEquipe({ usuarios, plano, onIrParaAssinatura, onIrParaPerfis, onUsuariosAtualizados }) {
  const [modalConviteAberto, setModalConviteAberto] = useState(false);
  // Perfis pro select de cada membro (RBAC) - so carrega se a aba esta liberada.
  const [perfis, setPerfis] = useState(null);
  const [trocandoId, setTrocandoId] = useState(null);
  const [erroTroca, setErroTroca] = useState('');
  // Confirmacao inline de "Redefinir senha"/"Remover" ({ id, acao }) e o
  // resultado da redefinicao (senha temporaria, mostrada uma vez).
  const [confirmacao, setConfirmacao] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [senhaRedefinida, setSenhaRedefinida] = useState(null);

  async function redefinirSenha(usuario) {
    setErroTroca('');
    setProcessando(true);
    try {
      const resultado = await apiFetch(`/empresa/usuarios/${usuario.id}/redefinir-senha`, { method: 'POST' });
      setConfirmacao(null);
      setSenhaRedefinida(resultado);
      onUsuariosAtualizados?.();
    } catch (err) {
      setErroTroca(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setProcessando(false);
    }
  }

  async function removerMembro(usuario) {
    setErroTroca('');
    setProcessando(true);
    try {
      await apiFetch(`/empresa/usuarios/${usuario.id}`, { method: 'DELETE' });
      setConfirmacao(null);
      onUsuariosAtualizados?.();
    } catch (err) {
      setErroTroca(err.message || 'Não foi possível remover esta pessoa.');
    } finally {
      setProcessando(false);
    }
  }
  const liberada = !plano || plano === 'apoiador';

  useEffect(() => {
    if (!liberada) return;
    apiFetch('/perfis')
      .then(setPerfis)
      .catch(() => setPerfis([]));
  }, [liberada]);

  // PUT /empresa/usuarios/:id/perfil - vale na proxima requisicao da pessoa (API le o acesso do banco).
  async function trocarPerfil(usuario, novoPerfilId) {
    if (!novoPerfilId || Number(novoPerfilId) === usuario.perfil?.id) return;
    setErroTroca('');
    setTrocandoId(usuario.id);
    try {
      await apiFetch(`/empresa/usuarios/${usuario.id}/perfil`, {
        method: 'PUT',
        body: JSON.stringify({ perfil_id: Number(novoPerfilId) }),
      });
      onUsuariosAtualizados?.();
    } catch (err) {
      setErroTroca(err.message || 'Não foi possível trocar o perfil.');
    } finally {
      setTrocandoId(null);
    }
  }

  if (plano && plano !== 'apoiador') {
    return (
      <div
        aria-disabled="true"
        className="flex max-w-2xl flex-col items-center gap-4 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
          <Lock size={32} aria-hidden="true" />
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Gestão de Equipe é exclusiva para Apoiadores
        </h2>
        <p className="max-w-md text-lg text-slate-500 dark:text-slate-400">
          Recurso exclusivo para Apoiadores do sistema. Vire Apoiador para convidar sua equipe e gerenciar quem tem
          acesso à sua loja.
        </p>
        {onIrParaAssinatura && (
          <button
            type="button"
            onClick={onIrParaAssinatura}
            className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Heart size={20} aria-hidden="true" />
            Vire Apoiador
          </button>
        )}
      </div>
    );
  }

  const total = usuarios?.length ?? 0;
  const semPerfil = (usuarios ?? []).filter((usuario) => usuario.role !== 'admin' && !usuario.perfil);
  const limite = LIMITES_POR_PLANO[plano];
  const atingiuLimite = Boolean(limite) && total >= limite;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-col items-start gap-4 rounded-3xl bg-blue-600 p-6 text-white shadow-sm dark:bg-blue-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Sua equipe</h2>
          <p className="mt-1 text-lg text-blue-100">Convide outras pessoas para ajudar a tocar o negócio.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalConviteAberto(true)}
          disabled={atingiuLimite}
          title={atingiuLimite ? 'Limite de usuários do plano atingido' : undefined}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400 sm:w-auto"
        >
          <UserPlus size={24} aria-hidden="true" />
          Convidar Usuário
        </button>
      </div>

      {limite && <ContadorUsuarios total={total} limite={limite} plano={plano} />}

      {atingiuLimite && (
        <p className="rounded-2xl bg-amber-50 p-4 text-lg text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Você atingiu o limite de usuários do plano {ROTULOS_PLANO[plano] || plano}.
        </p>
      )}

      {erroTroca && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erroTroca}</p>
      )}

      {modalConviteAberto && (
        <ModalConvidarUsuario
          onFechar={() => setModalConviteAberto(false)}
          onConvidado={onUsuariosAtualizados}
          onIrParaPerfis={() => {
            setModalConviteAberto(false);
            onIrParaPerfis?.();
          }}
        />
      )}

      {/* Pendencia pos-deploy do RBAC: nao-admins antigos, sem perfil, ainda tem acesso total. */}
      {semPerfil.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <ShieldAlert size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-base">
            <strong>
              {semPerfil.length} {semPerfil.length === 1 ? 'pessoa está' : 'pessoas estão'} sem perfil de acesso
            </strong>{' '}
            e por isso {semPerfil.length === 1 ? 'vê' : 'veem'} o sistema inteiro. Escolha um perfil para cada uma na lista
            abaixo{perfis?.length ? '' : ' (crie um perfil primeiro, na aba Perfis de Acesso)'}.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {(usuarios || []).map((usuario) => {
          const ehAdmin = usuario.role === 'admin';
          const confirmando = confirmacao?.id === usuario.id ? confirmacao.acao : null;
          return (
            <li
              key={usuario.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
            >
              <div className="flex flex-wrap items-center gap-4">
                <UserCircle2 size={40} className="shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{usuario.nome}</p>
                  <p className="truncate text-base text-slate-500 dark:text-slate-400">{usuario.email}</p>
                  {usuario.deveTrocarSenha && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <Clock size={12} aria-hidden="true" />
                      Aguardando 1º acesso
                    </span>
                  )}
                </div>
                {/* RBAC: admin tem acesso total (perfil nao se aplica); demais pessoas mostram/trocam o perfil. */}
                {ehAdmin ? (
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${CORES_ROLE.admin}`}>
                    Administrador(a) · acesso total
                  </span>
                ) : (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <select
                      value={usuario.perfil?.id ?? ''}
                      onChange={(event) => trocarPerfil(usuario, event.target.value)}
                      disabled={trocandoId === usuario.id || !perfis?.length}
                      aria-label={`Perfil de acesso de ${usuario.nome}`}
                      className={`max-w-[12rem] rounded-xl border-2 bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:border-blue-500 disabled:opacity-60 dark:bg-slate-900 ${
                        usuario.perfil
                          ? 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'
                          : 'border-amber-400 text-amber-700 dark:border-amber-600 dark:text-amber-300'
                      }`}
                    >
                      {!usuario.perfil && <option value="">Sem perfil (acesso total)</option>}
                      {(perfis ?? []).map((perfil) => (
                        <option key={perfil.id} value={perfil.id}>
                          {perfil.nome}
                        </option>
                      ))}
                    </select>
                    {trocandoId === usuario.id && <span className="text-xs text-slate-400">Salvando...</span>}
                  </div>
                )}
              </div>

              {/* Acoes de conta - so pra nao-admins (admin nao se gerencia por aqui, ver empresa.service.js#buscarMembroGerenciavel). */}
              {!ehAdmin && (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                  {confirmando ? (
                    <>
                      <span className="mr-auto text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {confirmando === 'remover'
                          ? `Remover ${usuario.nome} da equipe? O acesso é encerrado na hora; o histórico de vendas e tarefas é mantido.`
                          : `Gerar uma nova senha temporária para ${usuario.nome}? A senha atual deixa de valer.`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmacao(null)}
                        disabled={processando}
                        className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => (confirmando === 'remover' ? removerMembro(usuario) : redefinirSenha(usuario))}
                        disabled={processando}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60 ${
                          confirmando === 'remover' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {processando && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                        {confirmando === 'remover' ? 'Remover' : 'Gerar nova senha'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmacao({ id: usuario.id, acao: 'redefinir' })}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <KeyRound size={15} aria-hidden="true" />
                        Redefinir senha
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmacao({ id: usuario.id, acao: 'remover' })}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        <UserMinus size={15} aria-hidden="true" />
                        Remover
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {senhaRedefinida && (
        <ModalSenhaRedefinida
          usuario={senhaRedefinida}
          onFechar={() => setSenhaRedefinida(null)}
        />
      )}
    </div>
  );
}
