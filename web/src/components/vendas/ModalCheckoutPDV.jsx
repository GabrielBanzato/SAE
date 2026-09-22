import { useState } from 'react';
import { Banknote, QrCode, CreditCard, Wallet, X, CircleDollarSign } from 'lucide-react';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', rotulo: 'Dinheiro', icon: Banknote },
  { valor: 'pix', rotulo: 'Pix', icon: QrCode },
  { valor: 'cartao_credito', rotulo: 'Crédito', icon: CreditCard },
  { valor: 'cartao_debito', rotulo: 'Débito', icon: Wallet },
];

/**
 * Checkout rapido do PDV (Frente de Loja) - so as 4 formas de pagamento
 * "do dia a dia" pedidas pra esta tela (sem as exclusivas do segmento
 * "varejo_alimentacao", "pendente", nem vinculo a cliente/funcionario -
 * quem precisar disso usa a tela completa `/vendas`, ver Vendas.jsx).
 *
 * Mesmo padrao dos outros modais do app (ModalLancamento.jsx,
 * ModalProduto.jsx): so monta o payload e chama `onConfirmar` (que o pai -
 * PDV.jsx - implementa com o POST de verdade); erro lancado por
 * `onConfirmar` fica exibido aqui dentro, sem fechar o modal, pra o
 * usuario poder corrigir e tentar de novo sem perder o carrinho.
 */
export default function ModalCheckoutPDV({ total, onFechar, onConfirmar }) {
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [valorRecebido, setValorRecebido] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState('');

  const ehDinheiro = formaPagamento === 'dinheiro';
  const valorRecebidoNumero = Number(valorRecebido);
  const troco =
    ehDinheiro && valorRecebido !== '' && Number.isFinite(valorRecebidoNumero) ? valorRecebidoNumero - total : null;

  async function handleConfirmar() {
    setErro('');

    if (ehDinheiro && (!valorRecebido || !Number.isFinite(valorRecebidoNumero) || valorRecebidoNumero < total)) {
      setErro('Informe um valor recebido maior ou igual ao total da venda.');
      return;
    }

    setConfirmando(true);
    try {
      await onConfirmar(formaPagamento);
    } catch (err) {
      setErro(err.message || 'Não foi possível finalizar a venda.');
      setConfirmando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={confirmando ? undefined : onFechar}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-checkout-pdv"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-checkout-pdv" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Finalizar Venda
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={confirmando}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-blue-600 p-5 text-center text-white dark:bg-blue-700">
          <p className="text-base font-semibold text-blue-100">Total a pagar</p>
          <p className="text-4xl font-extrabold">{formatarMoeda(total)}</p>
        </div>

        <div className="mt-6">
          <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Forma de Pagamento</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {FORMAS_PAGAMENTO.map(({ valor, rotulo, icon: Icon }) => {
              const selecionado = formaPagamento === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={selecionado}
                  disabled={confirmando}
                  onClick={() => {
                    setFormaPagamento(valor);
                    setErro('');
                  }}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    selecionado
                      ? 'border-blue-500 bg-blue-50 shadow-lg dark:border-blue-400 dark:bg-blue-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon
                    size={28}
                    className={selecionado ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-base font-bold ${
                      selecionado ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {rotulo}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {ehDinheiro && (
          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Valor Recebido</span>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-blue-400">
                <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">R$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={valorRecebido}
                  onChange={(event) => setValorRecebido(event.target.value)}
                  placeholder="0,00"
                  className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
                />
              </div>
            </label>

            {troco !== null && (
              <div
                className={`flex items-center justify-between rounded-2xl p-4 text-lg font-bold ${
                  troco >= 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                <span>{troco >= 0 ? 'Troco' : 'Falta'}</span>
                <span>{formatarMoeda(Math.abs(troco))}</span>
              </div>
            )}
          </div>
        )}

        {erro && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onFechar}
            disabled={confirmando}
            className="rounded-2xl px-5 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={confirmando}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CircleDollarSign size={20} aria-hidden="true" />
            {confirmando ? 'Finalizando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
