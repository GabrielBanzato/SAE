import { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';

/**
 * Bloco "dados de acesso + senha temporaria" (RBAC, 2026-09-24) - usado no
 * sucesso do convite (ModalConvidarUsuario) e no "Redefinir senha"
 * (ModalSenhaRedefinida). A senha vem UMA vez da API e nunca mais: por isso
 * o aviso e o botao de copiar. A pessoa sera obrigada a troca-la no 1o acesso.
 */
export default function SenhaTemporaria({ email, senha }) {
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`Acesso ao SAE\nE-mail: ${email}\nSenha temporária: ${senha}\n(Você vai criar sua própria senha no primeiro acesso.)`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErroCopia(true);
    }
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">E-mail de acesso</dt>
          <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">{email}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Senha temporária</dt>
          <dd className="select-all font-mono text-2xl font-extrabold tracking-wider text-slate-900 dark:text-slate-100">{senha}</dd>
        </div>
      </dl>

      <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        Anote ou copie agora: por segurança, esta senha não será mostrada de novo. No primeiro acesso a pessoa vai criar a
        própria senha.
      </p>

      {erroCopia && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Não foi possível copiar - selecione e copie a senha manualmente.
        </p>
      )}

      <button
        type="button"
        onClick={copiar}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 px-5 py-3 text-base font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        {copiado ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {copiado ? 'Copiado!' : 'Copiar dados de acesso'}
      </button>
    </div>
  );
}
