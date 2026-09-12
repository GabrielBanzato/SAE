/**
 * Toggle/Switch booleano reutilizavel (trilho + bolinha deslizante,
 * estilo iOS) - `<button>` aninhado dentro de `<label>` pra clicar no
 * texto do rotulo tambem alternar o valor (button e "labelable" pelo
 * spec HTML, entao o clique e encaminhado corretamente).
 */
export default function Switch({ checked, onChange, label, descricao }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-lg font-semibold text-slate-800 dark:text-slate-200">{label}</span>
        {descricao && <span className="block text-sm text-slate-400 dark:text-slate-500">{descricao}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </button>
    </label>
  );
}
