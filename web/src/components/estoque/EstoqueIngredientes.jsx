import { useEffect, useMemo, useState } from 'react';
import { Search, Factory } from 'lucide-react';
import { apiFetch } from '../../services/api';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarQuantidade(valor) {
  return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/**
 * Quantas unidades do produto ainda dá pra fazer com o estoque atual de
 * ingredientes: pra cada item da ficha técnica, `estoqueAtual / quantidadeUsada`
 * diz quantas unidades ESSE ingrediente sozinho sustentaria - o "gargalo"
 * real da produção é o MENOR desses valores (o ingrediente que acaba
 * primeiro), arredondado pra baixo (não dá pra fazer 0,7 pão). Produto sem
 * ficha técnica cadastrada não entra nessa conta (não há como calcular).
 */
function calcularAutonomia(produto) {
  if (!produto.fichaTecnica || produto.fichaTecnica.length === 0) return null;

  let unidades = Infinity;
  let ingredienteLimitante = null;

  for (const item of produto.fichaTecnica) {
    const disponivel = Number(item.ingrediente.estoqueAtual);
    const necessario = Number(item.quantidadeUsada);
    const podeProduzir = necessario > 0 ? Math.floor(disponivel / necessario) : Infinity;

    if (podeProduzir < unidades) {
      unidades = podeProduzir;
      ingredienteLimitante = item.ingrediente;
    }
  }

  return { unidades, ingredienteLimitante };
}

/**
 * Aba "Ingredientes" da tela de Estoque (so aparece pra empresas do
 * segmento "varejo_alimentacao" - ver pages/Estoque.jsx). Lista os insumos cadastrados
 * (GET /ingredientes) e cruza com a Ficha Técnica de cada Produto
 * (GET /produtos, que já vem com `fichaTecnica` incluída desde a tarefa
 * anterior) pra calcular a "Autonomia de Produção" - quantas unidades de
 * cada produto o lojista ainda consegue fazer antes de faltar algum
 * ingrediente, evitando a surpresa de descobrir isso no meio de uma
 * encomenda.
 */
export default function EstoqueIngredientes() {
  const [ingredientes, setIngredientes] = useState(null);
  const [produtos, setProdutos] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    Promise.all([apiFetch('/ingredientes'), apiFetch('/produtos')])
      .then(([ingredientesDados, produtosDados]) => {
        if (ativo) {
          setIngredientes(ingredientesDados);
          setProdutos(produtosDados);
        }
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar os ingredientes.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const ingredientesFiltrados = useMemo(() => {
    if (!ingredientes) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return ingredientes;
    return ingredientes.filter((item) => item.nome.toLowerCase().includes(termo));
  }, [ingredientes, busca]);

  const autonomiaPorProduto = useMemo(() => {
    if (!produtos) return [];
    return produtos
      .map((produto) => ({ produto, autonomia: calcularAutonomia(produto) }))
      .filter((item) => item.autonomia !== null)
      .sort((a, b) => a.autonomia.unidades - b.autonomia.unidades);
  }, [produtos]);

  return (
    <div className="space-y-6">
      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {/* Autonomia de Producao - a "visualizacao inteligente" pedida */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
          <Factory size={22} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h2 className="text-xl font-bold">Autonomia de Produção</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Quantas unidades de cada produto você ainda consegue fazer com o estoque atual de ingredientes.
        </p>

        {carregando && (
          <p className="py-6 text-center text-base text-slate-500 dark:text-slate-400">Calculando...</p>
        )}

        {!carregando && autonomiaPorProduto.length === 0 && (
          <p className="py-6 text-center text-base text-slate-500 dark:text-slate-400">
            Nenhum produto com Ficha Técnica cadastrada ainda. Vincule ingredientes a um produto para ver a
            autonomia de produção aqui.
          </p>
        )}

        {!carregando && autonomiaPorProduto.length > 0 && (
          <ul className="mt-4 space-y-3">
            {autonomiaPorProduto.map(({ produto, autonomia }) => {
              const esgotado = autonomia.unidades <= 0;
              const baixo = !esgotado && autonomia.unidades <= 5;

              return (
                <li
                  key={produto.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl p-4 ${
                    esgotado
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : baixo
                        ? 'bg-amber-50 dark:bg-amber-900/20'
                        : 'bg-slate-50 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {produto.nome}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Limitado por: {autonomia.ingredienteLimitante.nome}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-2xl font-extrabold ${
                        esgotado
                          ? 'text-red-600 dark:text-red-400'
                          : baixo
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-green-400'
                      }`}
                    >
                      {Math.max(0, autonomia.unidades)}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {esgotado ? 'esgotado' : 'unidades'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Lista de insumos */}
      <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-400 sm:max-w-sm">
        <Search size={20} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <input
          type="text"
          placeholder="Buscar ingrediente..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
        />
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ingrediente
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Custo Unitário
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Estoque Atual
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {carregando && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-lg text-slate-500 dark:text-slate-400">
                    Carregando ingredientes...
                  </td>
                </tr>
              )}

              {!carregando && ingredientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum ingrediente encontrado.
                    </p>
                  </td>
                </tr>
              )}

              {!carregando &&
                ingredientesFiltrados.map((ingrediente) => (
                  <tr
                    key={ingrediente.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30"
                  >
                    <td className="px-6 py-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {ingrediente.nome}
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-300">
                      {formatarMoeda(ingrediente.custoUnitario)} / {ingrediente.unidadeMedida}
                    </td>
                    <td className="px-6 py-4 text-base font-semibold text-slate-700 dark:text-slate-200">
                      {formatarQuantidade(ingrediente.estoqueAtual)} {ingrediente.unidadeMedida}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
