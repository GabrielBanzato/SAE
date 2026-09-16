import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DIAS_SEMANA, gerarGradeDoMes } from '../utils/datas';

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "YYYY-MM-DD" -> "DD/MM/AAAA" sem passar por `Date` - mesmo cuidado de utils/datas.js: evita qualquer pegadinha de fuso horario num valor que e so uma data de calendario, sem hora. */
function formatarBr(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function paraIso(ano, mesIndice, dia) {
  return `${ano}-${String(mesIndice + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Date picker custom (calendario em popover), pra substituir o
 * `<input type="date">` nativo - o popup nativo do navegador renderiza um
 * calendario datado e fora do controle de estilo do app (nem
 * `color-scheme: dark` resolve o layout, so a paleta de cores). Reaproveita
 * a mesma logica de grade de calendario de pages/Agenda.jsx (extraida pra
 * utils/datas.js nesta tarefa).
 *
 * Valor continua sendo uma string "YYYY-MM-DD" (mesmo formato de um
 * `<input type="date">` nativo) - troca so o campo de captura, todo o
 * estado ao redor (ModalLancamento, ModalLembrete, filtros de
 * Lancamentos/Relatorios) continua lendo/gravando exatamente como antes.
 *
 * `variant`:
 * - `'grande'` (padrao) - estilo de CampoTexto.jsx: label proprio, icone,
 *   fonte grande. Usado nos modais (Vencimento, Data do lembrete).
 * - `'compacta'` - sem label proprio (o chamador desenha o `<span>` de
 *   label ao redor, como ja faziam CampoFiltro/label existentes) e fonte
 *   menor. Usado nos filtros de periodo de Lancamentos/Relatorios.
 *
 * Sem `required` nativo (nao e mais um `<input>` de verdade) - os 2 modais
 * que usavam esse valor ja fazem a propria validacao em JS antes de
 * enviar (`if (!campos.dataVencimento) ...`), entao nada se perde. Aqui
 * `required` so controla se o botao "Limpar" aparece (campos obrigatorios
 * nao devem oferecer um jeito de ficarem vazios de novo).
 */
export default function CampoData({ label, value, onChange, min, max, placeholder = 'dd/mm/aaaa', variant = 'grande', required }) {
  const [aberto, setAberto] = useState(false);
  const [mesExibido, setMesExibido] = useState(() => {
    const base = value || min || '';
    if (base) {
      const [ano, mes] = base.split('-');
      return new Date(Number(ano), Number(mes) - 1, 1);
    }
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickFora(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setAberto(false);
      }
    }
    function handleEsc(event) {
      if (event.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', handleClickFora);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const ano = mesExibido.getFullYear();
  const mesIndice = mesExibido.getMonth();
  const grade = gerarGradeDoMes(ano, mesIndice);
  const hoje = new Date();

  function foraDoLimite(iso) {
    return (min && iso < min) || (max && iso > max);
  }

  function selecionarDia(dia) {
    onChange(paraIso(ano, mesIndice, dia));
    setAberto(false);
  }

  function irParaHoje() {
    const h = new Date();
    setMesExibido(new Date(h.getFullYear(), h.getMonth(), 1));
    const iso = paraIso(h.getFullYear(), h.getMonth(), h.getDate());
    if (!foraDoLimite(iso)) {
      onChange(iso);
      setAberto(false);
    }
  }

  const grande = variant === 'grande';

  return (
    <div className="relative" ref={containerRef}>
      {grande && label && <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">{label}</span>}

      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className={
          grande
            ? `mt-2 flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition-all focus:outline-none focus-visible:border-blue-500 dark:bg-slate-800 dark:focus-visible:border-blue-400 ${
                aberto ? 'border-blue-500 dark:border-blue-400' : 'border-slate-300 dark:border-slate-700'
              }`
            : `mt-1 flex w-full items-center gap-2 rounded-xl border-2 bg-white px-3 py-2 text-left transition-all focus:outline-none dark:bg-slate-900 ${
                aberto ? 'border-blue-500 dark:border-blue-400' : 'border-slate-300 dark:border-slate-700'
              }`
        }
      >
        {grande && <Calendar size={22} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />}
        <span
          className={`flex-1 truncate ${grande ? 'text-lg font-medium' : 'text-base font-medium'} ${
            value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {value ? formatarBr(value) : placeholder}
        </span>
        {!grande && <Calendar size={16} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Selecionar data"
          className="absolute z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMesExibido(new Date(ano, mesIndice - 1, 1))}
              aria-label="Mês anterior"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              {capitalizar(mesExibido.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}
            </span>
            <button
              type="button"
              onClick={() => setMesExibido(new Date(ano, mesIndice + 1, 1))}
              aria-label="Próximo mês"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
            {DIAS_SEMANA.map((dia) => (
              <div key={dia}>{dia}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grade.map((dia, indice) => {
              if (dia === null) return <div key={indice} />;

              const iso = paraIso(ano, mesIndice, dia);
              const selecionado = iso === value;
              const ehHoje = dia === hoje.getDate() && mesIndice === hoje.getMonth() && ano === hoje.getFullYear();
              const desabilitado = foraDoLimite(iso);

              return (
                <button
                  key={indice}
                  type="button"
                  disabled={desabilitado}
                  onClick={() => selecionarDia(dia)}
                  className={`aspect-square rounded-lg text-sm font-semibold transition-colors ${
                    selecionado
                      ? 'bg-blue-600 text-white'
                      : desabilitado
                        ? 'cursor-not-allowed text-slate-300 dark:text-slate-700'
                        : ehHoje
                          ? 'text-blue-600 ring-2 ring-inset ring-blue-500 dark:text-blue-400'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
            <button
              type="button"
              onClick={irParaHoje}
              className="text-sm font-semibold text-blue-600 transition-colors hover:underline dark:text-blue-400"
            >
              Hoje
            </button>
            {value && !required && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setAberto(false);
                }}
                className="text-sm font-semibold text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
