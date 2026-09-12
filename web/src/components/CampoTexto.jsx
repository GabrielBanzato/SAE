/**
 * Campo de texto padrao das telas de autenticacao - mesma linguagem visual
 * dos campos numericos de CalculadoraPrecificacao.jsx (borda 2px, foco azul,
 * fonte grande), adaptado pra texto/email/senha com um icone a esquerda e um
 * slot opcional a direita (`endAdornment`, usado pelo botao de
 * mostrar/ocultar senha).
 */
export default function CampoTexto({ label, icon: Icon, error, endAdornment, ...inputProps }) {
  return (
    <label className="block">
      <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">{label}</span>
      <div
        className={`mt-2 flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:bg-slate-800 dark:focus-within:border-blue-400 ${
          error ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        {Icon && <Icon size={22} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />}
        <input
          {...inputProps}
          className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
        />
        {endAdornment}
      </div>
      {error && <span className="mt-1 block text-sm font-medium text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}
