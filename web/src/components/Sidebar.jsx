import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calculator,
  Boxes,
  Users,
  Receipt,
  Wallet,
  ScrollText,
  CalendarDays,
  BarChart3,
  Settings,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Lock,
  MessageCircle,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

/**
 * Menu agrupado em secoes (pedido explicito: acabar com a lista unica e
 * "poluida" de 12 links soltos). A divisao em 3 grupos e uma escolha de
 * categorizacao (nao veio especificada item a item no pedido):
 * "Operacional" fica com o dia-a-dia de quem opera a loja, "Administracao"
 * com o que e mais retaguarda/gestao (financeiro, relatorios, config).
 */
const SECOES_MENU = [
  {
    titulo: 'Visão Geral',
    itens: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    titulo: 'Operacional',
    itens: [
      { label: 'Vendas', to: '/vendas', icon: ShoppingCart },
      { label: 'Produtos', to: '/produtos', icon: Package },
      { label: 'Precificação', to: '/precificacao', icon: Calculator },
      { label: 'Estoque', to: '/estoque', icon: Boxes },
      { label: 'Clientes', to: '/clientes', icon: Users },
      { label: 'Lançamentos', to: '/lancamentos', icon: Receipt },
      { label: 'Agenda', to: '/agenda', icon: CalendarDays },
    ],
  },
  {
    titulo: 'Administração',
    itens: [
      { label: 'Controle Financeiro', to: '/financeiro', icon: Wallet },
      { label: 'Relatórios', to: '/relatorios', icon: BarChart3 },
      { label: 'Configurações', to: '/configuracoes', icon: Settings },
    ],
  },
];

/**
 * "Modulos Extras" (features pagas, ainda nao lancadas). "Notas Fiscais" ja
 * tinha rota propria (pages/Notas.jsx - ja e a tela "Modulo Fiscal em
 * Desenvolvimento" com cadeado, ver NOTAS_IMPORTANTES.md) - mantive o link
 * funcional (leva pra essa explicacao) em vez de desativa-lo, so migrou de
 * secao e ganhou o mesmo selo visual do "IA no WhatsApp". Ja "IA no
 * WhatsApp" e 100% ficticio, sem rota - por isso vira um item inerte (nao
 * e um NavLink, nao navega pra lugar nenhum), so pra comunicar "isso vai
 * existir".
 */
const ITENS_PREMIUM = [
  { label: 'IA no WhatsApp', icon: MessageCircle },
  { label: 'Notas Fiscais', to: '/notas', icon: ScrollText },
];

/**
 * Menu lateral fixo (nunca rola com a pagina) e retratil. `isExpanded` e
 * `onToggle` vem do Layout (ver comentario la) - este componente so decide
 * como se desenhar em cada estado.
 *
 * Estrutura em 3 blocos empilhados via flex-col (cabecalho e rodape com
 * altura propria, navegacao no meio com `flex-1` pra ocupar o espaco
 * restante) - e o que garante cabecalho/rodape sempre fixos e so a
 * navegacao rolando, sem depender de calculo manual de altura.
 *
 * A navegacao agora e agrupada em secoes (`SECOES_MENU`) mais a area de
 * destaque "Modulos Extras" (`ITENS_PREMIUM`, ver comentario acima dela) -
 * o mecanismo de item desabilitado/"em breve" (removido antes, quando
 * todo item ganhou rota propria) voltou, mas so pra essa area de features
 * ainda nao lancadas.
 */
export default function Sidebar({ isExpanded, onToggle }) {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const escuro = theme === 'dark';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const itemClasses = `flex items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold transition-colors ${
    isExpanded ? '' : 'justify-center px-0'
  }`;

  return (
    <aside
      className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900 ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
    >
      {/* Botao de recolher/expandir - "berruga" flutuando na borda direita,
          centralizada verticalmente na tela inteira (a Sidebar e h-screen,
          entao top-1/2 aqui cai no meio da viewport). Se posiciona relativo
          a este <aside> porque `position: fixed` (classe `fixed` acima) JA
          e, por si so, um contexto de posicionamento valido pra um filho
          `absolute` - nao precisa (e nao deve) adicionar `relative` aqui
          tambem: as duas classes juntas no mesmo elemento conflitam (so uma
          delas vale por vez, dependendo da ordem interna do CSS gerado
          pelo Tailwind, nao da ordem escrita no className) - isso ja
          causou um bug real (Sidebar virando `position: relative` sem
          querer, quebrando o offset do <main> no Layout.jsx). */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isExpanded ? 'Recolher menu' : 'Expandir menu'}
        title={isExpanded ? 'Recolher menu' : 'Expandir menu'}
        className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-full border-4 border-slate-900 flex items-center justify-center cursor-pointer z-50 text-white transition-transform hover:scale-110"
      >
        {isExpanded ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
      </button>

      {/* Cabecalho fixo - "SAE" nunca some, so muda de alinhamento
          (esquerda vs. centro) conforme o menu esta expandido ou
          recolhido. O botao de recolher/expandir saiu daqui - agora vive
          na "berruga" acima. */}
      <div className="shrink-0 px-4 py-6">
        <div className={`flex items-center ${isExpanded ? 'justify-start' : 'justify-center'}`}>
          <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">SAE</span>
        </div>
      </div>

      {/* Navegacao - unica parte que rola. A barra de rolagem fica
          escondida visualmente (webkit/IE/Firefox) sem desativar o scroll
          em si: o mouse/touch/teclado continuam rolando normalmente,
          so o "trilho" visivel some. */}
      <nav
        className="flex flex-1 flex-col overflow-y-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Navegacao principal"
      >
        {SECOES_MENU.map(({ titulo, itens }, indiceSecao) => (
          <div key={titulo} className={indiceSecao === 0 ? '' : 'mt-4'}>
            {isExpanded ? (
              <p className="mb-2 px-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {titulo}
              </p>
            ) : (
              indiceSecao > 0 && <div className="mx-2 mb-2 border-t border-slate-200 dark:border-slate-800" />
            )}

            <div className="flex flex-col gap-1">
              {itens.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={label}
                  to={to}
                  end={to === '/'}
                  title={!isExpanded ? label : undefined}
                  className={({ isActive }) =>
                    `${itemClasses} ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon size={22} className="shrink-0" aria-hidden="true" />
                  <span className={`flex-1 text-left ${isExpanded ? '' : 'hidden'}`}>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* "Modulos Extras" - secao de destaque com borda tracejada +
            fundo amarelo suave, pra parecer um "cartao" separado do resto
            do menu (visual comum em SaaS pra features premium/em breve),
            nao so mais uma categoria igual as outras. */}
        <div className="mt-4">
          {isExpanded ? (
            <p className="mb-2 px-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Módulos Extras
            </p>
          ) : (
            <div className="mx-2 mb-2 border-t border-slate-200 dark:border-slate-800" />
          )}

          <div className="flex flex-col gap-1 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-1.5 dark:border-amber-400/30 dark:bg-amber-400/[0.06]">
            {ITENS_PREMIUM.map(({ label, to, icon: Icon }) => {
              const conteudo = (
                <>
                  <Icon size={22} className="shrink-0" aria-hidden="true" />
                  <span className={`flex-1 text-left ${isExpanded ? '' : 'hidden'}`}>{label}</span>
                  {isExpanded && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
                      <Lock size={10} aria-hidden="true" />
                      Em breve
                    </span>
                  )}
                </>
              );

              const classesPremium = `${itemClasses} text-amber-800/70 dark:text-amber-200/60`;

              // "Notas Fiscais" ja tem uma tela real (Modulo Fiscal em
              // Desenvolvimento) - continua navegavel. "IA no WhatsApp" nao
              // tem rota nenhuma, entao vira um bloco inerte (nao e link).
              if (!to) {
                return (
                  <div
                    key={label}
                    aria-disabled="true"
                    title={!isExpanded ? `${label} (em breve)` : undefined}
                    className={`${classesPremium} cursor-not-allowed select-none opacity-80`}
                  >
                    {conteudo}
                  </div>
                );
              }

              return (
                <NavLink
                  key={label}
                  to={to}
                  title={!isExpanded ? `${label} (em breve)` : undefined}
                  className={({ isActive }) =>
                    `${classesPremium} ${
                      isActive ? 'bg-amber-200/60 dark:bg-amber-400/10' : 'hover:bg-amber-100/70 dark:hover:bg-amber-400/10'
                    }`
                  }
                >
                  {conteudo}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Rodape fixo - fora da area de scroll da nav (e irmao dela, nao
          filho), entao nunca rola junto com a lista de links. */}
      <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar tema"
          title={!isExpanded ? 'Alternar entre modo claro e escuro' : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${
            isExpanded ? '' : 'justify-center px-0'
          }`}
        >
          {escuro ? (
            <Sun size={22} className="shrink-0" aria-hidden="true" />
          ) : (
            <Moon size={22} className="shrink-0" aria-hidden="true" />
          )}
          <span className={isExpanded ? 'flex-1 text-left' : 'hidden'}>{escuro ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          title={!isExpanded ? 'Sair' : undefined}
          className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 ${
            isExpanded ? '' : 'justify-center px-0'
          }`}
        >
          <LogOut size={22} className="shrink-0" aria-hidden="true" />
          <span className={isExpanded ? 'flex-1 text-left' : 'hidden'}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
