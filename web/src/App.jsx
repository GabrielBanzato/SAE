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
const Notas = lazy(() => import('./pages/Notas'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Modulos = lazy(() => import('./pages/Modulos'));
const Suporte = lazy(() => import('./pages/Suporte'));

/**
 * Rotas de pagina LIGADAS a um modulo de negocio (chave precisa bater com
 * MAPA_MODULOS em api/src/services/auth.service.js, e com os campos
 * `modulo` de components/Sidebar.jsx) - só entram na árvore de rotas se a
 * chave estiver em `empresa.modulos` (AuthContext, populado pelo
 * login/registro e por GET /empresa/dados). Dashboard, Configuracoes,
 * Modulos, Suporte e Notas ficam FORA desta lista de proposito - sao
 * acessiveis a qualquer empresa, independente do segmento (ver App.jsx
 * mais abaixo, onde entram direto na árvore).
 */
const ROTAS_POR_MODULO = [
  { modulo: 'pdv', path: '/vendas', element: <Vendas /> },
  { modulo: 'pdv', path: '/historico-vendas', element: <HistoricoVendas /> },
  { modulo: 'produtos', path: '/produtos', element: <Produtos /> },
  { modulo: 'precificacao', path: '/precificacao', element: <CalculadoraPrecificacao /> },
  { modulo: 'estoque_avancado', path: '/estoque', element: <Estoque /> },
  { modulo: 'clientes', path: '/clientes', element: <Clientes /> },
  { modulo: 'financeiro', path: '/lancamentos', element: <Lancamentos /> },
  { modulo: 'financeiro', path: '/financeiro', element: <ControleFinanceiro /> },
  { modulo: 'agenda', path: '/agenda', element: <Agenda /> },
  { modulo: 'relatorios', path: '/relatorios', element: <Relatorios /> },
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
  const { empresa } = useAuth();
  const carregandoEmpresa = empresa === null;
  const modulos = empresa?.modulos ?? [];

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

            {/* Catch-all: cobre tanto uma URL que nunca existiu quanto uma
                rota de modulo que existe no app mas nao pra esta empresa
                (ela simplesmente nao foi registrada acima, entao cai aqui). */}
            <Route
              path="*"
              element={
                carregandoEmpresa ? (
                  <CarregandoRota />
                ) : (
                  <Placeholder
                    titulo="Módulo indisponível"
                    icon={Lock}
                    descricao="Esta funcionalidade não está disponível para o segmento de atuação da sua empresa."
                    corpoTitulo="Módulo não incluído no seu segmento"
                    corpoTexto="Fale com o suporte ou ajuste o segmento de atuação em Configurações > Dados da Loja para liberar mais funcionalidades."
                  />
                )
              }
            />
          </Route>

          {/* PDV (Frente de Loja): de proposito FORA do `<Route element={<Layout />}>`
              acima - tela cheia, sem Sidebar (ver pages/PDV.jsx). Mesmo
              modulo 'pdv' que ja controla `/vendas`/`/historico-vendas` -
              nao existe uma chave de modulo separada so pra essa tela. Se
              nao renderizada (modulo ausente), o catch-all `*` da Layout
              acima ja cobre `/pdv` (com a chrome normal, "Módulo
              indisponível") - especificidade de rota do React Router
              sempre prioriza este match exato sobre aquele wildcard quando
              os dois estao presentes. */}
          {!carregandoEmpresa && modulos.includes('pdv') && <Route path="/pdv" element={<PDV />} />}
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
