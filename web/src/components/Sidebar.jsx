import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  History,
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
  MessageCircle,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  X,
  Zap,
  FileBarChart,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

/**
 * Menu agrupado em secoes - Dashboard/Modulos/Suporte navegam direto,
 * Operacional/Administracao viram "gavetas" (accordion) com subcategorias.
 *
 * `modulo` em cada item precisa bater com uma chave de MAPA_MODULOS
 * (api/src/services/auth.service.js) e com `ROTAS_POR_MODULO` em App.jsx -
 * um item só aparece no menu se essa chave estiver em `empresa.modulos`
 * (ver filtragem no componente `Sidebar` abaixo). Sem `modulo` = sempre
 * visível, independente de segmento (nenhum item direto abaixo precisa
 * disso hoje).
 */
const CATEGORIAS_MENU = [
  {
    chave: 'operacional',
    titulo: 'Operacional',
    icon: Briefcase,
    itens: [
      { label: 'Vendas', to: '/vendas', icon: ShoppingCart, modulo: 'pdv' },
      { label: 'Histórico de Vendas', to: '/historico-vendas', icon: History, modulo: 'pdv' },
      { label: 'Produtos', to: '/produtos', icon: Package, modulo: 'produtos' },
      { label: 'Precificação', to: '/precificacao', icon: Calculator, modulo: 'precificacao' },
      { label: 'Estoque', to: '/estoque', icon: Boxes, modulo: 'estoque_avancado' },
      { label: 'Clientes', to: '/clientes', icon: Users, modulo: 'clientes' },
      { label: 'Lançamentos', to: '/lancamentos', icon: Receipt, modulo: 'financeiro' },
      { label: 'Agenda', to: '/agenda', icon: CalendarDays, modulo: 'agenda' },
    ],
  },
  {
    chave: 'administracao',
    titulo: 'Administração',
    icon: Building2,
    // "Configuracoes" saiu daqui de proposito (pedido explicito) - agora e
    // acessada so pela engrenagem no rodape (ver botao "Configuracoes" mais
    // abaixo, perto do toggle de tema), pra nao ter 2 caminhos diferentes
    // levando pra mesma tela.
    itens: [
      { label: 'Controle Financeiro', to: '/financeiro', icon: Wallet, modulo: 'financeiro' },
      { label: 'DRE', to: '/dre', icon: FileBarChart, modulo: 'financeiro' },
      { label: 'Relatórios', to: '/relatorios', icon: BarChart3, modulo: 'relatorios' },
    ],
  },
];

const ITEM_DASHBOARD = { label: 'Dashboard', to: '/', icon: LayoutDashboard };
// PDV Rápido: mesmo modulo 'pdv' que ja controla Vendas/Histórico de Vendas
// (ver ROTAS_POR_MODULO em App.jsx) - filtrado junto com o resto do menu
// (ver `modulos.includes(item.modulo)` abaixo), mas fica FORA de
// `CATEGORIAS_MENU` porque nao e um item de accordion: e um atalho direto
// e em destaque pro caixa rapido de balcao (rota sem Sidebar, ver
// pages/PDV.jsx), nao mais uma tela "administrativa" pra esconder numa gaveta.
const ITEM_PDV = { label: 'PDV Rápido', to: '/pdv', icon: Zap, modulo: 'pdv' };
// Inbox Unificado de WhatsApp: sem campo `modulo` (mesmo motivo de
// ITEM_MODULOS/ITEM_SUPORTE abaixo) - nao existe chave de segmento pra isso
// em MAPA_MODULOS ainda, entao fica sempre visivel, independente de
// segmento/empresa.
const ITEM_INBOX = { label: 'Inbox WhatsApp', to: '/inbox', icon: MessageCircle };
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
 *
 * `isExpanded` so tem efeito visual a partir do breakpoint `md` (classes
 * `md:...`) - abaixo disso a Sidebar e um overlay full-drawer (ver
 * `<aside>` no componente principal) e sempre mostra o layout "expandido"
 * (largura cheia, rotulo visivel), independente do collapse de desktop.
 * `aoNavegar` fecha o menu mobile ao clicar num link (no desktop e um
 * no-op inofensivo, ja que la o menu nao "fecha" - so o estado
 * `abertaNoMobile`, que o desktop ignora, muda).
 */
function ItemDireto({ label, to, icon: Icon, isExpanded, aoNavegar }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={aoNavegar}
      title={!isExpanded ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold transition-colors ${
          !isExpanded ? 'md:justify-center md:px-0' : ''
        } ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        }`
      }
    >
      <Icon size={22} className="shrink-0" aria-hidden="true" />
      <span className={`flex-1 text-left ${!isExpanded ? 'md:hidden' : ''}`}>{label}</span>
    </NavLink>
  );
}

/**
 * Menu lateral. `isExpanded`/`onToggle` (collapse "berruga", so relevante a
 * partir do `md`) e `abertaNoMobile`/`onFecharNoMobile` (drawer full-screen
 * abaixo do `md`) vem do Layout - este componente so decide como se
 * desenhar em cada estado.
 *
 * Abaixo do `md`: `<aside>` vira um overlay `fixed` de largura fixa
 * (`w-64`), escondido por padrao fora da tela (`-translate-x-full`) e
 * deslizando pra dentro (`translate-x-0`) quando `abertaNoMobile` - o
 * Layout renderiza o backdrop escuro por cima do resto da tela junto com
 * esse estado. A partir do `md`, o overlay vira o comportamento antigo
 * (sempre visivel, empurra o conteudo, largura variavel conforme
 * `isExpanded`) - por isso a maioria das classes condicionais aqui usa o
 * padrao "valor base = como fica expandido/mobile, com um `md:valor-b`
 * adicional só quando `!isExpanded`" (ver comentario do `ItemDireto`
 * acima) em vez do padrao antigo (`isExpanded ? a : b` sem prefixo),
 * que so fazia sentido quando a Sidebar nunca saia do layout lado-a-lado.
 *
 * Accordion EXCLUSIVO: `categoriaAberta` guarda no maximo 1 chave por vez
 * (nao um Set/array) - abrir uma categoria fecha a outra automaticamente,
 * so por causa do proprio formato do estado. A suavidade do abrir/fechar e
 * via `max-height`/`opacity` com `transition-all duration-300` (Tailwind
 * nao anima `height: auto`, e o conteudo tem tamanho variavel - por isso
 * um `max-h-[...]` generoso em vez de medir a altura real via ref).
 */
export default function Sidebar({ isExpanded, onToggle, abertaNoMobile, onFecharNoMobile }) {
  const { theme, toggleTheme } = useTheme();
  const { logout, empresa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const escuro = theme === 'dark';
  // `empresa` comeca `null` ate o AuthContext popular (ver
  // AuthContext.jsx#obterEmpresaInicial/refreshEmpresa) - itens de modulo
  // ficam ocultos ate esse momento (`[]`), mesma convencao defensiva de
  // App.jsx#RotasDaAplicacao (evita mostrar um item cujo modulo real ainda
  // nao se sabe se esta liberado).
  const modulos = empresa?.modulos ?? [];

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

  function handleAbrirConfiguracoes() {
    onFecharNoMobile?.();
    // "/configuracoes" sozinho ja cai na aba "Dados da Loja" por padrao
    // (ver Configuracoes.jsx - abaInicial so muda com "?aba=..." na URL).
    navigate('/configuracoes');
  }

  function alternarCategoria(chave) {
    setCategoriaAberta((atual) => (atual === chave ? null : chave));
  }

  const itemClasses = `flex items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold transition-colors ${
    !isExpanded ? 'md:justify-center md:px-0' : ''
  }`;

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900 ${
        abertaNoMobile ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 ${!isExpanded ? 'md:w-20' : 'md:w-64'}`}
    >
      {/* Botao de recolher/expandir (desktop) - "berruga" flutuando na borda
          direita, centralizada verticalmente na tela inteira. So aparece a
          partir do `md` (`hidden md:flex`): abaixo disso a Sidebar e um
          drawer full-screen que abre/fecha pelo botao hamburguer + pelo X
          interno + pelo backdrop, nao por um collapse pra icone-so. Se
          posiciona relativo a este <aside> porque `position: fixed` (classe
          `fixed` acima) JA e, por si so, um contexto de posicionamento
          valido pra um filho `absolute` - nao precisa (e nao deve) adicionar
          `relative` aqui tambem: as duas juntas no mesmo elemento conflitam
          (ja causou um bug real, Sidebar virando `position: relative` sem
          querer e quebrando o offset do <main> no Layout.jsx). */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isExpanded ? 'Recolher menu' : 'Expandir menu'}
        title={isExpanded ? 'Recolher menu' : 'Expandir menu'}
        className="absolute top-1/2 -right-4 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-4 border-slate-900 bg-blue-600 text-white transition-transform hover:scale-110 md:flex"
      >
        {isExpanded ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
      </button>

      {/* Cabecalho fixo - "SAE" nunca some, so muda de alinhamento
          (esquerda vs. centro) conforme o menu esta expandido ou recolhido
          A PARTIR DO `md` (no mobile e sempre alinhado a esquerda, ja que o
          drawer e sempre "expandido"). O X de fechar só existe no mobile
          (`md:hidden`) - a partir do `md` a Sidebar nao "fecha" mais nesse
          sentido. */}
      <div className="flex shrink-0 items-center justify-between px-4 py-6">
        <div className={`flex items-center justify-start ${!isExpanded ? 'md:justify-center' : ''}`}>
          <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">SAE</span>
        </div>
        <button
          type="button"
          onClick={onFecharNoMobile}
          aria-label="Fechar menu"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 md:hidden"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      {/* Navegacao - unica parte que rola. A barra de rolagem fica
          escondida visualmente (webkit/IE/Firefox) sem desativar o scroll
          em si: o mouse/touch/teclado continuam rolando normalmente,
          so o "trilho" visivel some. */}
      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Navegacao principal"
      >
        <ItemDireto {...ITEM_DASHBOARD} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />

        {modulos.includes('pdv') && (
          <NavLink
            to={ITEM_PDV.to}
            onClick={onFecharNoMobile}
            title={!isExpanded ? ITEM_PDV.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-lg font-bold text-white shadow-sm transition-colors ${
                !isExpanded ? 'md:justify-center md:px-0' : ''
              } ${isActive ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'}`
            }
          >
            <Zap size={22} className="shrink-0" aria-hidden="true" />
            <span className={`flex-1 text-left ${!isExpanded ? 'md:hidden' : ''}`}>{ITEM_PDV.label}</span>
          </NavLink>
        )}

        {CATEGORIAS_MENU.map(({ chave, titulo, icon: Icon, itens }) => {
          const itensVisiveis = itens.filter((item) => modulos.includes(item.modulo));
          // Categoria inteira some se nenhum dos modulos dela estiver
          // liberado pro segmento desta empresa - uma gaveta vazia (so o
          // cabecalho, sem nenhum link dentro) seria um beco sem saida.
          if (itensVisiveis.length === 0) return null;

          const aberto = categoriaAberta === chave;
          const contemAtiva = itensVisiveis.some((item) => item.to === location.pathname);

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
                <span className={`flex-1 text-left ${!isExpanded ? 'md:hidden' : ''}`}>{titulo}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 transition-transform duration-300 ${aberto ? 'rotate-180' : ''} ${
                    !isExpanded ? 'md:hidden' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* Gaveta da categoria - sempre presente no mobile (onde a
                  Sidebar e sempre "expandida"); a partir do `md`, some por
                  completo quando a Sidebar esta recolhida (`md:hidden`),
                  independente de `aberto` - nao ha espaco pra um flyout
                  nesse modo icone-so. */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${!isExpanded ? 'md:hidden' : ''} ${
                  aberto ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="flex flex-col gap-1 py-1 pl-4">
                  {itensVisiveis.map(({ label, to, icon: SubIcon }) => (
                    <NavLink
                      key={label}
                      to={to}
                      onClick={onFecharNoMobile}
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
            </div>
          );
        })}

        <ItemDireto {...ITEM_INBOX} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />
        <ItemDireto {...ITEM_MODULOS} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />
        <ItemDireto {...ITEM_SUPORTE} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />
      </nav>

      {/* Rodape fixo - fora da area de scroll da nav (e irmao dela, nao
          filho), entao nunca rola junto com a lista de links. */}
      <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
        {/* Tema + atalho de Configuracoes. Bug corrigido aqui: a
            engrenagem tinha `md:hidden` (sumia no collapse de desktop) -
            ela deve aparecer SEMPRE, so muda de layout. Expandido/mobile:
            lado a lado (`flex-row`, tema com `flex-1` ocupando o espaco
            restante). Recolhido (`md:w-20`, estreito demais pra 2 botoes
            lado a lado): empilha vertical (`md:flex-col md:gap-4`) e os 2
            viram quadrados de tamanho fixo (`md:w-11 md:h-11`) em vez de um
            deles esticar (`flex-1` some nesse modo). */}
        <div className={`flex items-center gap-2 ${!isExpanded ? 'md:flex-col md:gap-4' : ''}`}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema"
            title={!isExpanded ? 'Alternar entre modo claro e escuro' : undefined}
            className={`flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${
              !isExpanded ? 'md:h-11 md:w-11 md:flex-none md:justify-center md:p-0' : ''
            }`}
          >
            {escuro ? (
              <Sun size={22} className="shrink-0" aria-hidden="true" />
            ) : (
              <Moon size={22} className="shrink-0" aria-hidden="true" />
            )}
            <span className={`flex-1 text-left ${!isExpanded ? 'md:hidden' : ''}`}>
              {escuro ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleAbrirConfiguracoes}
            aria-label="Configurações"
            title="Configurações"
            className={`flex shrink-0 items-center justify-center rounded-xl p-3 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${
              !isExpanded ? 'md:h-11 md:w-11 md:p-0' : ''
            }`}
          >
            <Settings size={22} className="shrink-0" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          title={!isExpanded ? 'Sair' : undefined}
          className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 ${
            !isExpanded ? 'md:mt-4 md:h-11 md:w-11 md:justify-center md:p-0 md:mx-auto' : ''
          }`}
        >
          <LogOut size={22} className="shrink-0" aria-hidden="true" />
          <span className={`flex-1 text-left ${!isExpanded ? 'md:hidden' : ''}`}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
