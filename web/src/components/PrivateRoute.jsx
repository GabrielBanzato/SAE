import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protege rotas que exigem sessao ativa. `estaAutenticado` vem do
 * AuthContext (espelha `sae_token`/`sae_usuario` no localStorage) - sem
 * token, redireciona pra /login em vez de renderizar a rota filha.
 */
export default function PrivateRoute() {
  const { estaAutenticado } = useAuth();

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
