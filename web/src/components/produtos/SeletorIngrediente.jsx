import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Dropdown de ingredientes da Ficha Tecnica (ModalProduto.jsx) - correcao
 * de bug (2026-09-23): o `<select>` nativo que existia antes ficava
 * cortado/espremido dentro do modal. Causa: o card do modal tem
 * `max-h-[90vh] overflow-y-auto` (precisa rolar em tela pequena) - e
 * qualquer `overflow` diferente de `visible` num eixo forca o outro eixo a
 * cortar tambem (regra do CSS, nao da pra ter `overflow-y: auto` +
 * `overflow-x: visible`). Somado ao `flex-1` sem `min-w-0` (flex item nao
 * encolhe abaixo do texto da maior opcao), o campo vazava da largura do
 * card e era cortado.
 *
 * Solucao: a lista e renderizada via `createPortal` direto no
 * `document.body`, com `position: fixed` calculado a partir do
 * `getBoundingClientRect()` do botao - fica FORA da arvore de overflow do
 * modal, entao nenhum ancestral consegue corta-la. `z-[70]` fica acima do
 * overlay do ModalProduto (`z-30`) e do ModalDoador/outros (`z-[60]`).
 * Abre pra cima automaticamente quando nao ha espaco abaixo.
 */
export default function SeletorIngrediente({ opcoes, valor, onSelecionar, placeholder = 'Selecione um ingrediente...' }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const botaoRef = useRef(null);
  const listaRef = useRef(null);

  const selecionado = opcoes.find((item) => String(item.id) === String(valor));

  function calcularPosicao() {
    const rect = botaoRef.current?.getBoundingClientRect();
    if (!rect) return;
    const alturaMax = 256;
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const abrirParaCima = espacoAbaixo < alturaMax + 16 && rect.top > espacoAbaixo;
    // Pelo menos 280px (o botao fica estreito no layout em linha do
    // desktop, ~200px, e truncaria os nomes), sem vazar da tela.
    const largura = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    setPosicao({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - largura - 8)),
      width: largura,
      ...(abrirParaCima ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }

  useLayoutEffect(() => {
    if (aberto) calcularPosicao();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;

    function handleClickFora(event) {
      if (botaoRef.current?.contains(event.target) || listaRef.current?.contains(event.target)) return;
      setAberto(false);
    }
    function handleEsc(event) {
      // stopPropagation pra o Esc fechar so o dropdown, nao o ModalProduto inteiro.
      if (event.key === 'Escape') {
        event.stopPropagation();
        setAberto(false);
      }
    }
    // Rolar o modal (ou redimensionar a janela) move o botao - recalcula em
    // vez de fechar, pra lista acompanhar o campo. `true` = captura, pega o
    // scroll de qualquer ancestral (o card do modal), nao so da janela.
    window.addEventListener('scroll', calcularPosicao, true);
    window.addEventListener('resize', calcularPosicao);
    document.addEventListener('mousedown', handleClickFora);
    window.addEventListener('keydown', handleEsc, true);
    return () => {
      window.removeEventListener('scroll', calcularPosicao, true);
      window.removeEventListener('resize', calcularPosicao);
      document.removeEventListener('mousedown', handleClickFora);
      window.removeEventListener('keydown', handleEsc, true);
    };
  }, [aberto]);

  function selecionar(id) {
    onSelecionar(String(id));
    setAberto(false);
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 text-left text-base font-medium outline-none transition-all focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-blue-400"
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            selecionado ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {selecionado ? `${selecionado.nome} (${selecionado.unidadeMedida})` : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${aberto ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={listaRef}
            role="listbox"
            style={{ position: 'fixed', ...posicao }}
            className="z-[70] max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            {opcoes.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500">
                Todos os ingredientes já foram adicionados.
              </p>
            ) : (
              opcoes.map((item) => {
                const atual = String(item.id) === String(valor);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={atual}
                    onClick={() => selecionar(item.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-base font-medium transition-colors ${
                      atual
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="truncate">
                      {item.nome} <span className="text-slate-400 dark:text-slate-500">({item.unidadeMedida})</span>
                    </span>
                    {atual && <Check size={16} className="shrink-0" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </>
  );
}
