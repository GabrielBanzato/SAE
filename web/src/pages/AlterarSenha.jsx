import { useState } from 'react';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import FormAlterarSenha from '../components/conta/FormAlterarSenha';

/**
 * "Alterar senha" (rota /conta/senha, botao da chave no rodape da Sidebar) -
 * disponivel pra QUALQUER usuario, admin ou nao (a Configuracoes e so do
 * admin desde o RBAC, entao o funcionario precisava de um lugar proprio).
 */
export default function AlterarSenha() {
  const [sucesso, setSucesso] = useState(false);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <KeyRound size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Alterar senha
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">Troque a senha que você usa para entrar no SAE.</p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-8">
        {sucesso && (
          <p className="mb-5 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-base font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 size={20} aria-hidden="true" />
            Senha alterada com sucesso.
          </p>
        )}
        <FormAlterarSenha onSucesso={() => setSucesso(true)} />
      </div>
    </div>
  );
}
