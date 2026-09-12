import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const LARGURA_EXPANDIDA = 'ml-64';
const LARGURA_RECOLHIDA = 'ml-20';

/**
 * Casca visual compartilhada por todas as paginas: Sidebar fixa (position:
 * fixed) a esquerda + area principal com seu proprio scroll independente.
 *
 * `isExpanded` mora aqui (no pai) em vez de dentro do proprio Sidebar
 * porque o <main> precisa saber a largura atual da Sidebar pra ajustar sua
 * margem esquerda - Sidebar e <main> sao irmãos, entao o estado que os dois
 * precisam ler sobe pro componente comum mais proximo (padrao "lift state
 * up" do React).
 *
 * Container raiz em `flex` + `overflow-x-hidden`: como a Sidebar usa
 * `position: fixed` (sai do fluxo normal, nao reserva espaco proprio), o
 * `<main>` continua precisando da margem esquerda explicita (`ml-64`/
 * `ml-20`, sincronizada com `isExpanded`) pra nao ficar por baixo dela -
 * o flex aqui garante que o container ocupe a tela inteira de forma
 * previsivel, e o `overflow-x-hidden` (no container E no `<main>`) contem
 * qualquer conteudo largo demais (uma tabela, um grid do PDV) DENTRO da
 * area de conteudo, em vez de vazar e empurrar a pagina inteira pra rolar
 * na horizontal - que e exatamente o que fazia o conteudo parecer "vazar"
 * por baixo da Sidebar fixa ao rolar pros lados.
 */
export default function Layout() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="flex h-screen overflow-x-hidden bg-slate-50 dark:bg-slate-900">
      <Sidebar isExpanded={isExpanded} onToggle={() => setIsExpanded((atual) => !atual)} />

      <main
        className={`h-screen min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 px-6 py-8 transition-all duration-300 ease-in-out dark:bg-slate-900 sm:px-10 ${
          isExpanded ? LARGURA_EXPANDIDA : LARGURA_RECOLHIDA
        }`}
      >
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
