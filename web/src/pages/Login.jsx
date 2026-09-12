import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import CampoTexto from '../components/CampoTexto';

export default function Login() {
  const { login, carregando, estaAutenticado } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');

  // Ja logado tentando abrir /login direto (ex.: link salvo) - manda pro Dashboard.
  if (estaAutenticado) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    try {
      await login(email.trim(), senha);
      navigate('/', { replace: true });
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar. Verifique suas credenciais.');
    }
  }

  return (
    <AuthLayout titulo="Bem-vindo de volta" subtitulo="Entre para acessar o painel do seu negócio.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <CampoTexto
          label="E-mail"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="voce@seunegocio.com.br"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <CampoTexto
          label="Senha"
          icon={Lock}
          type={mostrarSenha ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          required
          endAdornment={
            <button
              type="button"
              onClick={() => setMostrarSenha((atual) => !atual)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {mostrarSenha ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          }
        />

        {erro && (
          <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-xl font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={22} aria-hidden="true" />
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="mt-8 text-center text-lg text-slate-500 dark:text-slate-400">
        Ainda não tem uma conta?{' '}
        <Link to="/cadastro" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
          Cadastre sua loja
        </Link>
      </p>
    </AuthLayout>
  );
}
