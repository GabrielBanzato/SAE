import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calculator,
  Boxes,
  Users,
  Receipt,
  Wallet,
  CalendarDays,
  BarChart3,
  Settings,
  Briefcase,
  Building2,
  LayoutGrid,
  LifeBuoy,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

/**
 * Reformulacao pedida: menu antigo (3 secoes sempre abertas + "Modulos
 * Extras") virou 5 itens de topo - Dashboard/Modulos/Suporte navegam direto,
 * Operacional/Administracao viram "gavetas" (accordion) com as mesmas
 * subcategorias de antes. "Modulos Extras" (Sidebar) foi promovido a uma
 * pagina propria (`/modulos`, ver pages/Modulos.jsx) - a vitrine de
 * apps/addons agora mora la, nao mais dentro do menu.
 */
const CATEGORIAS_MENU = [
  {
    chave: 'operacional',
    titulo: 'Operacional',
    icon: Briefcase,
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
    chave: 'administracao',
    titulo: 'Administração',
    icon: Building2,
    itens: [
      { label: 'Controle Financeiro', to: '/financeiro', icon: Wallet },
      { label: 'Relatórios', to: '/relatorios', icon: BarChart3 },
      { label: 'Configurações', to: '/configuracoes', icon: Settings },
    ],
  },
];

const ITEM_DASHBOARD = { label: 'Dashboard', to: '/', icon: LayoutDashboard };
const ITEM_MODULOS = { label: 'Módulos', to: '/modulos', icon: LayoutGrid };
const ITEM_SUPORTE = { label: 'Suporte', to: '/suporte', icon: LifeBuoy };

/** Categoria (se houver) que contem a rota atual - usado pra abrir a gaveta certa sozinho ao navegar direto pra uma sub-rota (ex.: link do Dashboard pra "/vendas"). */
function encontrarCategoriaDaRota(pathname) {
  const categoria = CATEGORIAS_MENU.find((c) => c.itens.some((item) => item.to === pathname));
  return categoria?.chave ?? null;
}

/**
 * Fora do componente Sidebar (nao definido durante o render) - senao vira
 * um componente novo a cada render, perdendo qualquer estado/identidade do
 * React entre renders (o oxlint acusa isso como `static-components`).
 * Recebe `isExpanded` como prop em vez de fechar sobre a variavel do
 * componente pai.
 */
function ItemDireto({ label, to, icon: Icon, isExpanded }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={!isExpanded ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold transition-colors ${
          isExpanded ? '' : 'justify-center px-0'
        } ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        }`
      }
    >
      <Icon size={22} className="shrink-0" aria-hidden="true" />
      <span className={`flex-1 text-left ${isExpanded ? '' : 'hidden'}`}>{label}</span>
    </NavLink>
  );
}

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
 * Accordion EXCLUSIVO: `categoriaAberta` guarda no maximo 1 chave por vez
 * (nao um Set/array) - abrir uma categoria fecha a outra automaticamente,
 * so por causa do proprio formato do estado (nao precisa de logica extra
 * pra "fechar as demais"). A suavidade do abrir/fechar e via
 * `max-height`/`opacity` com `transition-all duration-300` (Tailwind nao
 * anima `height: auto`, e o conteudo tem tamanho variavel - por isso um
 * `max-h-[...]` generoso em vez de medir a altura real via ref).
 */
export default function Sidebar({ isExpanded, onToggle }) {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const escuro = theme === 'dark';

  const [categoriaAberta, setCategoriaAberta] = useState(() => encontrarCategoriaDaRota(location.pathname));

  // Se o usuario chegar numa sub-rota por outro caminho (atalho do
  // Dashboard, link direto, botao "voltar" do navegador), a gaveta certa
  // abre sozinha - sem isso o item ativo apareceria "escondido" dentro de
  // uma categoria fechada, sem nenhuma pista visual de onde ele esta.
  // Ajuste de estado durante o proprio render (comparando com a rota
  // anterior) em vez de `useEffect` - isso deriva de uma prop que mudou
  // (`location.pathname`), nao sincroniza com nada externo, entao nao
  // precisa do passo extra de render que um efeito custaria aqui.
  const [rotaAnterior, setRotaAnterior] = useState(location.pathname);
  if (location.pathname !== rotaAnterior) {
    setRotaAnterior(location.pathname);
    const categoriaDaRota = encontrarCategoriaDaRota(location.pathname);
    if (categoriaDaRota) {
      setCategoriaAberta(categoriaDaRota);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function alternarCategoria(chave) {
    setCategoriaAberta((atual) => (atual === chave ? null : chave));
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
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Navegacao principal"
      >
        <ItemDireto {...ITEM_DASHBOARD} isExpanded={isExpanded} />

        {CATEGORIAS_MENU.map(({ chave, titulo, icon: Icon, itens }) => {
          const aberto = categoriaAberta === chave;
          const contemAtiva = itens.some((item) => item.to === location.pathname);

          return (
            <div key={chave}>
              <button
                type="button"
                onClick={() => alternarCategoria(chave)}
                title={!isExpanded ? titulo : undefined}
                aria-expanded={aberto}
                className={`${itemClasses} w-full ${
                  contemAtiva
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={22} className="shrink-0" aria-hidden="true" />
                <span className={`flex-1 text-left ${isExpanded ? '' : 'hidden'}`}>{titulo}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 transition-transform duration-300 ${aberto ? 'rotate-180' : ''} ${
                    isExpanded ? '' : 'hidden'
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* Gaveta da categoria - so existe (visualmente) quando a
                  Sidebar esta expandida; recolhida, os subitens ficam
                  inacessiveis pelo menu mesmo (sem espaco pra um flyout
                  aqui), igual o resto do menu ja escondia texto. */}
              {isExpanded && (
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    aberto ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="flex flex-col gap-1 py-1 pl-4">
                    {itens.map(({ label, to, icon: SubIcon }) => (
                      <NavLink
                        key={label}
                        to={to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-xl px-4 py-2.5 text-base font-semibold transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        <SubIcon size={18} className="shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-left">{label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <ItemDireto {...ITEM_MODULOS} isExpanded={isExpanded} />
        <ItemDireto {...ITEM_SUPORTE} isExpanded={isExpanded} />
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
