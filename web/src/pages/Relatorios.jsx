import { useState } from 'react';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CampoData from '../components/CampoData';
import RelatoriosSimples from '../components/relatorios/RelatoriosSimples';
import RelatoriosAvancados from '../components/relatorios/RelatoriosAvancados';

/**
 * Decide qual variante de relatorio mostrar a partir de `empresa.plano`
 * (AuthContext - ver context/AuthContext.jsx). `empresa` comeca `null` e e
 * buscado em segundo plano (GET /empresa/dados) assim que o usuario loga
 * ou a pagina e recarregada, entao ha um instante de "Carregando..." antes
 * do plano ficar disponivel.
 *
 * Filtro de periodo + "Exportar Dados": nao existe (ainda) uma rota de
 * backend que gere um arquivo de exportacao, nem os componentes de
 * relatorio abaixo (RelatoriosSimples/RelatoriosAvancados) usam
 * `dataInicial`/`dataFinal` pra filtrar o que mostram - por pedido
 * explicito, isso fica soh preparado no frontend por enquanto (estado dos
 * inputs guardado aqui, pronto pra ser passado pra um fetch de verdade
 * quando essa rota existir). O clique em "Exportar Dados" so simula
 * "Gerando arquivo..." por 2s antes de voltar ao normal - nenhum arquivo e
 * gerado de verdade.
 */
export default function Relatorios() {
  const { empresa } = useAuth();
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [exportando, setExportando] = useState(false);

  function handleExportar() {
    setExportando(true);
    // TODO: quando existir uma rota de exportacao de verdade no backend,
    // chamar ela aqui (passando dataInicial/dataFinal) e disparar o
    // download da resposta, no lugar deste setTimeout.
    setTimeout(() => setExportando(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <BarChart3 size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Relatórios
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Acompanhe o desempenho do seu negócio.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row">
          <label className="block">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Data Inicial</span>
            <CampoData variant="compacta" value={dataInicial} onChange={setDataInicial} max={dataFinal || undefined} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Data Final</span>
            <CampoData variant="compacta" value={dataFinal} onChange={setDataFinal} min={dataInicial || undefined} />
          </label>
        </div>

        <button
          type="button"
          onClick={handleExportar}
          disabled={exportando}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {exportando ? (
            <Loader2 size={20} className="shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Download size={20} className="shrink-0" aria-hidden="true" />
          )}
          {exportando ? 'Gerando arquivo...' : 'Exportar Dados'}
        </button>
      </div>

      {!empresa && <p className="text-lg text-slate-500 dark:text-slate-400">Carregando...</p>}

      {empresa && (empresa.plano === 'apoiador' ? <RelatoriosAvancados /> : <RelatoriosSimples />)}
    </div>
  );
}
