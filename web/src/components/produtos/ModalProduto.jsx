import { useEffect, useState } from 'react';
import { X, Package, Boxes, Calculator, ChefHat, Plus, Trash2 } from 'lucide-react';
import CampoTexto from '../CampoTexto';
import Switch from '../Switch';
import ModalCalculadoraLucros from './ModalCalculadoraLucros';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function SimboloReal({ className }) {
  return <span className={`text-base font-bold ${className}`}>R$</span>;
}

function valoresIniciais(produto) {
  return {
    nome: produto?.nome ?? '',
    custo: produto?.custo ?? '',
    precoVenda: produto?.precoVenda ?? '',
    estoqueAtual: produto?.estoqueAtual ?? '',
    estoqueMinimo: produto?.estoqueMinimo ?? '',
    sobDemanda: produto?.sobDemanda ?? false,
    // Pre-preenchido a partir de `produto.fichaTecnica` (ja vem incluida em
    // toda resposta de Produto, ver produtos.service.js) quando editando -
    // vazio pra um produto novo.
    ingredientes: (produto?.fichaTecnica ?? []).map((item) => ({
      ingredienteId: item.ingredienteId,
      quantidadeUsada: item.quantidadeUsada,
    })),
  };
}

/**
 * Modal de cadastro/edicao de produto - centralizado sobre um overlay
 * (em vez de slide-over lateral, a outra opcao aceita no pedido) por ser
 * mais simples de acertar bem visualmente pra um formulario curto como
 * este. Mesmo componente atende "Novo Produto" (`produto` null) e
 * "Editar Produto" (`produto` preenchido) - evita duplicar o formulario.
 *
 * Ganhou 2 pecas novas nesta tarefa: o botao "Calculadora de Lucros"
 * (abre `ModalCalculadoraLucros` empilhado por cima, devolve o preco
 * calculado pro formulario) e a secao "Ficha Tecnica / Ingredientes",
 * visivel so quando `empresa.nicho === 'alimentos'` (AuthContext).
 */
export default function ModalProduto({ produto, onFechar, onSalvar }) {
  const { empresa } = useAuth();
  const nichoAlimentos = empresa?.nicho === 'alimentos';

  const [campos, setCampos] = useState(() => valoresIniciais(produto));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [modalCalculadoraAberto, setModalCalculadoraAberto] = useState(false);

  const [ingredientesDisponiveis, setIngredientesDisponiveis] = useState([]);
  const [carregandoIngredientes, setCarregandoIngredientes] = useState(false);
  const [ingredienteSelecionado, setIngredienteSelecionado] = useState('');
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState('');

  const editando = Boolean(produto);

  useEffect(() => {
    setCampos(valoresIniciais(produto));
    setErro('');
  }, [produto]);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !modalCalculadoraAberto) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, modalCalculadoraAberto]);

  // So busca a lista de ingredientes cadastrados se a empresa for do nicho
  // "alimentos" - pra qualquer outro nicho a secao inteira nem aparece,
  // entao a chamada seria desperdicada.
  useEffect(() => {
    if (!nichoAlimentos) return undefined;

    let ativo = true;
    setCarregandoIngredientes(true);

    apiFetch('/ingredientes')
      .then((dados) => {
        if (ativo) setIngredientesDisponiveis(dados);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregandoIngredientes(false);
      });

    return () => {
      ativo = false;
    };
  }, [nichoAlimentos]);

  function atualizarCampo(campo, valor) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
  }

  function aplicarPrecoCalculado({ custo, precoVenda }) {
    setCampos((atual) => ({
      ...atual,
      custo: custo ? String(custo) : atual.custo,
      precoVenda: String(precoVenda),
    }));
  }

  const idsJaAdicionados = new Set(campos.ingredientes.map((item) => item.ingredienteId));
  const ingredientesParaAdicionar = ingredientesDisponiveis.filter((item) => !idsJaAdicionados.has(item.id));

  function adicionarIngrediente() {
    const ingredienteId = Number(ingredienteSelecionado);
    const quantidade = Number(quantidadeSelecionada);
    if (!ingredienteId || !Number.isFinite(quantidade) || quantidade <= 0) return;

    setCampos((atual) => ({
      ...atual,
      ingredientes: [...atual.ingredientes, { ingredienteId, quantidadeUsada: quantidade }],
    }));
    setIngredienteSelecionado('');
    setQuantidadeSelecionada('');
  }

  function removerIngrediente(ingredienteId) {
    setCampos((atual) => ({
      ...atual,
      ingredientes: atual.ingredientes.filter((item) => item.ingredienteId !== ingredienteId),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    if (!campos.nome.trim()) {
      setErro('Informe o nome do produto.');
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        nome: campos.nome.trim(),
        custo: Number(campos.custo) || 0,
        preco_venda: Number(campos.precoVenda) || 0,
        // Produto sob demanda nao tem controle de estoque - forca 0 pros
        // dois campos independente do que estiver (ou sobrou) no formulario.
        // A coluna e Int NOT NULL no schema (nao aceita null), entao 0 e o
        // unico valor valido aqui - "0 ou null" do pedido, na pratica so 0.
        estoque_atual: campos.sobDemanda ? 0 : Number(campos.estoqueAtual) || 0,
        estoque_minimo: campos.sobDemanda ? 0 : Number(campos.estoqueMinimo) || 0,
        sob_demanda: campos.sobDemanda,
        // So manda `ingredientes` pra empresas do nicho "alimentos" - a API
        // rejeita (403) esse campo pra qualquer outro nicho (ver
        // produtos.service.js), entao nem inclui a chave nos demais casos.
        ...(nichoAlimentos
          ? {
              ingredientes: campos.ingredientes.map((item) => ({
                ingrediente_id: item.ingredienteId,
                quantidade_usada: Number(item.quantidadeUsada),
              })),
            }
          : {}),
      });
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o produto.');
      setSalvando(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
        onClick={onFechar}
        role="presentation"
      >
        <div
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-produto"
        >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-produto" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {editando ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <CampoTexto
            label="Nome do produto"
            icon={Package}
            type="text"
            placeholder="Ex: Pão Francês"
            value={campos.nome}
            onChange={(event) => atualizarCampo('nome', event.target.value)}
            autoFocus
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <CampoTexto
              label="Custo (R$)"
              icon={SimboloReal}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={campos.custo}
              onChange={(event) => atualizarCampo('custo', event.target.value)}
            />
            <CampoTexto
              label="Preço de Venda (R$)"
              icon={SimboloReal}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={campos.precoVenda}
              onChange={(event) => atualizarCampo('precoVenda', event.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => setModalCalculadoraAberto(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-base font-bold text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
          >
            <Calculator size={20} aria-hidden="true" />
            🧮 Calculadora de Lucros
          </button>

          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
            <Switch
              label="Produto feito sob demanda?"
              descricao="Feito na hora, sem controle de estoque"
              checked={campos.sobDemanda}
              onChange={(valor) => atualizarCampo('sobDemanda', valor)}
            />
          </div>

          {!campos.sobDemanda && (
            <div className="grid grid-cols-2 gap-4">
              <CampoTexto
                label="Estoque Atual"
                icon={Boxes}
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={campos.estoqueAtual}
                onChange={(event) => atualizarCampo('estoqueAtual', event.target.value)}
              />
              <CampoTexto
                label="Estoque Mínimo"
                icon={Boxes}
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={campos.estoqueMinimo}
                onChange={(event) => atualizarCampo('estoqueMinimo', event.target.value)}
              />
            </div>
          )}

          {nichoAlimentos && (
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <ChefHat size={20} aria-hidden="true" />
                <span className="text-lg font-semibold">Ficha Técnica / Ingredientes</span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Selecione os insumos que compõem este produto.
              </p>

              {carregandoIngredientes && (
                <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">Carregando ingredientes...</p>
              )}

              {!carregandoIngredientes && ingredientesDisponiveis.length === 0 && (
                <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                  Nenhum ingrediente cadastrado ainda.
                </p>
              )}

              {!carregandoIngredientes && ingredientesDisponiveis.length > 0 && (
                <>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={ingredienteSelecionado}
                      onChange={(event) => setIngredienteSelecionado(event.target.value)}
                      className="flex-1 rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 text-base font-medium text-slate-900 outline-none transition-all focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
                    >
                      <option value="">Selecione um ingrediente...</option>
                      {ingredientesParaAdicionar.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome} ({item.unidadeMedida})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="Qtd."
                      value={quantidadeSelecionada}
                      onChange={(event) => setQuantidadeSelecionada(event.target.value)}
                      className="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 text-base font-medium text-slate-900 outline-none transition-all focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 sm:w-24"
                    />
                    <button
                      type="button"
                      onClick={adicionarIngrediente}
                      disabled={!ingredienteSelecionado || !quantidadeSelecionada}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-base font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={18} aria-hidden="true" />
                      Adicionar
                    </button>
                  </div>

                  {campos.ingredientes.length > 0 && (
                    <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
                      {campos.ingredientes.map((item) => {
                        const ingrediente = ingredientesDisponiveis.find((i) => i.id === item.ingredienteId);
                        return (
                          <li key={item.ingredienteId} className="flex items-center justify-between gap-2 py-2">
                            <span className="text-base text-slate-700 dark:text-slate-200">
                              {ingrediente?.nome ?? `Ingrediente #${item.ingredienteId}`}
                              <span className="text-slate-400 dark:text-slate-500">
                                {' '}
                                — {item.quantidadeUsada} {ingrediente?.unidadeMedida}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removerIngrediente(item.ingredienteId)}
                              aria-label={`Remover ${ingrediente?.nome ?? 'ingrediente'}`}
                              className="shrink-0 rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {erro && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-2xl px-5 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Adicionar Produto'}
            </button>
          </div>
        </form>
        </div>
      </div>

      {modalCalculadoraAberto && (
        <ModalCalculadoraLucros
          custoInicial={campos.custo}
          onFechar={() => setModalCalculadoraAberto(false)}
          onAplicarPreco={aplicarPrecoCalculado}
        />
      )}
    </>
  );
}
