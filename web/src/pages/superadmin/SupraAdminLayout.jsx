import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, Headset, SlidersHorizontal, ShieldAlert, Sun, Moon, LogOut, ArrowLeftCircle, Menu, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Menus/submenus proprios do Painel Master (Painel Master - etapa 1,
 * 2026-09-23) - mesmas 3 secoes que ja existiam como abas dentro de
 * SupraAdmin.jsx, agora rotas de verdade (cada uma com sua propria URL,
 * navegavel/atualizavel com F5, em vez de um estado local `abaAtiva`).
 */
const ITENS_MENU = [
  { label: 'Empresas/Clientes', to: '/supra-admin/empresas', icon: Building2 },
  { label: 'Chamados de Suporte', to: '/supra-admin/chamados', icon: Headset },
  { label: 'Configurações Globais', to: '/supra-admin/configuracoes', icon: SlidersHorizontal },
];

/**
 * Layout dedicado do Painel Master - deliberadamente SEM relacao com
 * `components/Layout.jsx`/`Sidebar.jsx` (o menu de uma empresa cliente
 * comum). Pedido explicito (2026-09-23): o Supra Admin abre numa aba nova
 * do navegador (ver Sidebar.jsx, o link vira `<a target="_blank">`) e nao
 * deve compartilhar o mesmo menu lateral de um cliente - aqui e tratado
 * como uma area administrativa a parte, com sua propria navegacao (esta
 * lista `ITENS_MENU`) e identidade visual (roxo, mesma cor ja usada pro
 * badge "Painel Master" na Sidebar normal, pra sinalizar "zona
 * administrativa" mesmo antes de olhar o conteudo).
 *
 * Estrutura mais simples que `Layout.jsx` de proposito - sem collapse pra
 * icone-so (nao pedido aqui, e esta area tem poucos itens de menu, nao
 * precisa desse recurso) - so um drawer no mobile (`abertoNoMobile`) e uma
 * sidebar fixa sempre visivel a partir do `md`, mesmo padrao de breakpoint
 * do resto do app.
 */
export default function SupraAdminLayout() {
  const [abertoNoMobile, setAbertoNoMobile] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const escuro = theme === 'dark';

  function handleVoltarALoja() {
    // Esta aba/janela inteira volta pro dashboard normal - nao faz sentido
    // abrir MAIS uma aba pra "sair" do Painel Master, a ida ja foi numa aba
    // dedicada (ver Sidebar.jsx).
    navigate('/');
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      {abertoNoMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setAbertoNoMobile(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-purple-900/40 bg-slate-900 text-slate-100 transition-transform duration-300 ease-in-out ${
          abertoNoMobile ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-purple-900/40 px-5 py-6">
          <div className="flex items-center gap-3">
            <ShieldAlert size={26} className="shrink-0 text-purple-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-tight text-white">Painel Master</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">SAE • Supra Admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAbertoNoMobile(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 md:hidden"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Navegação do Painel Master">
          {ITENS_MENU.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setAbertoNoMobile(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
                  isActive ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-purple-900/40 p-3">
          {usuario && (
            <p className="truncate px-4 py-1 text-xs font-medium text-slate-400" title={usuario.email}>
              {usuario.nome}
            </p>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            {escuro ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            {escuro ? 'Modo Claro' : 'Modo Escuro'}
          </button>
          <button
            type="button"
            onClick={handleVoltarALoja}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeftCircle size={18} aria-hidden="true" />
            Voltar à Loja
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-950/40"
          >
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex min-h-screen w-full min-w-0 flex-1 flex-col md:ml-72">
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <button
            type="button"
            onClick={() => setAbertoNoMobile(true)}
            aria-label="Abrir menu"
            className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu size={24} aria-hidden="true" />
          </button>
          <span className="flex items-center gap-2 text-lg font-extrabold text-purple-700 dark:text-purple-400">
            <ShieldAlert size={20} aria-hidden="true" />
            Painel Master
          </span>
        </header>

        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 md:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
