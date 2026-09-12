import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { TOKEN_KEY, USER_KEY } from '../services/api';

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
  const [empresa, setEmpresa] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
      return null;
    }
    try {
      const { data } = await api.get('/empresa/dados');
      setEmpresa(data);
      return data;
    } catch {
      return null;
    }
  }, [usuario]);

  useEffect(() => {
    refreshEmpresa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  function persistirSessao(resultado) {
    localStorage.setItem(TOKEN_KEY, resultado.token);
    localStorage.setItem(USER_KEY, JSON.stringify(resultado.usuario));
    setUsuario(resultado.usuario);
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
