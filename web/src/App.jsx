import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2, Lock, ShieldOff } from 'lucide-react';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Placeholder from './components/Placeholder';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
// Import estatico (nao lazy) pelo mesmo motivo de Login/Cadastro: e o caminho
// obrigatorio de quem acabou de entrar com senha temporaria.
import TrocarSenhaObrigatoria from './pages/TrocarSenhaObrigatoria';
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
const ChamadoChat = lazy(() => import('./pages/ChamadoChat'));
const AlterarSenha = lazy(() => import('./pages/AlterarSenha'));
const InboxUnificado = lazy(() => import('./pages/InboxUnificado'));
// Painel Master (Supra Admin) - layout e rotas PROPRIAS, deliberadamente
// fora da arvore de <Layout /> normal (ver comentario de `ehSuperAdmin`
// mais abaixo e SupraAdminLayout.jsx - pedido explicito, 2026-09-23, pra
// nao compartilhar o mesmo menu de uma empresa cliente comum).
const SupraAdminLayout = lazy(() => import('./pages/superadmin/SupraAdminLayout'));
const EmpresasClientes = lazy(() => import('./pages/superadmin/EmpresasClientes'));
const ChamadosSuporte = lazy(() => import('./pages/superadmin/ChamadosSuporte'));
const ChamadoDetalhe = lazy(() => import('./pages/superadmin/ChamadoDetalhe'));
const ConfiguracoesGlobais = lazy(() => import('./pages/superadmin/ConfiguracoesGlobais'));

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
  { modulo: 'vendas', permissao: 'VER_VENDAS', path: '/vendas', element: <Vendas /> },
  { modulo: 'vendas', permissao: 'VER_VENDAS', path: '/historico-vendas', element: <HistoricoVendas /> },
  { modulo: 'produtos', permissao: 'VER_PRODUTOS', path: '/produtos', element: <Produtos /> },
  { modulo: 'precificacao', permissao: 'VER_PRODUTOS', path: '/precificacao', element: <CalculadoraPrecificacao /> },
  { modulo: 'estoque_avancado', permissao: 'VER_ESTOQUE', path: '/estoque', element: <Estoque /> },
  { modulo: 'clientes', permissao: 'VER_CLIENTES', path: '/clientes', element: <Clientes /> },
  { modulo: 'financeiro', permissao: 'VER_FINANCEIRO', path: '/lancamentos', element: <Lancamentos /> },
  { modulo: 'financeiro', permissao: 'VER_FINANCEIRO', path: '/financeiro', element: <ControleFinanceiro /> },
  { modulo: 'financeiro', permissao: 'VER_FINANCEIRO', path: '/dre', element: <DRE /> },
  { modulo: 'agenda', permissao: 'VER_AGENDA', path: '/agenda', element: <Agenda /> },
  // Desacoplado de 'agenda' nesta tarefa - o Quadro de Tarefas Kanban virou
  // um modulo opcional com toggle proprio na App Store (card "Gestão de
  // Equipe/Kanban"), independente de a empresa usar a Agenda ou nao (mesmo
  // que as duas ainda compartilhem a tabela `Tarefa`, ver schema.prisma).
  { modulo: 'tarefas', permissao: 'VER_TAREFAS', path: '/tarefas', element: <QuadroTarefas /> },
  { modulo: 'relatorios', permissao: 'VER_RELATORIOS', path: '/relatorios', element: <Relatorios /> },
  // Inbox Unificado de WhatsApp - antes sempre acessivel (sem modulo), agora
  // com toggle proprio na App Store (card "Inbox de Inteligência
  // Artificial").
  { modulo: 'ia_whatsapp', permissao: 'VER_INBOX', path: '/inbox', element: <InboxUnificado /> },
];

/** Rota existe, modulo ativo, mas o PERFIL do usuario nao libera (RBAC). */
function SemPermissao() {
  return (
    <Placeholder
      titulo="Acesso restrito"
      icon={ShieldOff}
      descricao="Seu perfil de acesso não inclui esta área."
      corpoTitulo="Sem permissão"
      corpoTexto="Se você precisa desta tela para o seu trabalho, peça ao administrador da loja para ajustar o seu perfil."
    />
  );
}

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
  const { empresa, usuario, ehAdmin, pode } = useAuth();
  // RBAC (2026-09-24): rota registrada mas SEM permissao mostra um aviso
  // claro em vez da tela (que so receberia 403 da API em todo fetch).
  const guardar = (permissao, elemento) => (pode(permissao) ? elemento : <SemPermissao />);
  const carregandoEmpresa = empresa === null;
  const modulos = empresa?.modulos ?? [];
  // Sem VER_DASHBOARD, "/" redireciona pra primeira tela que o perfil libera.
  const primeiraRotaPermitida = ROTAS_POR_MODULO.find(
    ({ modulo, permissao }) => modulos.includes(modulo) && pode(permissao)
  )?.path;
  // Painel Supra Admin (2026-09-22) - gate SEPARADO do mecanismo de modulo
  // (nao e um "modulo" de negocio de uma empresa, e um nivel de acesso da
  // PLATAFORMA inteira, ver Usuario.nivelAcesso no schema.prisma). Sem
  // "carregando" especial aqui - `usuario` (diferente de `empresa`) ja vem
  // populado desde o primeiro render via localStorage (AuthContext
  // #obterUsuarioInicial), nao existe um estado transitorio "ainda nao sei".
  const ehSuperAdmin = usuario?.nivelAcesso === 'SUPERADMIN';

  // Senha temporaria pendente (convite / redefinida pelo admin): o app
  // inteiro vira SO a tela de troca - nenhuma rota de negocio monta ate a
  // pessoa definir a senha dela (a API tambem recusa, 403
  // TROCA_SENHA_OBRIGATORIA). Login/Cadastro continuam acessiveis (sair e
  // entrar com outra conta).
  if (usuario?.deveTrocarSenha) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="*" element={<TrocarSenhaObrigatoria />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<CarregandoRota />}>
      <Routes>
        {/* Publicas - nao passam pelo PrivateRoute. */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />

        {/* Tudo daqui pra baixo exige sessao ativa (ver PrivateRoute). */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            {/* Sem VER_DASHBOARD: "/" (pagina de entrada pos-login) leva pra
                primeira tela que o perfil libera, em vez de "Acesso restrito". */}
            <Route
              path="/"
              element={
                pode('VER_DASHBOARD') ? (
                  <Dashboard />
                ) : carregandoEmpresa ? (
                  <CarregandoRota />
                ) : primeiraRotaPermitida ? (
                  <Navigate to={primeiraRotaPermitida} replace />
                ) : (
                  <SemPermissao />
                )
              }
            />

            {!carregandoEmpresa &&
              ROTAS_POR_MODULO.map(
                ({ modulo, permissao, path, element }) =>
                  modulos.includes(modulo) && <Route key={path} path={path} element={guardar(permissao, element)} />
              )}

            {/* Sempre acessiveis, independente de segmento/modulo. */}
            <Route path="/notas" element={guardar('VER_FINANCEIRO', <Notas />)} />
            {/* Configuracoes/Modulos (equipe, perfis, assinatura, App Store) - so admin. */}
            <Route path="/configuracoes" element={ehAdmin ? <Configuracoes /> : <SemPermissao />} />
            <Route path="/modulos" element={ehAdmin ? <Modulos /> : <SemPermissao />} />
            <Route path="/suporte" element={<Suporte />} />
            {/* Sempre acessivel (admin ou nao) - botao da chave no rodape da Sidebar. */}
            <Route path="/conta/senha" element={<AlterarSenha />} />
            {/* Chat de um chamado (2026-09-23) - dentro do Layout, mantem a Sidebar. */}
            <Route path="/suporte/chamado/:id" element={<ChamadoChat />} />

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
          {!carregandoEmpresa && modulos.includes('pdv_touch') && <Route path="/pdv" element={guardar('VER_VENDAS', <PDV />)} />}

          {/* Painel Master (Supra Admin): de proposito FORA do
              `<Route element={<Layout />}>` acima, mesmo espirito do PDV -
              layout PROPRIO (`SupraAdminLayout`, sidebar/menu dedicados,
              nao compartilha a Sidebar de uma empresa cliente comum, ver
              Sidebar.jsx onde o link agora abre numa aba nova). So entra na
              arvore de rotas se o usuario logado for SUPERADMIN (ver
              `ehSuperAdmin` acima) - se nao, `/supra-admin` cai no catch-all
              `*` da Layout normal ("Módulo indisponível"), mesma logica
              defensiva de antes (nao revela que a rota existe pra quem nao
              devia nem saber). `index` redireciona a raiz `/supra-admin`
              pra `/supra-admin/empresas` - a aba inicial de sempre. */}
          {ehSuperAdmin && (
            <Route path="/supra-admin" element={<SupraAdminLayout />}>
              <Route index element={<Navigate to="empresas" replace />} />
              <Route path="empresas" element={<EmpresasClientes />} />
              <Route path="chamados" element={<ChamadosSuporte />} />
              {/* Chamado aberto + chat (2026-09-23) - dentro do SupraAdminLayout, mantem a sidebar roxa. */}
              <Route path="chamados/:id" element={<ChamadoDetalhe />} />
              <Route path="configuracoes" element={<ConfiguracoesGlobais />} />
            </Route>
          )}
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
