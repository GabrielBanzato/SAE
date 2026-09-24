import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { TOKEN_KEY, USER_KEY, EMPRESA_KEY } from '../services/api';

const AuthContext = createContext(null);

function obterUsuarioInicial() {
  try {
    const salvo = localStorage.getItem(USER_KEY);
    return salvo ? JSON.parse(salvo) : null;
  } catch {
    return null;
  }
}

/**
 * Reidrata `empresa` (inclui `modulos` - array de chaves de modulo ativas,
 * persistido em `Empresa.modulosAtivos` no backend e editavel pela propria
 * empresa em Modulos.jsx via `PUT /empresa/modulos`, arquitetura modular
 * de 2026-09-22 - NAO MAIS calculado do segmento a cada leitura, ver
 * auth.service.js) do localStorage antes mesmo do primeiro
 * GET /empresa/dados resolver. Sem isso, todo F5 numa rota de modulo (ex.:
 * /estoque) comecaria com `empresa === null` e App.jsx não saberia ainda se
 * aquele modulo esta ativo - só null (nunca um objeto "vazio") sinaliza
 * "ainda não sei", ver `RotasDaAplicacao` em App.jsx. `empresa.modulos` e o
 * unico lugar que qualquer componente (Sidebar.jsx, App.jsx, Modulos.jsx)
 * precisa ler pra saber o que esta ligado - nao existe (nem precisa) um
 * Context separado so pra isso.
 */
function obterEmpresaInicial() {
  try {
    const salvo = localStorage.getItem(EMPRESA_KEY);
    return salvo ? JSON.parse(salvo) : null;
  } catch {
    return null;
  }
}

/**
 * Contexto global de autenticacao. Guarda o usuario logado (espelhado em
 * localStorage, ao lado do token) e expoe `login`/`register`/`logout` pra
 * qualquer tela da aplicacao.
 *
 * O interceptor de resposta do axios (`services/api.js`) dispara o evento
 * `sae:unauthorized` quando o backend responde 401 pra um token que a
 * gente pensava ser valido - o listener abaixo mantem o estado do React
 * sincronizado com o localStorage nesse caso (sem ele, o axios limparia o
 * localStorage mas a tela continuaria achando que o usuario esta logado
 * ate o proximo reload).
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(obterUsuarioInicial);
  const [empresa, setEmpresa] = useState(obterEmpresaInicial);
  const [carregando, setCarregando] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EMPRESA_KEY);
    setUsuario(null);
    setEmpresa(null);
  }, []);

  useEffect(() => {
    window.addEventListener('sae:unauthorized', logout);
    return () => window.removeEventListener('sae:unauthorized', logout);
  }, [logout]);

  // Senha temporaria (2026-09-24): `usuario.deveTrocarSenha` decide se o app
  // mostra SO a tela de troca (App.jsx). Vem do login//auth/me; este helper
  // tambem e usado quando a API responde 403 TROCA_SENHA_OBRIGATORIA com a
  // sessao ja aberta (evento disparado pelo interceptor em services/api.js)
  // e, com `false`, logo depois de PUT /auth/senha dar certo.
  const definirDeveTrocarSenha = useCallback((valor) => {
    setUsuario((atual) => {
      if (!atual || atual.deveTrocarSenha === valor) return atual;
      const novo = { ...atual, deveTrocarSenha: valor };
      localStorage.setItem(USER_KEY, JSON.stringify(novo));
      return novo;
    });
  }, []);

  useEffect(() => {
    const exigirTroca = () => definirDeveTrocarSenha(true);
    window.addEventListener('sae:troca-senha-obrigatoria', exigirTroca);
    return () => window.removeEventListener('sae:troca-senha-obrigatoria', exigirTroca);
  }, [definirDeveTrocarSenha]);

  // Busca os dados da empresa (inclui `plano`, usado por telas como
  // Relatorios.jsx pra decidir qual variante renderizar) sempre que o
  // usuario logado muda - login, registro, reidratacao do localStorage no
  // primeiro load, ou logout (nesse caso `usuario` vira null e o efeito so
  // limpa `empresa`, sem chamar a API). Exposto como `refreshEmpresa` pra
  // telas que alteram o plano (ex.: Assinatura.jsx) poderem atualizar essa
  // copia cacheada sem esperar um novo login.
  const refreshEmpresa = useCallback(async () => {
    if (!usuario) {
      setEmpresa(null);
      localStorage.removeItem(EMPRESA_KEY);
      return null;
    }
    try {
      const { data } = await api.get('/empresa/dados');
      // `data` já vem com `modulos` (GET /empresa/dados calcula a partir do
      // segmento atual - ver empresa.service.js#obterDados) - persistido
      // aqui pra sobreviver a um F5 sem esperar essa chamada de novo (ver
      // obterEmpresaInicial acima).
      setEmpresa(data);
      localStorage.setItem(EMPRESA_KEY, JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  }, [usuario]);

  useEffect(() => {
    refreshEmpresa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // Reidrata `usuario` com o schema ATUAL do backend uma vez por boot
  // (correcao de bug, 2026-09-23) - o objeto do localStorage so era gravado
  // no login, entao uma sessao aberta antes de um campo novo existir
  // (`codigoUsuario`, Painel Master - Etapa 1) ficava sem ele pra sempre ate
  // um novo login ("Seu ID" = "-----" em Suporte.jsx). So troca o estado se
  // algo mudou de fato - evita disparar o `refreshEmpresa` acima de novo a
  // toa (ele depende de `usuario`).
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUsuario((atual) => {
          const novo = { ...atual, ...data };
          if (JSON.stringify(novo) === JSON.stringify(atual)) return atual;
          localStorage.setItem(USER_KEY, JSON.stringify(novo));
          return novo;
        });
      })
      .catch(() => {});
  }, []);

  /**
   * `resultado.empresa` (login/register) já chega com `modulos` (ver
   * auth.service.js) - salvo aqui ANTES do primeiro GET /empresa/dados
   * (disparado logo em seguida pelo efeito acima) resolver, pra App.jsx
   * já saber quais rotas montar assim que `estaAutenticado` vira `true`,
   * sem esperar uma segunda ida ao servidor.
   */
  function persistirSessao(resultado) {
    localStorage.setItem(TOKEN_KEY, resultado.token);
    localStorage.setItem(USER_KEY, JSON.stringify(resultado.usuario));
    setUsuario(resultado.usuario);
    if (resultado.empresa) {
      localStorage.setItem(EMPRESA_KEY, JSON.stringify(resultado.empresa));
      setEmpresa(resultado.empresa);
    }
  }

  const login = useCallback(async (email, senha) => {
    setCarregando(true);
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      persistirSessao(data);
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Nao foi possivel entrar. Verifique suas credenciais.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const register = useCallback(async (dadosCadastro) => {
    setCarregando(true);
    try {
      const { data } = await api.post('/auth/register', dadosCadastro);
      persistirSessao(data);
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Nao foi possivel concluir o cadastro.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // RBAC (2026-09-24) - `usuario.permissoes`/`ehAdmin` vem do login e do
  // GET /auth/me (reidratado a cada boot). Isto e SO UX (esconder menu/
  // rotas): quem barra de verdade e o `requirePermission` de cada rota da
  // API. Sessao antiga no localStorage (sem `permissoes` ainda) = nao
  // esconde nada ate o /auth/me responder - melhor que piscar "sem acesso"
  // pra quem tem acesso; a API continua barrando o que nao pode.
  const ehAdmin = Boolean(usuario?.ehAdmin ?? usuario?.role === 'admin');
  const pode = useCallback(
    (...permissoes) => {
      if (!usuario) return false;
      if (ehAdmin || !Array.isArray(usuario.permissoes)) return true;
      return permissoes.some((p) => usuario.permissoes.includes(p));
    },
    [usuario, ehAdmin]
  );

  const value = {
    usuario,
    empresa,
    ehAdmin,
    pode,
    estaAutenticado: Boolean(usuario),
    carregando,
    login,
    register,
    logout,
    refreshEmpresa,
    definirDeveTrocarSenha,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth precisa ser usado dentro de um <AuthProvider>.');
  }
  return contexto;
}
