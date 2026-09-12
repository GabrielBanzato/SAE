import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Plus, Receipt } from 'lucide-react';
import { apiFetch } from '../services/api';
import { dataCalendario } from '../utils/datas';
import ModalLancamento from '../components/lancamentos/ModalLancamento';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(valor) {
  return dataCalendario(valor).toLocaleDateString('pt-BR');
}

/**
 * "Atrasado" = pendente com vencimento antes de hoje. Comparado so pela
 * data (zera as horas) - um lancamento que vence hoje ainda nao esta
 * atrasado.
 */
function estaAtrasado(lancamento) {
  if (lancamento.status === 'PAGO') return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return dataCalendario(lancamento.dataVencimento) < hoje;
}

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'a_pagar', rotulo: 'A Pagar' },
  { valor: 'a_receber', rotulo: 'A Receber' },
  { valor: 'atrasados', rotulo: 'Atrasados' },
];

function BadgeTipo({ tipo }) {
  const entrada = tipo === 'ENTRADA';
  const Icon = entrada ? ArrowUpCircle : ArrowDownCircle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
        entrada
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      {entrada ? 'Entrada' : 'Saída'}
    </span>
  );
}

function ValorLancamento({ tipo, valor }) {
  const entrada = tipo === 'ENTRADA';
  return (
    <span className={`font-bold ${entrada ? 'text-emerald-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {entrada ? '+ ' : '- '}
      {formatarMoeda(valor)}
    </span>
  );
}

/**
 * Toggle compacto pra marcar Pago/Pendente direto na tabela - trilho +
 * bolinha deslizante, mesmo espirito visual do `Switch.jsx` (usado no
 * ModalProduto), mas menor e sem rotulo ao lado (nao cabe numa celula de
 * tabela) e com um texto de status proprio embutido ao lado do trilho.
 * `atualizando` desabilita o clique e troca o texto por "Salvando..." -
 * evita cliques duplicados enquanto o PUT esta em voo.
 */
function TogglePago({ pago, atualizando, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pago}
      disabled={atualizando}
      onClick={onToggle}
      className="flex items-center gap-2.5 disabled:cursor-wait disabled:opacity-60"
    >
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          pago ? 'bg-emerald-500 dark:bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            pago ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </span>
      <span
        className={`text-sm font-bold ${
          atualizando
            ? 'text-slate-400 dark:text-slate-500'
            : pago
              ? 'text-emerald-600 dark:text-green-400'
              : 'text-amber-600 dark:text-amber-400'
        }`}
      >
        {atualizando ? 'Salvando...' : pago ? 'Pago' : 'Pendente'}
      </span>
    </button>
  );
}

/**
 * Contas a Pagar e Receber: lista lancamentos manuais (receitas/despesas
 * avulsas) consumindo o CRUD de `/lancamentos` (backend criado na tarefa
 * anterior). So cria + alterna status por aqui - editar/excluir ficam pra
 * uma proxima tarefa (o pedido desta foi so listar, filtrar, cadastrar e
 * marcar como pago).
 */
export default function Lancamentos() {
  const [lancamentos, setLancamentos] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [idAtualizando, setIdAtualizando] = useState(null);
  const [erroAtualizacao, setErroAtualizacao] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch('/lancamentos')
      .then((dados) => {
        if (ativo) setLancamentos(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar os lançamentos.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const lancamentosFiltrados = useMemo(() => {
    if (!lancamentos) return [];
    switch (filtroAtivo) {
      case 'a_pagar':
        return lancamentos.filter((item) => item.tipo === 'SAIDA');
      case 'a_receber':
        return lancamentos.filter((item) => item.tipo === 'ENTRADA');
      case 'atrasados':
        return lancamentos.filter(estaAtrasado);
      default:
        return lancamentos;
    }
  }, [lancamentos, filtroAtivo]);

  async function criarLancamento(payload) {
    const criado = await apiFetch('/lancamentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setLancamentos((atual) => [...(atual || []), criado]);
    setModalAberto(false);
  }

  async function alternarStatus(lancamento) {
    const novoStatus = lancamento.status === 'PAGO' ? 'PENDENTE' : 'PAGO';
    setErroAtualizacao('');
    setIdAtualizando(lancamento.id);

    try {
      const atualizado = await apiFetch(`/lancamentos/${lancamento.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: novoStatus,
          // Marcar como pago sem uma data de pagamento ficaria incoerente no
          // extrato - usa a data de hoje. Voltando pra pendente, limpa a
          // data (nao foi pago, afinal).
          data_pagamento: novoStatus === 'PAGO' ? new Date().toISOString().slice(0, 10) : null,
        }),
      });
      setLancamentos((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
    } catch (err) {
      setErroAtualizacao(err.message || 'Não foi possível atualizar o status do lançamento.');
    } finally {
      setIdAtualizando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
            <Receipt size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Lançamentos
          </h1>
          <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
            Contas a pagar e a receber do seu negócio.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          <Plus size={22} aria-hidden="true" />
          Novo Lançamento
        </button>
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
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Descrição
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tipo
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Valor
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Vencimento
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {carregando && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-lg text-slate-500 dark:text-slate-400">
                    Carregando lançamentos...
                  </td>
                </tr>
              )}

              {!carregando && lancamentosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum lançamento encontrado.
                    </p>
                    <p className="mt-1 text-base text-slate-400 dark:text-slate-500">
                      {filtroAtivo === 'todos'
                        ? 'Clique em "Novo Lançamento" para começar.'
                        : 'Tente outro filtro ou cadastre um novo lançamento.'}
                    </p>
                  </td>
                </tr>
              )}

              {!carregando &&
                lancamentosFiltrados.map((lancamento) => {
                  const atrasado = estaAtrasado(lancamento);
                  return (
                    <tr key={lancamento.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="px-6 py-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {lancamento.descricao}
                      </td>
                      <td className="px-6 py-4">
                        <BadgeTipo tipo={lancamento.tipo} />
                      </td>
                      <td className="px-6 py-4 text-base">
                        <ValorLancamento tipo={lancamento.tipo} valor={lancamento.valor} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-base ${
                              atrasado ? 'font-bold text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {formatarData(lancamento.dataVencimento)}
                          </span>
                          {atrasado && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              title="Vencido e ainda não pago"
                            >
                              <AlertTriangle size={12} aria-hidden="true" />
                              Atrasado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TogglePago
                          pago={lancamento.status === 'PAGO'}
                          atualizando={idAtualizando === lancamento.id}
                          onToggle={() => alternarStatus(lancamento)}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && <ModalLancamento onFechar={() => setModalAberto(false)} onSalvar={criarLancamento} />}
    </div>
  );
}
