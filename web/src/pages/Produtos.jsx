import { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2, AlertTriangle, Check, X } from 'lucide-react';
import { apiFetch } from '../services/api';
import ModalProduto from '../components/produtos/ModalProduto';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function BadgeEstoque({ estoqueAtual, estoqueMinimo, sobDemanda }) {
  // Produto sob demanda sempre tem estoqueAtual=0 (forcado no cadastro) -
  // mostrar a badge de estoque nele ficaria parecendo "estoque critico"
  // por engano, quando na verdade estoque nem se aplica a esse produto.
  if (sobDemanda) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-sm font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
        Sob encomenda
      </span>
    );
  }

  const critico = estoqueAtual <= estoqueMinimo;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
          critico
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
        }`}
      >
        {critico && <AlertTriangle size={14} aria-hidden="true" />}
        {estoqueAtual} un.
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500">mín. {estoqueMinimo}</span>
    </div>
  );
}

/**
 * Tela de Produtos: tabela real consumindo GET/POST/PUT/DELETE /produtos
 * (CRUD completo do backend - ver tarefa anterior). O pedido original so
 * mencionava listar + criar via modal, mas como o backend ja suporta
 * editar e excluir de verdade (com isolamento de tenant e tratamento de
 * FK ja testados), adicionei essas duas acoes na tabela tambem - deixar
 * PUT/DELETE sem nenhuma tela que os use seria desperdicar metade do
 * trabalho ja pronto no backend pra este exato modulo.
 */
export default function Produtos() {
  const [produtos, setProdutos] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState(null);
  const [idConfirmandoExclusao, setIdConfirmandoExclusao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

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

  function abrirModalNovo() {
    setProdutoEditando(null);
    setModalAberto(true);
  }

  function abrirModalEdicao(produto) {
    setProdutoEditando(produto);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setProdutoEditando(null);
  }

  async function salvarProduto(payload) {
    if (produtoEditando) {
      const atualizado = await apiFetch(`/produtos/${produtoEditando.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setProdutos((atual) => atual.map((produto) => (produto.id === atualizado.id ? atualizado : produto)));
    } else {
      const criado = await apiFetch('/produtos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setProdutos((atual) => [...(atual || []), criado]);
    }
    fecharModal();
  }

  async function confirmarExclusao(produto) {
    setExcluindo(true);
    setErroExclusao('');
    try {
      await apiFetch(`/produtos/${produto.id}`, { method: 'DELETE' });
      setProdutos((atual) => atual.filter((item) => item.id !== produto.id));
      setIdConfirmandoExclusao(null);
    } catch (err) {
      setErroExclusao(err.message || 'Não foi possível excluir o produto.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
            <Package size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Meus Produtos
          </h1>
          <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
            Cadastre produtos e acompanhe o estoque da loja.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirModalNovo}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          <Plus size={22} aria-hidden="true" />
          Novo Produto
        </button>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {erroExclusao && (
        <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erroExclusao}
        </p>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Nome
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Custo
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Preço de Venda
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Estoque
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {carregando && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-lg text-slate-500 dark:text-slate-400">
                    Carregando produtos...
                  </td>
                </tr>
              )}

              {!carregando && produtos?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum produto cadastrado ainda.
                    </p>
                    <p className="mt-1 text-base text-slate-400 dark:text-slate-500">
                      Clique em "Novo Produto" para começar.
                    </p>
                  </td>
                </tr>
              )}

              {!carregando &&
                produtos?.map((produto) => (
                  <tr
                    key={produto.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30"
                  >
                    <td className="px-6 py-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {produto.nome}
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-300">
                      {formatarMoeda(produto.custo)}
                    </td>
                    <td className="px-6 py-4 text-base font-semibold text-slate-700 dark:text-slate-200">
                      {formatarMoeda(produto.precoVenda)}
                    </td>
                    <td className="px-6 py-4">
                      <BadgeEstoque
                        estoqueAtual={produto.estoqueAtual}
                        estoqueMinimo={produto.estoqueMinimo}
                        sobDemanda={produto.sobDemanda}
                      />
                    </td>
                    <td className="px-6 py-4">
                      {idConfirmandoExclusao === produto.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Excluir?</span>
                          <button
                            type="button"
                            onClick={() => confirmarExclusao(produto)}
                            disabled={excluindo}
                            aria-label="Confirmar exclusão"
                            className="rounded-lg bg-red-600 p-1.5 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                          >
                            <Check size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIdConfirmandoExclusao(null)}
                            disabled={excluindo}
                            aria-label="Cancelar exclusão"
                            className="rounded-lg bg-slate-200 p-1.5 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => abrirModalEdicao(produto)}
                            aria-label={`Editar ${produto.nome}`}
                            title="Editar"
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                          >
                            <Pencil size={18} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setErroExclusao('');
                              setIdConfirmandoExclusao(produto.id);
                            }}
                            aria-label={`Excluir ${produto.nome}`}
                            title="Excluir"
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <ModalProduto produto={produtoEditando} onFechar={fecharModal} onSalvar={salvarProduto} />
      )}
    </div>
  );
}
