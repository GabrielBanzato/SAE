import { useState } from 'react';
import { Boxes, Wheat } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EstoqueProdutos from '../components/estoque/EstoqueProdutos';
import EstoqueIngredientes from '../components/estoque/EstoqueIngredientes';

const ABAS = [
  {
    id: 'produtos',
    label: 'Produtos',
    icon: Boxes,
    descricao: 'Ajuste rápido de quantidades e alertas de reposição.',
  },
  {
    id: 'ingredientes',
    label: 'Ingredientes',
    icon: Wheat,
    descricao: 'Estoque de insumos e autonomia de produção.',
  },
];

/**
 * Tela de Estoque: aba "Produtos" (sempre visível, comportamento igual ao
 * de antes) + aba "Ingredientes" (so pra empresas do segmento
 * "varejo_alimentacao" - AuthContext), que controla matéria-prima e calcula
 * quantas unidades de cada produto ainda dá pra fazer com o estoque atual
 * de insumos. Pra qualquer outro segmento a barra de abas nem aparece
 * (uma unica aba não justifica o componente de abas) - so a tela de
 * sempre.
 */
export default function Estoque() {
  const { empresa } = useAuth();
  const segmentoAlimenticio = empresa?.segmento === 'varejo_alimentacao';

  const [abaAtiva, setAbaAtiva] = useState('produtos');
  const abaAtual = ABAS.find((aba) => aba.id === abaAtiva) ?? ABAS[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <Boxes size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Estoque
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">{abaAtual.descricao}</p>
      </div>

      {segmentoAlimenticio && (
        <div
          role="tablist"
          aria-label="Secoes de estoque"
          className="inline-flex gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        >
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={abaAtiva === id}
              onClick={() => setAbaAtiva(id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold transition-colors ${
                abaAtiva === id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div role="tabpanel">
        {abaAtiva === 'ingredientes' && segmentoAlimenticio ? <EstoqueIngredientes /> : <EstoqueProdutos />}
      </div>
    </div>
  );
}
