import { NavLink, useNavigate } from 'react-router-dom';
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
  Kanban,
  BarChart3,
  Settings,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  ScrollText,
  ShieldAlert,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Zap,
  FileBarChart,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

/**
 * Menu em grupos fixos (sempre expandidos, sem accordion - simplificado
 * nesta tarefa: a versao anterior usava "gavetas" colapsaveis, trocada por
 * grupos estaticos com um titulo pequeno de separacao, pedido explicito).
 * Dashboard/Modulos/Suporte navegam direto, fora de qualquer grupo.
 *
 * `modulo` em cada item precisa bater com uma chave de MODULOS_VALIDOS
 * (api/src/services/auth.service.js) e com `ROTAS_POR_MODULO` em App.jsx -
 * um item só aparece no menu se essa chave estiver em `empresa.modulos`
 * (fonte da verdade: `Empresa.modulosAtivos`, editavel em Modulos.jsx - ver
 * arquitetura modular de 2026-09-22). Item SEM `modulo` = sempre visível,
 * independente dos modulos ativos (ex.: "Emissor Fiscal" abaixo, pagina
 * mock sem gate nenhum, ver App.jsx).
 */
const GRUPOS_MENU = [
  {
    titulo: 'Comercial',
    itens: [
      // `destaque` (so este item) mantem o estilo verde de atalho rapido
      // que o PDV Rápido ja tinha antes de entrar no grupo - continua
      // sendo a rota de tela cheia sem Sidebar (pages/PDV.jsx), so mudou
      // de posicao (antes ficava sozinho acima de todos os grupos).
      { label: 'PDV Rápido', to: '/pdv', icon: Zap, modulo: 'pdv_touch', permissao: 'VER_VENDAS', destaque: true },
      { label: 'Vendas', to: '/vendas', icon: ShoppingCart, modulo: 'vendas', permissao: 'VER_VENDAS' },
      { label: 'Histórico de Vendas', to: '/historico-vendas', icon: History, modulo: 'vendas', permissao: 'VER_VENDAS' },
      { label: 'Clientes', to: '/clientes', icon: Users, modulo: 'clientes', permissao: 'VER_CLIENTES' },
    ],
  },
  {
    titulo: 'Catálogo',
    itens: [
      { label: 'Produtos', to: '/produtos', icon: Package, modulo: 'produtos', permissao: 'VER_PRODUTOS' },
      { label: 'Precificação', to: '/precificacao', icon: Calculator, modulo: 'precificacao', permissao: 'VER_PRODUTOS' },
      { label: 'Estoque', to: '/estoque', icon: Boxes, modulo: 'estoque_avancado', permissao: 'VER_ESTOQUE' },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { label: 'Lançamentos', to: '/lancamentos', icon: Receipt, modulo: 'financeiro', permissao: 'VER_FINANCEIRO' },
      { label: 'Controle Financeiro', to: '/financeiro', icon: Wallet, modulo: 'financeiro', permissao: 'VER_FINANCEIRO' },
      { label: 'DRE', to: '/dre', icon: FileBarChart, modulo: 'financeiro', permissao: 'VER_FINANCEIRO' },
      { label: 'Relatórios', to: '/relatorios', icon: BarChart3, modulo: 'relatorios', permissao: 'VER_RELATORIOS' },
      // Sem `modulo` de proposito - "/notas" nao depende de modulo contratado
      // (a pagina em si avisa "Módulo Fiscal em Desenvolvimento", Notas.jsx).
      // RBAC (2026-09-24): area fiscal - so aparece pra quem ve o Financeiro.
      { label: 'Emissor Fiscal', to: '/notas', icon: ScrollText, permissao: 'VER_FINANCEIRO' },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { label: 'Agenda', to: '/agenda', icon: CalendarDays, modulo: 'agenda', permissao: 'VER_AGENDA' },
      { label: 'Tarefas', to: '/tarefas', icon: Kanban, modulo: 'tarefas', permissao: 'VER_TAREFAS' },
      { label: 'Inbox WhatsApp', to: '/inbox', icon: MessageCircle, modulo: 'ia_whatsapp', permissao: 'VER_INBOX' },
    ],
  },
];

const ITEM_DASHBOARD = { label: 'Dashboard', to: '/', icon: LayoutDashboard };
const ITEM_MODULOS = { label: 'Módulos', to: '/modulos', icon: LayoutGrid };
const ITEM_SUPORTE = { label: 'Suporte', to: '/suporte', icon: LifeBuoy };

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

/** Item dentro de um grupo (`GRUPOS_MENU`) - um pouco menor que `ItemDireto`, sem indentacao (os grupos nao sao mais gavetas aninhadas). `destaque` reaproveita o estilo verde do antigo atalho isolado do PDV Rápido. */
function ItemGrupo({ label, to, icon: Icon, destaque, isExpanded, aoNavegar }) {
  return (
    <NavLink
      to={to}
      onClick={aoNavegar}
      title={!isExpanded ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-2.5 text-base font-semibold transition-colors ${
          !isExpanded ? 'md:justify-center md:px-0' : ''
        } ${
          destaque
            ? `font-bold text-white shadow-sm ${isActive ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'}`
            : isActive
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`
      }
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />
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
 */
export default function Sidebar({ isExpanded, onToggle, abertaNoMobile, onFecharNoMobile }) {
  const { theme, toggleTheme } = useTheme();
  const { logout, empresa, usuario, ehAdmin, pode } = useAuth();
  const navigate = useNavigate();
  const escuro = theme === 'dark';
  // `empresa` comeca `null` ate o AuthContext popular (ver
  // AuthContext.jsx#obterEmpresaInicial/refreshEmpresa) - itens de modulo
  // ficam ocultos ate esse momento (`[]`), mesma convencao defensiva de
  // App.jsx#RotasDaAplicacao (evita mostrar um item cujo modulo real ainda
  // nao se sabe se esta liberado).
  const modulos = empresa?.modulos ?? [];
  // Painel Supra Admin (2026-09-22) - gate por NIVEL DE ACESSO, nao por
  // modulo (ver comentario equivalente em App.jsx). Escondido do menu
  // padrao pra qualquer LOJISTA, mesmo que descubra a URL direto (a rota
  // em si ja bloqueia pra quem nao e SUPERADMIN, ver App.jsx).
  const ehSuperAdmin = usuario?.nivelAcesso === 'SUPERADMIN';

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

      {/* Navegacao - unica parte que rola. `min-h-0` e o que faz o
          `overflow-y-auto` funcionar de verdade aqui: um filho `flex-1`
          dentro de um `flex-col` tem `min-height: auto` por padrao (o
          "automatic minimum size" dos flex items), entao ele cresce pra
          caber TODO o conteudo em vez de respeitar o espaco disponivel e
          ativar o proprio scroll - na pratica, o ultimo item do menu
          ficava cortado atras do rodape (tema/config/sair) sempre que a
          lista de links era mais alta que a tela. `min-h-0` zera esse
          minimo automatico, entao o flex item para no tamanho que o `flex-1`
          calculou e `overflow-y-auto` finalmente entra em acao. `pb-24`
          garante uma folga extra no fim da lista, pro ultimo link nunca
          ficar colado (ou parcialmente escondido) contra a borda inferior
          do drawer, independente do rodape. A barra de rolagem fica
          escondida visualmente (webkit/IE/Firefox) sem desativar o scroll
          em si: o mouse/touch/teclado continuam rolando normalmente, so o
          "trilho" visivel some. */}
      <nav
        className="flex h-full min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-24 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Navegacao principal"
      >
        {pode('VER_DASHBOARD') && <ItemDireto {...ITEM_DASHBOARD} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />}

        {GRUPOS_MENU.map(({ titulo, itens }) => {
          // DUAS camadas, as duas precisam passar:
          //  1) `modulo`    - a EMPRESA contratou/ativou o modulo (App Store);
          //  2) `permissao` - o PERFIL deste usuario libera a area (RBAC).
          // Item sem `modulo`/`permissao` = sem aquela restricao.
          const itensVisiveis = itens.filter(
            (item) => (!item.modulo || modulos.includes(item.modulo)) && (!item.permissao || pode(item.permissao))
          );
          // Grupo inteiro some se nenhum item dele sobrou - um titulo de
          // grupo sem nenhum link embaixo seria um cabecalho orfao.
          if (itensVisiveis.length === 0) return null;

          return (
            <div key={titulo}>
              <p
                className={`mt-4 mb-1 px-4 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 ${!isExpanded ? 'md:hidden' : ''}`}
              >
                {titulo}
              </p>
              <div className="flex flex-col gap-1">
                {itensVisiveis.map((item) => (
                  <ItemGrupo key={item.label} {...item} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-4">
          {/* App Store (contratar/pagar modulos) - so o admin. */}
          {ehAdmin && <ItemDireto {...ITEM_MODULOS} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />}
          <ItemDireto {...ITEM_SUPORTE} isExpanded={isExpanded} aoNavegar={onFecharNoMobile} />
        </div>

        {/* Painel Supra Admin - so renderiza pro nivel de acesso certo,
            estilo roxo deliberadamente diferente do resto do menu (sinaliza
            "zona administrativa", distinta das telas normais da loja).
            `<a target="_blank">` (nao `<NavLink>`, pedido explicito de
            2026-09-23) - abre numa aba NOVA do navegador, sempre um full
            page load carregando `SupraAdminLayout` (layout proprio, sem
            relacao com esta Sidebar - ver pages/superadmin/). Por ser uma
            navegacao de aba nova, nunca fica "ativo" nesta Sidebar (a aba
            atual continua na tela de onde o clique partiu) - sem sentido
            usar `isActive` do NavLink aqui, por isso o estilo e estatico. */}
        {ehSuperAdmin && (
          <div className="mt-4">
            <p
              className={`mb-1 px-4 text-xs font-bold uppercase tracking-wide text-purple-400 dark:text-purple-500 ${!isExpanded ? 'md:hidden' : ''}`}
            >
              Supra Admin
            </p>
            <a
              href="/supra-admin"
              target="_blank"
              rel="noopener noreferrer"
              title={!isExpanded ? 'Painel Master (abre em nova aba)' : undefined}
              className={`flex items-center gap-3 rounded-xl bg-purple-50 px-4 py-3 text-lg font-bold text-purple-700 transition-colors hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-950/50 ${
                !isExpanded ? 'md:justify-center md:px-0' : ''
              }`}
            >
              <ShieldAlert size={22} className="shrink-0" aria-hidden="true" />
              <span className={`flex-1 text-left ${!isExpanded ? 'md:hidden' : ''}`}>Painel Master</span>
              <ExternalLink size={16} className={`shrink-0 ${!isExpanded ? 'md:hidden' : ''}`} aria-hidden="true" />
            </a>
          </div>
        )}
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

          {/* RBAC: Configuracoes (dados, equipe, perfis, assinatura) e so do admin. */}
          {ehAdmin && (
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
          )}
        </div>

        {/* Acoes da CONTA na mesma linha: Sair + Alterar senha (pra TODOS -
            Configuracoes e so do admin desde o RBAC). Ficou aqui e nao na
            linha do tema porque 3 botoes la espremiam o "Modo Escuro" em 2
            linhas. Recolhido: empilha, igual a linha de cima. */}
        <div className={`mt-1 flex items-center gap-2 ${!isExpanded ? 'md:mt-4 md:flex-col md:gap-4' : ''}`}>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair"
            title={!isExpanded ? 'Sair' : undefined}
            className={`flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 ${
              !isExpanded ? 'md:h-11 md:w-11 md:flex-none md:justify-center md:p-0' : ''
            }`}
          >
            <LogOut size={22} className="shrink-0" aria-hidden="true" />
            <span className={`flex-1 text-left ${!isExpanded ? 'md:hidden' : ''}`}>Sair</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onFecharNoMobile?.();
              navigate('/conta/senha');
            }}
            aria-label="Alterar senha"
            title="Alterar senha"
            className={`flex shrink-0 items-center justify-center rounded-xl p-3 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${
              !isExpanded ? 'md:h-11 md:w-11 md:p-0' : ''
            }`}
          >
            <KeyRound size={22} className="shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
