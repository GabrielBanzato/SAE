import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.projeto1.com.br';

export const TOKEN_KEY = 'sae_token';
export const USER_KEY = 'sae_usuario';

/**
 * Instancia central do Axios usada por toda a aplicacao (substitui o
 * wrapper baseado em `fetch` que existia aqui antes).
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Injeta o token salvo pelo AuthContext em toda requisicao - nenhuma tela
// precisa lembrar de mandar o header Authorization manualmente.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Um 401 so significa "sessao expirou/token invalido" quando a gente JA
// tinha um token guardado - sem essa checagem, um 401 de credenciais
// erradas na propria tela de login tambem dispararia esse logout global.
// Dispara um evento (em vez de importar o AuthContext direto aqui, o que
// criaria import circular) para o AuthProvider escutar e sincronizar seu
// estado do React com o localStorage.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new Event('sae:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;

/**
 * Wrapper de compatibilidade com a assinatura estilo `fetch` usada pelas
 * telas existentes (Configuracoes, CalculadoraPrecificacao, Assinatura) -
 * evita reescrever essas chamadas so por causa da troca de fetch pra
 * axios. Resolve com o corpo (`data`) da resposta e rejeita com um Error
 * cuja mensagem vem de `{ error }` do backend, igual ao contrato antigo.
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers } = options;

  try {
    const response = await api.request({ url: path, method, data: body, headers });
    return response.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || 'Erro ao comunicar com o servidor.');
  }
}
