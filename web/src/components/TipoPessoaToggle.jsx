const OPCOES = [
  { valor: 'PJ', rotulo: 'Pessoa Jurídica' },
  { valor: 'PF', rotulo: 'Pessoa Física' },
];

/**
 * Toggle estilizado (pilula) PF/PJ - usado no Cadastro (interativo, decide
 * o tipo de documento do zero) e em "Dados da Loja" nas Configuracoes
 * (`disabled`, so exibe o tipo ja definido no cadastro - mudar de PF pra PJ
 * depois exigiria trocar o proprio numero do documento, o que nao e uma
 * operacao de formulario simples, entao fica bloqueado ali).
 */
export default function TipoPessoaToggle({ value, onChange, disabled = false }) {
  return (
    <div>
      <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Tipo de cadastro</span>
      <div
        className={`mt-2 inline-flex w-full rounded-full bg-slate-100 p-1 dark:bg-slate-700 ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        {OPCOES.map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(valor)}
            className={`flex-1 rounded-full px-4 py-2 text-base font-bold transition-all duration-200 ${
              value === valor
                ? 'bg-white text-blue-700 shadow dark:bg-slate-900 dark:text-blue-300'
                : 'text-slate-500 dark:text-slate-400'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
