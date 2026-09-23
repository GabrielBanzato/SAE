import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Placeholder from './components/Placeholder';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import { useAuth } from './context/AuthContext';

// Paginas de negocio via import dinamico (code splitting por rota - cada
// uma vira um chunk JS proprio no build do Vite, so baixado quando o
// usuario navega pra aquela rota). Login/Cadastro ficam com import estatico
// de proposito: sao o primeiro ponto de contato de quem NAO tem sessao
// ainda, carregar tudo de uma vez ali evita um Suspense extra bem no
// caminho mais critico do app (entrar no sistema).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Vendas = lazy(() => import('./pages/Vendas'));
const PDV = lazy(() => import('./pages/PDV'));
const HistoricoVendas = lazy(() => import('./pages/HistoricoVendas'));
const Produtos = lazy(() => import('./pages/Produtos'));
const CalculadoraPrecificacao = lazy(() => import('./pages/CalculadoraPrecificacao'));
const Estoque = lazy(() => import('./pages/Estoque'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Lancamentos = lazy(() => import('./pages/Lancamentos'));
const ControleFinanceiro = lazy(() => import('./pages/ControleFinanceiro'));
const DRE = lazy(() => import('./pages/DRE'));
const Notas = lazy(() => import('./pages/Notas'));
const Agenda = lazy(() => import('./pages/Agenda'));
const QuadroTarefas = lazy(() => import('./pages/QuadroTarefas'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Modulos = lazy(() => import('./pages/Modulos'));
const Suporte = lazy(() => import('./pages/Suporte'));
const InboxUnificado = lazy(() => import('./pages/InboxUnificado'));
const SupraAdmin = lazy(() => import('./pages/SupraAdmin'));

/**
 * Rotas de pagina LIGADAS a um modulo de negocio (chave precisa bater com
 * MODULOS_VALIDOS em api/src/services/auth.service.js, e com os campos
 * `modulo` de components/Sidebar.jsx) - só entram na árvore de rotas se a
 * chave estiver em `empresa.modulos` (AuthContext, populado pelo
 * login/registro e por GET /empresa/dados - fonte da verdade agora e
 * `Empresa.modulosAtivos`, editavel pela propria empresa em Modulos.jsx,
 * NAO MAIS calculado do segmento a cada leitura - ver arquitetura modular
 * de 2026-09-22). Dashboard, Configuracoes, Modulos, Suporte e Notas ficam
 * FORA desta lista de proposito - sao acessiveis a qualquer empresa,
 * independente dos modulos ativos (ver App.jsx mais abaixo, onde entram
 * direto na árvore).
 *
 * 'vendas'/'financeiro'/'produtos' sao os modulos BASE (MODULOS_BASE em
 * auth.service.js) - sempre presentes em `empresa.modulos` pra toda
 * empresa, nunca aparecem como toggle removível em Modulos.jsx.
 */
const ROTAS_POR_MODULO = [
  { modulo: 'vendas', path: '/vendas', element: <Vendas /> },
  { modulo: 'vendas', path: '/historico-vendas', element: <HistoricoVendas /> },
  { modulo: 'produtos', path: '/produtos', element: <Produtos /> },
  { modulo: 'precificacao', path: '/precificacao', element: <CalculadoraPrecificacao /> },
  { modulo: 'estoque_avancado', path: '/estoque', element: <Estoque /> },
  { modulo: 'clientes', path: '/clientes', element: <Clientes /> },
  { modulo: 'financeiro', path: '/lancamentos', element: <Lancamentos /> },
  { modulo: 'financeiro', path: '/financeiro', element: <ControleFinanceiro /> },
  { modulo: 'financeiro', path: '/dre', element: <DRE /> },
  { modulo: 'agenda', path: '/agenda', element: <Agenda /> },
  // Desacoplado de 'agenda' nesta tarefa - o Quadro de Tarefas Kanban virou
  // um modulo opcional com toggle proprio na App Store (card "Gestão de
  // Equipe/Kanban"), independente de a empresa usar a Agenda ou nao (mesmo
  // que as duas ainda compartilhem a tabela `Tarefa`, ver schema.prisma).
  { modulo: 'tarefas', path: '/tarefas', element: <QuadroTarefas /> },
  { modulo: 'relatorios', path: '/relatorios', element: <Relatorios /> },
  // Inbox Unificado de WhatsApp - antes sempre acessivel (sem modulo), agora
  // com toggle proprio na App Store (card "Inbox de Inteligência
  // Artificial").
  { modulo: 'ia_whatsapp', path: '/inbox', element: <InboxUnificado /> },
];

function CarregandoRota() {
  return (
    <div className="flex min-h-[320px] items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
      <Loader2 size={28} className="animate-spin" aria-hidden="true" />
      <span className="text-lg font-semibold">Carregando...</span>
    </div>
  );
}

/**
 * Area autenticada: monta as rotas de modulo dinamicamente a partir de
 * `empresa.modulos`. Enquanto `empresa` ainda e `null` (primeiro load logo
 * apos F5/login, antes do AuthContext terminar de popular esse estado -
 * ver AuthContext.jsx#obterEmpresaInicial/persistirSessao), NENHUM modulo e
 * tratado como indisponivel ainda: o catch-all mostra um loading, nao
 * "Modulo indisponivel" - senao um F5 numa rota de modulo válida piscaria
 * a mensagem de bloqueio por um instante antes da lista real chegar.
 */
function RotasDaAplicacao() {
  const { empresa, usuario } = useAuth();
  const carregandoEmpresa = empresa === null;
  const modulos = empresa?.modulos ?? [];
  // Painel Supra Admin (2026-09-22) - gate SEPARADO do mecanismo de modulo
  // (nao e um "modulo" de negocio de uma empresa, e um nivel de acesso da
  // PLATAFORMA inteira, ver Usuario.nivelAcesso no schema.prisma). Sem
  // "carregando" especial aqui - `usuario` (diferente de `empresa`) ja vem
  // populado desde o primeiro render via localStorage (AuthContext
  // #obterUsuarioInicial), nao existe um estado transitorio "ainda nao sei".
  const ehSuperAdmin = usuario?.nivelAcesso === 'SUPERADMIN';

  return (
    <Suspense fallback={<CarregandoRota />}>
      <Routes>
        {/* Publicas - nao passam pelo PrivateRoute. */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />

        {/* Tudo daqui pra baixo exige sessao ativa (ver PrivateRoute). */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />

            {!carregandoEmpresa &&
              ROTAS_POR_MODULO.map(
                ({ modulo, path, element }) => modulos.includes(modulo) && <Route key={path} path={path} element={element} />
              )}

            {/* Sempre acessiveis, independente de segmento/modulo. */}
            <Route path="/notas" element={<Notas />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/modulos" element={<Modulos />} />
            <Route path="/suporte" element={<Suporte />} />
            {/* Painel Supra Admin - so entra na arvore de rotas se o usuario
                logado for SUPERADMIN (ver comentario de `ehSuperAdmin`
                acima). Sem isso, navegar direto pra /supra-admin cai no
                catch-all "Módulo indisponível" abaixo - mensagem um pouco
                imprecisa pra este caso especifico, mas evita revelar que a
                rota existe pra quem nao devia nem saber disso. */}
            {ehSuperAdmin && <Route path="/supra-admin" element={<SupraAdmin />} />}

            {/* Catch-all: cobre tanto uma URL que nunca existiu quanto uma
                rota de modulo que existe no app mas nao esta ativa pra esta
                empresa (ela simplesmente nao foi registrada acima, entao
                cai aqui). */}
            <Route
              path="*"
              element={
                carregandoEmpresa ? (
                  <CarregandoRota />
                ) : (
                  <Placeholder
                    titulo="Módulo indisponível"
                    icon={Lock}
                    descricao="Este módulo está desativado para a sua empresa no momento."
                    corpoTitulo="Módulo não ativado"
                    corpoTexto="Ative este módulo na página Módulos para liberar esta funcionalidade."
                  />
                )
              }
            />
          </Route>

          {/* PDV (Frente de Loja): de proposito FORA do `<Route element={<Layout />}>`
              acima - tela cheia, sem Sidebar (ver pages/PDV.jsx). Modulo
              'pdv_touch' (opcional, App Store) - separado de 'vendas' desde
              a arquitetura modular de 2026-09-22 (antes os dois dividiam a
              chave 'pdv'). Se nao renderizada (modulo ausente), o catch-all
              `*` da Layout acima ja cobre `/pdv` (com a chrome normal,
              "Módulo indisponível") - especificidade de rota do React
              Router sempre prioriza este match exato sobre aquele wildcard
              quando os dois estao presentes. */}
          {!carregandoEmpresa && modulos.includes('pdv_touch') && <Route path="/pdv" element={<PDV />} />}
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RotasDaAplicacao />
    </BrowserRouter>
  );
}
