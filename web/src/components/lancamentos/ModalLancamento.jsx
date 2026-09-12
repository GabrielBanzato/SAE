import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Calendar, CheckCircle2, Circle, FileText, X } from 'lucide-react';
import CampoTexto from '../CampoTexto';

function SimboloReal({ className }) {
  return <span className={`text-base font-bold ${className}`}>R$</span>;
}

/**
 * Toggle segmentado (pilula com 2 opcoes) generico o suficiente pra Tipo e
 * Status neste mesmo modal - mesmo visual de `TipoPessoaToggle.jsx`
 * (usado no Cadastro), mas nao reaproveitado direto porque aquele
 * componente tem os rotulos PF/PJ fixos. So local a este arquivo (usado 2x
 * aqui, nao justifica virar um componente compartilhado ainda).
 */
function Segmentado({ opcoes, valor, onChange }) {
  return (
    <div className="inline-flex w-full rounded-full bg-slate-100 p-1 dark:bg-slate-900">
      {opcoes.map((opcao) => {
        const ativo = valor === opcao.valor;
        const Icon = opcao.icon;
        return (
          <button
            key={opcao.valor}
            type="button"
            onClick={() => onChange(opcao.valor)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-base font-bold transition-all duration-200 ${
              ativo
                ? `bg-white shadow dark:bg-slate-800 ${opcao.corAtivo}`
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

const TIPOS = [
  { valor: 'SAIDA', rotulo: 'Saída', icon: ArrowDownCircle, corAtivo: 'text-red-600 dark:text-red-400' },
  { valor: 'ENTRADA', rotulo: 'Entrada', icon: ArrowUpCircle, corAtivo: 'text-emerald-600 dark:text-green-400' },
];

const STATUS = [
  { valor: 'PENDENTE', rotulo: 'Pendente', icon: Circle, corAtivo: 'text-amber-600 dark:text-amber-400' },
  { valor: 'PAGO', rotulo: 'Pago', icon: CheckCircle2, corAtivo: 'text-emerald-600 dark:text-green-400' },
];

function valoresIniciais() {
  return { descricao: '', valor: '', tipo: 'SAIDA', dataVencimento: '', status: 'PENDENTE' };
}

/**
 * Modal de cadastro manual de lancamento (receita/despesa avulsa) - mesmo
 * padrao visual/estrutural do ModalProduto.jsx e ModalClienteRapido.jsx:
 * overlay centralizado, fecha com Escape/clique fora, so cria (nao edita -
 * o pedido desta tarefa foi so "adicionar um lancamento manual").
 */
export default function ModalLancamento({ onFechar, onSalvar }) {
  const [campos, setCampos] = useState(valoresIniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar]);

  function atualizarCampo(campo, valor) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    if (!campos.descricao.trim()) {
      setErro('Informe a descrição do lançamento.');
      return;
    }
    if (!campos.valor || Number(campos.valor) <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    if (!campos.dataVencimento) {
      setErro('Informe a data de vencimento.');
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        descricao: campos.descricao.trim(),
        valor: Number(campos.valor),
        tipo: campos.tipo,
        data_vencimento: campos.dataVencimento,
        status: campos.status,
        // Lancar ja como "Pago" sem data de pagamento ficaria estranho no
        // extrato (pago quando?) - usa a data de vencimento como melhor
        // estimativa, ja que o formulario nao pede uma data separada pra isso.
        ...(campos.status === 'PAGO' ? { data_pagamento: campos.dataVencimento } : {}),
      });
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o lançamento.');
      setSalvando(false);
    }
  }

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
        aria-labelledby="titulo-modal-lancamento"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-lancamento" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Novo Lançamento
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
          <div>
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Tipo</span>
            <div className="mt-2">
              <Segmentado opcoes={TIPOS} valor={campos.tipo} onChange={(valor) => atualizarCampo('tipo', valor)} />
            </div>
          </div>

          <CampoTexto
            label="Descrição"
            icon={FileText}
            type="text"
            placeholder="Ex: Conta de luz, Venda de balcão..."
            value={campos.descricao}
            onChange={(event) => atualizarCampo('descricao', event.target.value)}
            autoFocus
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <CampoTexto
              label="Valor (R$)"
              icon={SimboloReal}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={campos.valor}
              onChange={(event) => atualizarCampo('valor', event.target.value)}
              required
            />
            <CampoTexto
              label="Vencimento"
              icon={Calendar}
              type="date"
              value={campos.dataVencimento}
              onChange={(event) => atualizarCampo('dataVencimento', event.target.value)}
              required
            />
          </div>

          <div>
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Status inicial</span>
            <div className="mt-2">
              <Segmentado opcoes={STATUS} valor={campos.status} onChange={(valor) => atualizarCampo('status', valor)} />
            </div>
          </div>

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
              {salvando ? 'Salvando...' : 'Adicionar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
