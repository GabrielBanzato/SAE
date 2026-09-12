import { BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RelatoriosSimples from '../components/relatorios/RelatoriosSimples';
import RelatoriosAvancados from '../components/relatorios/RelatoriosAvancados';

/**
 * Decide qual variante de relatorio mostrar a partir de `empresa.plano`
 * (AuthContext - ver context/AuthContext.jsx). `empresa` comeca `null` e e
 * buscado em segundo plano (GET /empresa/dados) assim que o usuario loga
 * ou a pagina e recarregada, entao ha um instante de "Carregando..." antes
 * do plano ficar disponivel.
 */
export default function Relatorios() {
  const { empresa } = useAuth();

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

      {!empresa && <p className="text-lg text-slate-500 dark:text-slate-400">Carregando...</p>}

      {empresa && (empresa.plano === 'apoiador' ? <RelatoriosAvancados /> : <RelatoriosSimples />)}
    </div>
  );
}
