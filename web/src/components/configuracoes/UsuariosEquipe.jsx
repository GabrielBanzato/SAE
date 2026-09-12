import { useState } from 'react';
import { UserPlus, UserCircle2, Users } from 'lucide-react';

const ROTULOS_ROLE = {
  admin: 'Administrador(a)',
  gerente: 'Gerente',
  vendedor: 'Vendedor(a)',
};

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
const LIMITES_POR_PLANO = { gratuito: 2, apoiador: 5 };

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
 * uso do limite do plano + botao de convite. O convite em si continua
 * visual por enquanto (POST /empresa/usuarios ja existe no backend, mas
 * conectar o formulario de convite de verdade e um passo futuro) - o que
 * mudou aqui e que agora o botao reflete o limite REAL do plano
 * (LIMITE_USUARIOS_POR_PLANO no backend: gratuito=2, apoiador=5,
 * contando o admin), desabilitando antes mesmo de tentar convidar.
 */
export default function UsuariosEquipe({ usuarios, plano }) {
  const [mostrarAvisoConvite, setMostrarAvisoConvite] = useState(false);

  const total = usuarios?.length ?? 0;
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
          onClick={() => setMostrarAvisoConvite(true)}
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
          Você atingiu o limite de usuários do plano {ROTULOS_PLANO[plano] || plano}.{' '}
          {plano === 'gratuito' && 'Vire Apoiador na aba Assinatura para adicionar mais pessoas à equipe.'}
        </p>
      )}

      {!atingiuLimite && mostrarAvisoConvite && (
        <p className="rounded-2xl bg-amber-50 p-4 text-lg text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Em breve você poderá convidar novas pessoas para a sua loja por aqui.
        </p>
      )}

      <ul className="space-y-3">
        {(usuarios || []).map((usuario) => (
          <li
            key={usuario.id}
            className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
          >
            <UserCircle2
              size={40}
              className="shrink-0 text-slate-300 dark:text-slate-600"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{usuario.nome}</p>
              <p className="truncate text-base text-slate-500 dark:text-slate-400">{usuario.email}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                CORES_ROLE[usuario.role] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {ROTULOS_ROLE[usuario.role] || usuario.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
