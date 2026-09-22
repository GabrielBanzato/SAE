import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  ScanBarcode,
  CircleDollarSign,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';
import ModalCheckoutPDV from '../components/vendas/ModalCheckoutPDV';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataDeHojeIso() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

// `Produto` nao tem campo `categoria` no schema (conferido antes de
// implementar - so nome/custo/precoVenda/estoqueAtual/estoqueMinimo/
// sobDemanda) - "filtros rapidos por categoria" pedido no design nao tem
// dado real pra se basear. Em vez de inventar categorias falsas (que
// ninguem cadastra em lugar nenhum da UI), os filtros rapidos aqui usam
// atributos REAIS que ja existem no produto - substituto honesto ate um
// campo `categoria` de verdade ser adicionado ao backend (fora do escopo
// desta tarefa, que pediu so frontend).
const FILTROS_RAPIDOS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'sob_demanda', rotulo: 'Sob Encomenda' },
  { valor: 'estoque_baixo', rotulo: 'Estoque Baixo' },
];

// Paleta cíclica pro placeholder de cor/ícone dos cards (produto sem foto -
// `Produto` tambem nao tem campo de imagem no schema). Indice = `produto.id
// % CORES_PLACEHOLDER.length`, determinístico (o mesmo produto sempre cai
// na mesma cor, nao muda a cada render).
const CORES_PLACEHOLDER = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-fuchsia-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
];

/**
 * Intervalo maximo (ms) entre 2 teclas pra ainda serem consideradas parte
 * da MESMA leitura de um leitor de codigo de barras fisico (que "digita"
 * um numero inteiro em poucos milissegundos, bem mais rapido que datilografia
 * humana). Acima disso, o buffer reseta - e so alguem digitando normal.
 */
const INTERVALO_MAX_LEITOR_MS = 60;
const TAMANHO_MINIMO_CODIGO = 2;

/**
 * PDV (Frente de Loja) - tela cheia, sem a Sidebar padrao (ver App.jsx: essa
 * rota fica FORA do `<Route element={<Layout />}>`), pensada pra tablet/
 * monitor touch num balcao: grid grande de produtos a esquerda + carrinho
 * fixo a direita, sem nenhum dos campos "administrativos" da tela completa
 * `/vendas` (vincular cliente, funcionario do consumo interno, escolher
 * data retroativa) - e um caixa rapido, nao um formulario.
 *
 * Reaproveita o mesmo backend de sempre (`POST /vendas`,
 * vendas.service.js#registrarVenda) - so a UI e nova; a baixa de estoque de
 * produto E de ingredientes da Ficha Tecnica (ja implementada) acontece
 * exatamente igual, e os avisos de estoque critico que a API devolve viram
 * toast aqui tambem (mesmo padrao ja usado em Vendas.jsx).
 */
export default function PDV() {
  const navigate = useNavigate();
  const { mostrarToast } = useToast();

  const [produtos, setProdutos] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [filtroRapido, setFiltroRapido] = useState('todos');
  const [carrinho, setCarrinho] = useState([]);

  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);

  // Ref (nao state) porque o listener global de teclado do leitor de
  // codigo de barras (useEffect logo abaixo, registrado 1 vez so) precisa
  // sempre ler a lista MAIS RECENTE de produtos sem precisar re-registrar
  // o listener a cada atualizacao de estoque local.
  const produtosRef = useRef(null);

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

  useEffect(() => {
    produtosRef.current = produtos;
  }, [produtos]);

  function adicionarAoCarrinho(produto) {
    setCarrinho((atual) => {
      const existente = atual.find((item) => item.produtoId === produto.id);
      if (existente) {
        return atual.map((item) =>
          item.produtoId === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      return [
        ...atual,
        { produtoId: produto.id, nome: produto.nome, precoVenda: Number(produto.precoVenda), quantidade: 1 },
      ];
    });
  }

  /**
   * Leitor de codigo de barras: escuta `keydown` na janela inteira e
   * acumula digitos que chegam rapido demais pra serem datilografia humana
   * (ver `INTERVALO_MAX_LEITOR_MS`). Ao ver Enter (o terminador que todo
   * leitor USB/bluetooth manda por padrao), tenta casar o buffer acumulado
   * com um produto e adiciona ao carrinho automaticamente.
   *
   * `Produto` nao tem campo de codigo de barras/SKU no schema (conferido
   * antes de implementar) - como substituto ate esse campo existir de
   * verdade no backend (fora do escopo desta tarefa, so frontend), o
   * "codigo" aqui casa contra o proprio `produto.id`. Documentado tambem
   * na resposta ao usuario - nao e uma leitura de codigo de barras real de
   * produto, e a integracao do LEITOR (deteccao de digitacao rapida +
   * Enter), pronta pra trocar o `find` por um campo de codigo real assim
   * que ele existir.
   *
   * Ignora o evento se o foco estiver num campo de texto/select (busca do
   * PDV, valor recebido do checkout etc.) - senao cada tecla digitada
   * normalmente ali entraria no buffer do "leitor" por engano.
   */
  useEffect(() => {
    let buffer = '';
    let ultimoTimestamp = 0;

    function elementoEhCampoDeEntrada(elemento) {
      if (!elemento) return false;
      const tag = elemento.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || elemento.isContentEditable;
    }

    function buscarPorCodigo(codigo) {
      const produtoEncontrado = (produtosRef.current || []).find((produto) => String(produto.id) === codigo);

      if (!produtoEncontrado) {
        mostrarToast(`Nenhum produto encontrado para o código "${codigo}".`, 'erro');
        return;
      }

      const semEstoque = !produtoEncontrado.sobDemanda && produtoEncontrado.estoqueAtual <= 0;
      if (semEstoque) {
        mostrarToast(`"${produtoEncontrado.nome}" está sem estoque disponível.`, 'aviso');
        return;
      }

      adicionarAoCarrinho(produtoEncontrado);
      mostrarToast(`"${produtoEncontrado.nome}" adicionado via leitor de código.`, 'sucesso', 2500);
    }

    function handleKeyDown(event) {
      if (elementoEhCampoDeEntrada(document.activeElement)) return;

      if (event.key === 'Enter') {
        if (buffer.length >= TAMANHO_MINIMO_CODIGO) {
          buscarPorCodigo(buffer);
        }
        buffer = '';
        return;
      }

      const agora = Date.now();
      const intervalo = agora - ultimoTimestamp;
      ultimoTimestamp = agora;

      if (/^[0-9]$/.test(event.key)) {
        buffer = intervalo <= INTERVALO_MAX_LEITOR_MS ? buffer + event.key : event.key;
      } else {
        // Qualquer tecla nao-numerica no meio (exceto Enter, ja tratado
        // acima) quebra a leitura - nao e um leitor de codigo de barras
        // numerico se aparece uma letra no meio.
        buffer = '';
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    const termo = busca.trim().toLowerCase();

    return produtos.filter((produto) => {
      if (termo && !produto.nome.toLowerCase().includes(termo)) return false;
      if (filtroRapido === 'sob_demanda' && !produto.sobDemanda) return false;
      if (filtroRapido === 'estoque_baixo' && (produto.sobDemanda || produto.estoqueAtual > produto.estoqueMinimo))
        return false;
      return true;
    });
  }, [produtos, busca, filtroRapido]);

  function alterarQuantidade(produtoId, delta) {
    setCarrinho((atual) =>
      atual
        .map((item) => (item.produtoId === produtoId ? { ...item, quantidade: item.quantidade + delta } : item))
        .filter((item) => item.quantidade > 0)
    );
  }

  function removerDoCarrinho(produtoId) {
    setCarrinho((atual) => atual.filter((item) => item.produtoId !== produtoId));
  }

  const total = carrinho.reduce((soma, item) => soma + item.precoVenda * item.quantidade, 0);

  /**
   * Chamada pelo `ModalCheckoutPDV` ao confirmar - so aqui de fato fala com
   * a API (mesmo padrao dos outros modais do app: modal monta a intencao,
   * a pagina/service e quem executa). Erro lancado aqui e capturado pelo
   * proprio modal (fica exibido la dentro, sem fechar, pra nao perder o
   * carrinho). Sucesso fecha o modal e limpa o carrinho por aqui.
   */
  async function confirmarPagamento(formaPagamento) {
    const resultado = await apiFetch('/vendas', {
      method: 'POST',
      body: JSON.stringify({
        itens: carrinho.map((item) => ({ produto_id: item.produtoId, quantidade: item.quantidade })),
        forma_pagamento: formaPagamento,
        data: dataDeHojeIso(),
      }),
    });

    setProdutos((atual) =>
      atual.map((produto) => {
        const itemVendido = carrinho.find((item) => item.produtoId === produto.id);
        return itemVendido && !produto.sobDemanda
          ? { ...produto, estoqueAtual: produto.estoqueAtual - itemVendido.quantidade }
          : produto;
      })
    );

    setCarrinho([]);
    setModalCheckoutAberto(false);
    mostrarToast('Venda finalizada com sucesso!', 'sucesso');

    (resultado.alertasEstoqueBaixo || []).forEach((alerta) => {
      mostrarToast(
        `Estoque baixo: "${alerta.produtoNome}" ficou com ${alerta.estoqueAtual} un. (mínimo ${alerta.estoqueMinimo}).`,
        'aviso'
      );
    });
    (resultado.alertasIngredientesCriticos || []).forEach((alerta) => {
      mostrarToast(
        `Estoque de "${alerta.ingredienteNome}" ficou negativo (${alerta.estoqueAtual}) após a venda de "${alerta.produtoNome}".`,
        'aviso'
      );
    });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Cabecalho enxuto - sem Sidebar nesta tela (ver App.jsx), entao
          precisa do proprio jeito de voltar pro resto do sistema. */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Voltar ao painel"
            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 sm:text-xl">PDV — Frente de Loja</h1>
            <p className="hidden text-sm text-slate-400 dark:text-slate-500 sm:block">
              Toque num produto pra adicionar ao carrinho
            </p>
          </div>
        </div>

        <span
          title="Leitor de código de barras ativo nesta tela"
          className="hidden items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 sm:inline-flex"
        >
          <ScanBarcode size={16} aria-hidden="true" />
          Leitor ativo
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Coluna esquerda (~70%): busca + filtros + grid de produtos */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:w-[70%]">
          <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-blue-400">
              <Search size={22} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <input
                type="text"
                placeholder="Buscar produto pelo nome..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTROS_RAPIDOS.map(({ valor, rotulo }) => {
                const ativo = filtroRapido === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setFiltroRapido(valor)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                      ativo
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {rotulo}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {carregando && <p className="py-10 text-center text-lg text-slate-500 dark:text-slate-400">Carregando produtos...</p>}

            {erro && (
              <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {erro}
              </p>
            )}

            {!carregando && !erro && produtosFiltrados.length === 0 && (
              <p className="py-10 text-center text-lg text-slate-500 dark:text-slate-400">Nenhum produto encontrado.</p>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {produtosFiltrados.map((produto) => {
                const semEstoque = !produto.sobDemanda && produto.estoqueAtual <= 0;
                const corPlaceholder = CORES_PLACEHOLDER[produto.id % CORES_PLACEHOLDER.length];

                return (
                  <button
                    key={produto.id}
                    type="button"
                    disabled={semEstoque}
                    onClick={() => adicionarAoCarrinho(produto)}
                    title={semEstoque ? 'Sem estoque disponível' : `Adicionar ${produto.nome}`}
                    className="flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-slate-900 dark:ring-slate-800"
                  >
                    <div
                      className={`flex aspect-square items-center justify-center bg-gradient-to-br ${corPlaceholder} text-white/90`}
                    >
                      <Package size={40} aria-hidden="true" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="line-clamp-2 text-base font-bold text-slate-900 dark:text-slate-100">{produto.nome}</p>
                      <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        {formatarMoeda(produto.precoVenda)}
                      </p>
                      {produto.sobDemanda ? (
                        <span className="mt-auto inline-flex w-fit items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          Sob encomenda
                        </span>
                      ) : (
                        <span
                          className={`mt-auto text-sm font-semibold ${
                            semEstoque ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {semEstoque ? 'Sem estoque' : `${produto.estoqueAtual} em estoque`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Coluna direita (~30%): carrinho */}
        <div className="flex min-h-0 shrink-0 flex-col border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-[30%] lg:border-l lg:border-t-0">
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-6">
            <ShoppingCart size={22} className="text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Carrinho {carrinho.length > 0 && `(${carrinho.reduce((soma, item) => soma + item.quantidade, 0)})`}
            </h2>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
            {carrinho.length === 0 && (
              <p className="py-10 text-center text-base text-slate-400 dark:text-slate-500">
                Toque num produto à esquerda (ou use o leitor de código) pra começar.
              </p>
            )}

            {carrinho.map((item) => (
              <div
                key={item.produtoId}
                className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{item.nome}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatarMoeda(item.precoVenda)} un. · {formatarMoeda(item.precoVenda * item.quantidade)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.produtoId, -1)}
                    aria-label={`Diminuir quantidade de ${item.nome}`}
                    className="rounded-lg bg-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <span className="w-6 text-center text-base font-bold text-slate-900 dark:text-slate-100">
                    {item.quantidade}
                  </span>
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.produtoId, 1)}
                    aria-label={`Aumentar quantidade de ${item.nome}`}
                    className="rounded-lg bg-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removerDoCarrinho(item.produtoId)}
                    aria-label={`Remover ${item.nome} do carrinho`}
                    className="ml-1 rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 space-y-4 border-t border-slate-200 p-4 dark:border-slate-800 sm:p-6">
            <div className="flex items-center justify-between text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              <span>Total</span>
              <span>{formatarMoeda(total)}</span>
            </div>

            <button
              type="button"
              onClick={() => setModalCheckoutAberto(true)}
              disabled={carrinho.length === 0}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-5 text-xl font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CircleDollarSign size={26} aria-hidden="true" />
              Finalizar Venda
            </button>
          </div>
        </div>
      </div>

      {modalCheckoutAberto && (
        <ModalCheckoutPDV total={total} onFechar={() => setModalCheckoutAberto(false)} onConfirmar={confirmarPagamento} />
      )}
    </div>
  );
}
