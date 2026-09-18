import { useEffect, useState } from 'react';
import { History, Eye } from 'lucide-react';
import { apiFetch } from '../services/api';
import { dataCalendario } from '../utils/datas';
import ModalDetalhesVenda from '../components/vendas/ModalDetalhesVenda';

function formatarData(valor) {
  return dataCalendario(valor).toLocaleDateString('pt-BR');
}

const ROTULOS_FORMA_PAGAMENTO = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  pendente: 'Pendente',
  consumo_interno: 'Consumo Interno',
  doacao: 'Doação',
};

// Determina a cor do badge de Status a partir da forma de pagamento
// (pedido explicito): verde pra formas que representam dinheiro recebido
// de fato, amarelo pra "Pendente", cinza pra "Consumo Interno"/"Doação"
// (nem chegam a ser financeiras). Mesma classificacao usada no backend
// (vendas.service.js#FORMAS_PAGAS_NO_ATO) pra decidir se gera Lancamento.
function StatusVenda({ formaPagamento }) {
  if (formaPagamento === 'pendente') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        Pendente
      </span>
    );
  }
  if (formaPagamento === 'consumo_interno' || formaPagamento === 'doacao') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200 px-3 py-1 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        Consumo/Doação
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      Pago/Concluído
    </span>
  );
}

/** "Pão de batata + 2 itens" (pedido, exemplo literal) - so o 1º produto por extenso, o resto so contado. */
function resumoProdutos(itens) {
  if (!itens || itens.length === 0) return '—';
  const [primeiro, ...resto] = itens;
  const nomePrimeiro = primeiro.produto?.nome ?? `Produto #${primeiro.produtoId}`;
  if (resto.length === 0) return nomePrimeiro;
  return `${nomePrimeiro} + ${resto.length} ${resto.length === 1 ? 'item' : 'itens'}`;
}

/**
 * Historico de Vendas: lista todas as vendas da empresa (mais recentes
 * primeiro, `GET /vendas`, novo endpoint criado nesta mesma tarefa junto
 * com o suporte a carrinho com varios itens - a rota antes so aceitava
 * `POST`). Cada linha resume os produtos e abre um modal com os itens
 * exatos ao clicar em "Detalhes" (`ModalDetalhesVenda.jsx`).
 */
export default function HistoricoVendas() {
  const [vendas, setVendas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [vendaSelecionada, setVendaSelecionada] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch('/vendas')
      .then((dados) => {
        if (ativo) setVendas(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar o histórico de vendas.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <History size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Histórico de Vendas
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">Todas as vendas já registradas no PDV.</p>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Produtos
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Cliente
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Data da Venda
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Forma de Pagamento
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Data do Pagamento
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {carregando && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-lg text-slate-500 dark:text-slate-400">
                    Carregando vendas...
                  </td>
                </tr>
              )}

              {!carregando && vendas && vendas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-lg font-semibold text-slate-600 dark:text-slate-300">
                    Nenhuma venda registrada ainda.
                  </td>
                </tr>
              )}

              {!carregando &&
                vendas?.map((venda) => (
                  <tr key={venda.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30">
                    <td className="max-w-xs truncate px-6 py-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {resumoProdutos(venda.itens)}
                    </td>
                    <td className="px-6 py-4 text-base text-slate-700 dark:text-slate-200">
                      {venda.cliente?.nome ?? 'Avulso'}
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-300">
                      {formatarData(venda.data)}
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-300">
                      {ROTULOS_FORMA_PAGAMENTO[venda.formaPagamento] ?? venda.formaPagamento}
                    </td>
                    <td className="px-6 py-4">
                      <StatusVenda formaPagamento={venda.formaPagamento} />
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-300">
                      {venda.dataPagamento ? formatarData(venda.dataPagamento) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setVendaSelecionada(venda)}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      >
                        <Eye size={16} aria-hidden="true" />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {vendaSelecionada && (
        <ModalDetalhesVenda venda={vendaSelecionada} onFechar={() => setVendaSelecionada(null)} />
      )}
    </div>
  );
}
