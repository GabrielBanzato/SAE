import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api';

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'baixo', rotulo: 'Estoque Baixo' },
];

/** Sob demanda nunca conta como "baixo" - esse tipo de produto nao tem controle de estoque de verdade (fica preso em 0). */
function estaComEstoqueBaixo(produto) {
  return !produto.sobDemanda && produto.estoqueAtual <= produto.estoqueMinimo;
}

/**
 * Estoque Atual editavel: input numerico com botoes [-]/[+] ao lado.
 * Clicar em [-]/[+] dispara o PATCH imediatamente (via `onAlterar`, que o
 * pai usa pra chamar a API); digitar direto no campo so dispara ao sair do
 * campo/apertar Enter (senao seria uma requisicao por tecla digitada).
 * `atualizando` desabilita tudo enquanto o PATCH desta linha esta em voo -
 * evita 2 cliques disparando 2 requisicoes concorrentes pro mesmo produto.
 */
function AjusteEstoque({ produto, atualizando, onAlterar }) {
  const [valorDigitado, setValorDigitado] = useState(String(produto.estoqueAtual));

  useEffect(() => {
    setValorDigitado(String(produto.estoqueAtual));
  }, [produto.estoqueAtual]);

  function confirmarValorDigitado() {
    const numero = Math.trunc(Number(valorDigitado));
    if (!Number.isFinite(numero) || numero < 0) {
      setValorDigitado(String(produto.estoqueAtual));
      return;
    }
    if (numero === produto.estoqueAtual) return;
    onAlterar(numero);
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onAlterar(Math.max(0, produto.estoqueAtual - 1))}
        disabled={atualizando || produto.estoqueAtual <= 0}
        aria-label={`Diminuir estoque de ${produto.nome}`}
        className="rounded-lg bg-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
      >
        <Minus size={16} aria-hidden="true" />
      </button>

      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={valorDigitado}
        onChange={(event) => setValorDigitado(event.target.value)}
        onBlur={confirmarValorDigitado}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        disabled={atualizando}
        aria-label={`Estoque atual de ${produto.nome}`}
        className="w-16 rounded-lg border-2 border-slate-300 bg-white py-1.5 text-center text-lg font-bold text-slate-900 outline-none transition-all focus:border-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
      />

      <button
        type="button"
        onClick={() => onAlterar(produto.estoqueAtual + 1)}
        disabled={atualizando}
        aria-label={`Aumentar estoque de ${produto.nome}`}
        className="rounded-lg bg-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Ferramenta agil de reposicao de PRODUTOS (unidades prontas pra vender) -
 * consome GET /produtos e PATCH /produtos/:id/estoque. Extraido de
 * `pages/Estoque.jsx` pra virar a aba "Produtos" da tela de Estoque quando
 * a empresa tem mais de uma aba (segmento "varejo_alimentacao" - ver `EstoqueIngredientes.jsx`
 * pra estoque de materia-prima, uma coisa completamente separada).
 */
export default function EstoqueProdutos() {
  const [produtos, setProdutos] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');

  const [idAtualizando, setIdAtualizando] = useState(null);
  const [erroAtualizacao, setErroAtualizacao] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch('/produtos')
      .then((dados) => {
        if (ativo) setProdutos(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar os produtos.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    const termo = busca.trim().toLowerCase();

    return produtos.filter((produto) => {
      if (termo && !produto.nome.toLowerCase().includes(termo)) return false;
      if (filtroAtivo === 'baixo' && !estaComEstoqueBaixo(produto)) return false;
      return true;
    });
  }, [produtos, busca, filtroAtivo]);

  async function alterarEstoque(produto, novoValor) {
    setErroAtualizacao('');
    setIdAtualizando(produto.id);

    try {
      const atualizado = await apiFetch(`/produtos/${produto.id}/estoque`, {
        method: 'PATCH',
        body: JSON.stringify({ estoque_atual: novoValor }),
      });
      setProdutos((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
    } catch (err) {
      setErroAtualizacao(err.message || 'Não foi possível atualizar o estoque.');
    } finally {
      setIdAtualizando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-400 sm:max-w-sm">
          <Search size={20} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((filtro) => {
            const ativo = filtroAtivo === filtro.valor;
            return (
              <button
                key={filtro.valor}
                type="button"
                onClick={() => setFiltroAtivo(filtro.valor)}
                className={`rounded-full px-5 py-2.5 text-base font-bold transition-colors ${
                  ativo
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700'
                }`}
              >
                {filtro.rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {erroAtualizacao && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erroAtualizacao}
        </p>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Produto
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Estoque Mínimo
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
                    Carregando produtos...
                  </td>
                </tr>
              )}

              {!carregando && produtosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum produto encontrado.
                    </p>
                    <p className="mt-1 text-base text-slate-400 dark:text-slate-500">
                      {filtroAtivo === 'baixo' ? 'Nenhum produto com estoque baixo agora.' : 'Ajuste a busca ou o filtro.'}
                    </p>
                  </td>
                </tr>
              )}

              {!carregando &&
                produtosFiltrados.map((produto) => {
                  const baixo = estaComEstoqueBaixo(produto);
                  return (
                    <tr
                      key={produto.id}
                      className={`transition-colors ${
                        baixo
                          ? 'bg-red-50/70 dark:bg-red-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/30'
                      }`}
                    >
                      <td
                        className={`border-l-4 px-6 py-4 text-lg font-semibold ${
                          baixo
                            ? 'border-red-400 text-slate-900 dark:border-red-500 dark:text-slate-100'
                            : 'border-transparent text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {produto.nome}
                          {baixo && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              title="Estoque no mínimo ou abaixo dele"
                            >
                              <AlertTriangle size={12} aria-hidden="true" />
                              Baixo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-300">
                        {produto.estoqueMinimo} un.
                      </td>
                      <td className="px-6 py-4">
                        {produto.sobDemanda ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1.5 text-sm font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            Sob Demanda
                          </span>
                        ) : (
                          <AjusteEstoque
                            produto={produto}
                            atualizando={idAtualizando === produto.id}
                            onAlterar={(novoValor) => alterarEstoque(produto, novoValor)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
