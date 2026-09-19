/**
 * Esqueleto generico de "tela vazia" - titulo, descricao e um icone grande
 * centralizado. Nasceu pra telas ainda nao implementadas (uso original,
 * texto interno fixo "Em construção"), e ganhou nesta tarefa 2 props
 * opcionais (`corpoTitulo`/`corpoTexto`) pra tambem cobrir o catch-all de
 * rota modular em App.jsx ("Módulo indisponível" - texto diferente, mesmo
 * layout): sem elas, o comportamento e identico ao de antes.
 */
export default function Placeholder({
  titulo,
  icon: Icon,
  descricao,
  corpoTitulo = 'Em construção',
  corpoTexto = 'Esta tela ainda não tem funcionalidades — por enquanto é só o esqueleto de navegação.',
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          {Icon && <Icon size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
          {titulo}
        </h1>
        {descricao && <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">{descricao}</p>}
      </div>

      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-800">
        {Icon && <Icon size={48} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />}
        <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">{corpoTitulo}</p>
        <p className="max-w-sm text-base text-slate-400 dark:text-slate-500">{corpoTexto}</p>
      </div>
    </div>
  );
}
