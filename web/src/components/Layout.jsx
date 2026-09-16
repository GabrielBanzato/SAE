import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

const LARGURA_EXPANDIDA = 'md:ml-64';
const LARGURA_RECOLHIDA = 'md:ml-20';

/**
 * Casca visual compartilhada por todas as paginas: Sidebar fixa (position:
 * fixed) a esquerda + area principal com seu proprio scroll independente.
 *
 * `isExpanded` (collapse pra icone-so) so tem efeito a partir do `md` -
 * abaixo disso a Sidebar e um drawer overlay full-screen, escondido por
 * padrao (ver Sidebar.jsx), controlado por `menuMobileAberto` (tambem mora
 * aqui, no pai comum, pelo mesmo motivo de "lift state up" que ja
 * justificava `isExpanded`: Sidebar/backdrop/botao-hamburguer sao 3
 * elementos irmaos que precisam ler o mesmo estado).
 *
 * Container raiz em `flex` + `overflow-x-hidden`: como a Sidebar usa
 * `position: fixed` (sai do fluxo normal, nao reserva espaco proprio), o
 * `<main>` precisa de uma margem esquerda explicita pra nao ficar por
 * baixo dela - mas so A PARTIR DO `md` (`md:ml-64`/`md:ml-20`, sincronizada
 * com `isExpanded`). Abaixo do `md` a Sidebar e um overlay (nao reserva
 * espaco nenhum, nem "por baixo" faz sentido - ela cobre o conteudo por
 * cima quando aberta), entao `<main>` fica sem margem e ocupa a tela
 * inteira. O `overflow-x-hidden` (no container E no `<main>`) contem
 * qualquer conteudo largo demais (uma tabela, um grid do PDV) DENTRO da
 * area de conteudo, em vez de vazar e empurrar a pagina inteira pra rolar
 * na horizontal.
 */
export default function Layout() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  return (
    <div className="flex h-screen overflow-x-hidden bg-slate-50 dark:bg-slate-900">
      <Sidebar
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((atual) => !atual)}
        abertaNoMobile={menuMobileAberto}
        onFecharNoMobile={() => setMenuMobileAberto(false)}
      />

      {/* Backdrop do drawer mobile - so existe na arvore quando o menu esta
          aberto, e mesmo assim some visualmente a partir do `md` (onde a
          Sidebar nunca vira overlay, entao nao ha nada pra escurecer atras
          dela). Clicar nele fecha o menu, junto com o X dentro da propria
          Sidebar e o clique em qualquer link do menu. */}
      {menuMobileAberto && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setMenuMobileAberto(false)}
          aria-hidden="true"
        />
      )}

      <main
        className={`flex h-screen w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-slate-50 transition-all duration-300 ease-in-out dark:bg-slate-900 ${
          isExpanded ? LARGURA_EXPANDIDA : LARGURA_RECOLHIDA
        }`}
      >
        {/* Barra superior - so no mobile (`md:hidden`). Abaixo do `md` a
            Sidebar comeca escondida (vira overlay) e a "berruga" de
            collapse dela tambem some nesse tamanho de tela, entao precisa
            de um jeito proprio de abrir o menu: o botao hamburguer aqui. */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <button
            type="button"
            onClick={() => setMenuMobileAberto(true)}
            aria-label="Abrir menu"
            className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu size={24} aria-hidden="true" />
          </button>
          <span className="text-xl font-extrabold text-blue-700 dark:text-blue-400">SAE</span>
        </header>

        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
