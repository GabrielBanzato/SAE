import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Search, Plus, Minus, Trash2, CircleDollarSign } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CampoData from '../components/CampoData';
import SeletorCliente from '../components/vendas/SeletorCliente';
import ModalClienteRapido from '../components/clientes/ModalClienteRapido';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataDeHojeIso() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

const FORMAS_PAGAMENTO_BASE = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'PIX' },
  { valor: 'cartao_credito', rotulo: 'Cartão de Crédito' },
  { valor: 'cartao_debito', rotulo: 'Cartão de Débito' },
  { valor: 'pendente', rotulo: 'Pendente' },
];

// So aparecem no select pra empresas do segmento "varejo_alimentacao"
// (pedido explicito - "Regra Condicional") - o backend tambem valida isso
// de verdade (vendas.service.js), entao esconder as opcoes aqui e so uma
// conveniencia de UX, nao a unica linha de defesa.
const FORMAS_PAGAMENTO_ALIMENTICIO = [
  { valor: 'consumo_interno', rotulo: 'Consumo Interno' },
  { valor: 'doacao', rotulo: 'Doação' },
];

const classesSelect =
  'mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400';

/**
 * Tela de Vendas em layout de PDV: catalogo (esquerda) + carrinho/checkout
 * (direita). O carrinho e so estado local do React, mas "Finalizar Venda"
 * agora dispara UM UNICO `POST /vendas` com todos os itens do carrinho
 * (`itens: [{ produto_id, quantidade }]`) - o backend ganhou suporte a
 * carrinho com varios produtos nesta mesma tarefa (ver
 * NOTAS_IMPORTANTES.md, "1 produto por venda" virou "Venda + VendaItem[]").
 * Antes disso, essa tela mandava 1 requisicao por item, em sequencia, por
 * limitacao da API antiga - isso nao existe mais.
 */
export default function Vendas() {
  const { empresa } = useAuth();
  const segmentoAlimenticio = empresa?.segmento === 'varejo_alimentacao';

  const [produtos, setProdutos] = useState(null);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [erroProdutos, setErroProdutos] = useState('');

  const [clientes, setClientes] = useState([]);
  const [equipe, setEquipe] = useState([]);

  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [modalClienteAberto, setModalClienteAberto] = useState(false);

  const [dataVenda, setDataVenda] = useState(dataDeHojeIso);
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [funcionarioId, setFuncionarioId] = useState('');

  const [finalizando, setFinalizando] = useState(false);
  const [erroVenda, setErroVenda] = useState('');
  const [sucessoVenda, setSucessoVenda] = useState('');

  const formasPagamento = segmentoAlimenticio
    ? [...FORMAS_PAGAMENTO_BASE, ...FORMAS_PAGAMENTO_ALIMENTICIO]
    : FORMAS_PAGAMENTO_BASE;

  // Se a empresa deixar de ser "varejo_alimentacao" (ou o formulario mudar de
  // segmento noutra aba) enquanto "Consumo Interno"/"Doação" estiver
  // selecionado, volta pro padrao - nao deve sobrar uma opcao invalida
  // selecionada que o backend rejeitaria ao finalizar. Ajuste durante o
  // proprio render (comparando com o valor anterior), nao `useEffect` -
  // deriva de uma prop que mudou, nao sincroniza com nada externo (mesmo
  // padrao ja usado em Sidebar.jsx pro accordion da rota ativa).
  const [segmentoAlimenticioAnterior, setSegmentoAlimenticioAnterior] = useState(segmentoAlimenticio);
  if (segmentoAlimenticio !== segmentoAlimenticioAnterior) {
    setSegmentoAlimenticioAnterior(segmentoAlimenticio);
    if (!segmentoAlimenticio && (formaPagamento === 'consumo_interno' || formaPagamento === 'doacao')) {
      setFormaPagamento('dinheiro');
    }
  }

  useEffect(() => {
    let ativo = true;

    apiFetch('/produtos')
      .then((dados) => {
        if (ativo) setProdutos(dados);
      })
      .catch((err) => {
        if (ativo) setErroProdutos(err.message || 'Não foi possível carregar os produtos.');
      })
      .finally(() => {
        if (ativo) setCarregandoProdutos(false);
      });

    // Erro ao carregar clientes/equipe nao deve travar o PDV - vender sem
    // cliente atrelado (ou sem nunca precisar do select de Funcionario)
    // continua funcionando normalmente.
    apiFetch('/clientes')
      .then((dados) => {
        if (ativo) setClientes(dados);
      })
      .catch(() => {});

    apiFetch('/empresa/usuarios')
      .then((dados) => {
        if (ativo) setEquipe(dados);
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, []);

  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((produto) => produto.nome.toLowerCase().includes(termo));
  }, [produtos, busca]);

  function adicionarAoCarrinho(produto) {
    setSucessoVenda('');
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

  async function cadastrarClienteRapido(dados) {
    const cliente = await apiFetch('/clientes', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
    setClientes((atual) => [...atual, cliente].sort((a, b) => a.nome.localeCompare(b.nome)));
    setClienteId(String(cliente.id));
    setModalClienteAberto(false);
  }

  const total = carrinho.reduce((soma, item) => soma + item.precoVenda * item.quantidade, 0);

  async function finalizarVenda() {
    if (carrinho.length === 0) return;
    if (formaPagamento === 'consumo_interno' && !funcionarioId) {
      setErroVenda('Selecione o funcionário que consumiu o produto.');
      return;
    }

    setFinalizando(true);
    setErroVenda('');
    setSucessoVenda('');

    try {
      await apiFetch('/vendas', {
        method: 'POST',
        body: JSON.stringify({
          itens: carrinho.map((item) => ({ produto_id: item.produtoId, quantidade: item.quantidade })),
          forma_pagamento: formaPagamento,
          data: dataVenda,
          ...(clienteId ? { cliente_id: Number(clienteId) } : {}),
          ...(formaPagamento === 'consumo_interno' ? { funcionario_id: Number(funcionarioId) } : {}),
        }),
      });

      // Atualiza o estoque exibido no catalogo sem precisar recarregar a
      // lista inteira (produtos sob demanda nunca debitam estoque no
      // backend, entao nao mexe neles aqui tambem).
      setProdutos((atual) =>
        atual.map((produto) => {
          const itemVendido = carrinho.find((item) => item.produtoId === produto.id);
          return itemVendido && !produto.sobDemanda
            ? { ...produto, estoqueAtual: produto.estoqueAtual - itemVendido.quantidade }
            : produto;
        })
      );

      setCarrinho([]);
      setClienteId('');
      setFuncionarioId('');
      setSucessoVenda('Venda finalizada com sucesso!');
    } catch (err) {
      setErroVenda(err.message || 'Não foi possível finalizar a venda.');
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <ShoppingCart size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Vendas
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Monte o carrinho e finalize a venda em poucos toques.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Coluna esquerda: catalogo */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-blue-400">
            <Search size={20} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
          </div>

          <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {carregandoProdutos && (
              <p className="py-6 text-center text-lg text-slate-500 dark:text-slate-400">Carregando produtos...</p>
            )}

            {erroProdutos && (
              <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {erroProdutos}
              </p>
            )}

            {!carregandoProdutos && produtosFiltrados.length === 0 && (
              <p className="py-6 text-center text-lg text-slate-500 dark:text-slate-400">
                Nenhum produto encontrado.
              </p>
            )}

            {produtosFiltrados.map((produto) => {
              const semEstoque = !produto.sobDemanda && produto.estoqueAtual <= 0;

              return (
                <div
                  key={produto.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {produto.nome}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">{formatarMoeda(produto.precoVenda)}</span>
                      {produto.sobDemanda ? (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          Sob encomenda
                        </span>
                      ) : (
                        <span className={semEstoque ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                          · {produto.estoqueAtual} em estoque
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => adicionarAoCarrinho(produto)}
                    disabled={semEstoque}
                    aria-label={`Adicionar ${produto.nome} ao carrinho`}
                    title={semEstoque ? 'Sem estoque disponível' : 'Adicionar ao carrinho'}
                    className="shrink-0 rounded-full bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  >
                    <Plus size={20} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna direita: carrinho + checkout */}
        <div className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Carrinho</h2>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
            {carrinho.length === 0 && (
              <p className="py-6 text-center text-base text-slate-400 dark:text-slate-500">
                Nenhum item adicionado ainda.
              </p>
            )}

            {carrinho.map((item) => (
              <div
                key={item.produtoId}
                className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{item.nome}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatarMoeda(item.precoVenda)} un. · {formatarMoeda(item.precoVenda * item.quantidade)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.produtoId, -1)}
                    aria-label={`Diminuir quantidade de ${item.nome}`}
                    className="rounded-lg bg-slate-200 p-1.5 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span className="w-6 text-center text-base font-bold text-slate-900 dark:text-slate-100">
                    {item.quantidade}
                  </span>
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.produtoId, 1)}
                    aria-label={`Aumentar quantidade de ${item.nome}`}
                    className="rounded-lg bg-slate-200 p-1.5 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removerDoCarrinho(item.produtoId)}
                    aria-label={`Remover ${item.nome} do carrinho`}
                    className="ml-1 rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 shrink-0 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="flex items-center justify-between text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <span>Total</span>
              <span>{formatarMoeda(total)}</span>
            </div>

            <label className="block">
              <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Data da Venda</span>
              <CampoData variant="compacta" value={dataVenda} onChange={setDataVenda} />
            </label>

            <label className="block">
              <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
                Forma de Pagamento / Tipo de Saída
              </span>
              <select
                value={formaPagamento}
                onChange={(event) => setFormaPagamento(event.target.value)}
                className={classesSelect}
              >
                {formasPagamento.map(({ valor, rotulo }) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>

            {formaPagamento === 'consumo_interno' && (
              <label className="block">
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Funcionário</span>
                <select
                  value={funcionarioId}
                  onChange={(event) => setFuncionarioId(event.target.value)}
                  className={classesSelect}
                >
                  <option value="">Selecione...</option>
                  {equipe.map((membro) => (
                    <option key={membro.id} value={membro.id}>
                      {membro.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div>
              <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
                Atrelar a um Cliente (Opcional)
              </span>
              <div className="mt-2">
                <SeletorCliente
                  clientes={clientes}
                  clienteId={clienteId}
                  onSelecionar={setClienteId}
                  onNovoCliente={() => setModalClienteAberto(true)}
                />
              </div>
            </div>

            {erroVenda && (
              <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {erroVenda}
              </p>
            )}

            {sucessoVenda && (
              <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {sucessoVenda}
              </p>
            )}

            <button
              type="button"
              onClick={finalizarVenda}
              disabled={carrinho.length === 0 || finalizando}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-4 text-xl font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CircleDollarSign size={24} aria-hidden="true" />
              {finalizando ? 'Finalizando...' : 'Finalizar Venda'}
            </button>
          </div>
        </div>
      </div>

      {modalClienteAberto && (
        <ModalClienteRapido onFechar={() => setModalClienteAberto(false)} onSalvar={cadastrarClienteRapido} />
      )}
    </div>
  );
}
