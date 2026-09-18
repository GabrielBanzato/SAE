import { X } from 'lucide-react';
import { dataCalendario } from '../../utils/datas';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

/**
 * Modal de "Detalhes" da venda - mesmo padrao visual/estrutural dos outros
 * modais do app (ModalLancamento.jsx, ModalLembrete.jsx): overlay
 * centralizado, fecha so com o X ou clique fora (sem Escape aqui, ja que
 * esse modal e so leitura, sem formulario/estado pra perder).
 */
export default function ModalDetalhesVenda({ venda, onFechar }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-detalhes-venda"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-detalhes-venda" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Venda #{venda.id}
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

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-base dark:bg-slate-900/50">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Cliente
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{venda.cliente?.nome ?? 'Avulso'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Data da Venda
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{formatarData(venda.data)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Forma de Pagamento
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {ROTULOS_FORMA_PAGAMENTO[venda.formaPagamento] ?? venda.formaPagamento}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Vendido por
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{venda.usuario?.nome ?? '—'}</p>
          </div>
          {venda.funcionario && (
            <div className="col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Funcionário (Consumo Interno)
              </p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{venda.funcionario.nome}</p>
            </div>
          )}
        </div>

        <h3 className="mt-6 text-base font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Itens
        </h3>
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
          {venda.itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {item.produto?.nome ?? `Produto #${item.produtoId}`}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {item.quantidade} × {formatarMoeda(item.precoUnitario)}
                </p>
              </div>
              <span className="shrink-0 text-lg font-bold text-slate-700 dark:text-slate-200">
                {formatarMoeda(item.subtotal)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">Total</span>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatarMoeda(venda.total)}
          </span>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl bg-slate-100 px-5 py-2.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
