/**
 * Esqueleto de tela ainda nao implementada - so titulo, descricao e um
 * icone grande centralizado. Usado pelas paginas novas da Sidebar que
 * ainda nao tem funcionalidade real (Vendas, Produtos, Estoque, Clientes,
 * Lancamentos, Controle Financeiro, Notas) - cada uma e um arquivo proprio
 * em `pages/`, so pra ter uma rota de verdade pro React Router (em vez de
 * todo mundo apontar pro mesmo componente), mas o conteudo visual vem
 * todo daqui.
 */
export default function Placeholder({ titulo, icon: Icon, descricao }) {
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
        <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">Em construção</p>
        <p className="max-w-sm text-base text-slate-400 dark:text-slate-500">
          Esta tela ainda não tem funcionalidades — por enquanto é só o esqueleto de navegação.
        </p>
      </div>
    </div>
  );
}
