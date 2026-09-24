import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import FormAlterarSenha from '../components/conta/FormAlterarSenha';
import { useAuth } from '../context/AuthContext';

/**
 * Tela UNICA mostrada enquanto `usuario.deveTrocarSenha` (senha temporaria
 * de convite ou redefinida pelo admin) - App.jsx troca a arvore de rotas
 * inteira por esta pagina, sem Sidebar. E so UX: quem obriga de verdade e a
 * API (403 TROCA_SENHA_OBRIGATORIA em tudo menos /auth/me e /auth/senha).
 */
export default function TrocarSenhaObrigatoria() {
  const { usuario, logout, definirDeveTrocarSenha } = useAuth();
  const navigate = useNavigate();

  function handleSair() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout
      titulo={`Olá${usuario?.nome ? `, ${usuario.nome.split(' ')[0]}` : ''}! Defina sua senha`}
      subtitulo="Você entrou com uma senha temporária. Por segurança, crie uma senha pessoal antes de continuar."
    >
      <FormAlterarSenha
        rotuloSenhaAtual="Senha temporária"
        rotuloBotao="Definir senha e entrar"
        onSucesso={() => {
          definirDeveTrocarSenha(false);
          navigate('/', { replace: true });
        }}
      />
      <button
        type="button"
        onClick={handleSair}
        className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <LogOut size={18} aria-hidden="true" />
        Sair
      </button>
    </AuthLayout>
  );
}
