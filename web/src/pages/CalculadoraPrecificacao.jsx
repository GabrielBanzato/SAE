import { Calculator } from 'lucide-react';
import CalculadoraLucros from '../components/produtos/CalculadoraLucros';

/**
 * Pagina de Precificacao: so o cabecalho + a calculadora completa (nucleo
 * extraido pra `components/produtos/CalculadoraLucros.jsx`, reaproveitado
 * tambem no modal "Calculadora de Lucros" do cadastro de Produtos).
 */
export default function CalculadoraPrecificacao() {
  return (
    <div>
      <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
        <Calculator size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        Calculadora de Precificação
      </h1>
      <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
        Edite o custo e o lucro para calcular o preço — ou digite direto no preço final para descobrir seu lucro.
      </p>

      <div className="mt-6">
        <CalculadoraLucros />
      </div>
    </div>
  );
}
