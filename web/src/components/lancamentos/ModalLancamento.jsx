import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Circle, FileText, X } from 'lucide-react';
import CampoTexto from '../CampoTexto';
import CampoData from '../CampoData';

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

// Chaves precisam bater com CATEGORIAS_VALIDAS em
// api/src/services/lancamentos.service.js (a mesma lista tambem decide o
// "balde" do DRE - Receita/Custo Variavel/Custo Fixo/Dedução - ver
// BUCKET_DRE_POR_CATEGORIA la). Opcoes nao mudam com `tipo` de proposito
// (mantido simples) - o usuario e livre pra categorizar como quiser, o
// backend so valida que a chave existe, nao que faz sentido pro tipo
// escolhido.
const CATEGORIAS = [
  { valor: 'vendas', rotulo: 'Vendas' },
  { valor: 'fornecedores', rotulo: 'Fornecedores/Compras' },
  { valor: 'aluguel', rotulo: 'Aluguel' },
  { valor: 'salarios', rotulo: 'Salários' },
  { valor: 'impostos', rotulo: 'Impostos e Taxas' },
  { valor: 'contas_servicos', rotulo: 'Contas e Serviços' },
  { valor: 'outros', rotulo: 'Outros' },
];

/**
 * `lancamento` presente = edicao, prefiltra os campos a partir dele.
 * `dataVencimento` vem da API como string ISO ("2026-09-17T00:00:00.000Z")
 * - so pega os 10 primeiros caracteres ("2026-09-17") em vez de passar por
 * `new Date(...)`, mesmo cuidado ja documentado em utils/datas.js pra
 * campos "so calendario" (evita qualquer deslocamento de fuso horario).
 */
function valoresIniciais(lancamento) {
  if (!lancamento) {
    return { descricao: '', valor: '', tipo: 'SAIDA', dataVencimento: '', status: 'PENDENTE', categoria: 'outros' };
  }
  return {
    descricao: lancamento.descricao,
    valor: String(lancamento.valor),
    tipo: lancamento.tipo,
    dataVencimento: lancamento.dataVencimento.slice(0, 10),
    status: lancamento.status,
    categoria: lancamento.categoria ?? 'outros',
  };
}

/**
 * Rotulo do campo de data e dinamico (pedido explicito): "Vencimento" so
 * faz sentido pra uma conta a pagar (Saida). Numa Entrada, o significado da
 * data muda conforme o status - se ja esta "Pago", a data e quando o
 * dinheiro de fato entrou ("Data do Recebimento"); se ainda esta
 * "Pendente", e uma previsao futura ("Data Esperada"). O `name` do campo no
 * payload continua sendo `data_vencimento` pro backend (schema nao mudou,
 * so o rotulo exibido).
 */
function rotuloCampoData(tipo, status) {
  if (tipo === 'SAIDA') return 'Vencimento';
  return status === 'PAGO' ? 'Data do Recebimento' : 'Data Esperada';
}

/**
 * Modal de cadastro/edicao de lancamento (receita/despesa avulsa) - mesmo
 * padrao visual/estrutural do ModalProduto.jsx e ModalClienteRapido.jsx:
 * overlay centralizado, fecha com Escape/clique fora.
 *
 * `lancamento` (opcional) decide o modo: presente = edicao (titulo/botao
 * mudam, campos vem prefiltrados - ver `valoresIniciais` acima), ausente =
 * criacao (comportamento original desta tarefa anterior). Quem decide se
 * o `onSalvar` final vira um POST ou um PUT e o componente pai
 * (Lancamentos.jsx) - este modal so monta o payload e devolve pra ele,
 * nao sabe nada sobre verbos HTTP.
 *
 * Ganhou o campo "Categoria" nesta tarefa - `Lancamento` agora tem uma
 * coluna real (`categoria`, ver schema.prisma) que alimenta o DRE
 * (relatorios.service.js#gerarDRE) e o filtro de Lancamentos.jsx, que
 * deixou de ser uma heuristica de texto sobre a descricao pra virar um
 * dado escolhido aqui na hora do cadastro.
 */
export default function ModalLancamento({ lancamento, onFechar, onSalvar }) {
  const [campos, setCampos] = useState(() => valoresIniciais(lancamento));
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

    const payload = {
      descricao: campos.descricao.trim(),
      valor: Number(campos.valor),
      tipo: campos.tipo,
      data_vencimento: campos.dataVencimento,
      status: campos.status,
      categoria: campos.categoria,
    };

    if (lancamento) {
      // Edicao: so mexe em data_pagamento se o status REALMENTE mudou
      // nesta edicao (mesma convencao ja usada pelo toggle Pago/Pendente
      // da tabela, ver Lancamentos.jsx#alternarStatus) - se PAGO continua
      // PAGO (o usuario so corrigiu a descricao, por exemplo), preserva a
      // data de pagamento original em vez de sobrescreve-la.
      if (campos.status === 'PAGO' && lancamento.status !== 'PAGO') {
        payload.data_pagamento = new Date().toISOString().slice(0, 10);
      } else if (campos.status === 'PENDENTE' && lancamento.status !== 'PENDENTE') {
        payload.data_pagamento = null;
      }
    } else if (campos.status === 'PAGO') {
      // Criacao ja como "Pago" sem data de pagamento ficaria estranho no
      // extrato (pago quando?) - usa a data de vencimento como melhor
      // estimativa, ja que o formulario nao pede uma data separada pra isso.
      payload.data_pagamento = campos.dataVencimento;
    }

    setSalvando(true);
    try {
      await onSalvar(payload);
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
            {lancamento ? 'Editar Lançamento' : 'Novo Lançamento'}
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
            <CampoData
              label={rotuloCampoData(campos.tipo, campos.status)}
              value={campos.dataVencimento}
              onChange={(valor) => atualizarCampo('dataVencimento', valor)}
              required
            />
          </div>

          <div>
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {lancamento ? 'Status' : 'Status inicial'}
            </span>
            <div className="mt-2">
              <Segmentado opcoes={STATUS} valor={campos.status} onChange={(valor) => atualizarCampo('status', valor)} />
            </div>
          </div>

          <label className="block">
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Categoria</span>
            <select
              value={campos.categoria}
              onChange={(event) => atualizarCampo('categoria', event.target.value)}
              className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none transition-all focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
            >
              {CATEGORIAS.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-sm text-slate-400 dark:text-slate-500">
              Usada no DRE pra separar receitas de custos variáveis/fixos.
            </span>
          </label>

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
              {salvando ? 'Salvando...' : lancamento ? 'Salvar Alterações' : 'Adicionar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
