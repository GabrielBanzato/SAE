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
 * Reidrata `empresa` (inclui `modulos`, calculado no backend a partir do
 * segmento - ver auth.service.js#MAPA_MODULOS) do localStorage antes mesmo
 * do primeiro GET /empresa/dados resolver. Sem isso, todo F5 numa rota de
 * modulo (ex.: /estoque) comecaria com `empresa === null` e App.jsx não
 * saberia ainda se aquele modulo esta liberado - só null (nunca um objeto
 * "vazio") sinaliza "ainda não sei", ver `RotasDaAplicacao` em App.jsx.
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

  const value = {
    usuario,
    empresa,
    estaAutenticado: Boolean(usuario),
    carregando,
    login,
    register,
    logout,
    refreshEmpresa,
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
