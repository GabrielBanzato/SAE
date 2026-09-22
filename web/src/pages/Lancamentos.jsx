import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Download, Pencil, Plus, Receipt } from 'lucide-react';
import { apiFetch } from '../services/api';
import { dataCalendario } from '../utils/datas';
import { useToast } from '../context/ToastContext';
import CampoData from '../components/CampoData';
import ModalLancamento from '../components/lancamentos/ModalLancamento';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(valor) {
  return dataCalendario(valor).toLocaleDateString('pt-BR');
}

/** Escapa um campo pra CSV: sempre entre aspas duplas, com aspas internas duplicadas (regra padrao do formato). */
function campoCsv(valor) {
  return `"${String(valor).replace(/"/g, '""')}"`;
}

/**
 * Gera o CSV a partir dos lancamentos JA FILTRADOS (o que esta visivel na
 * tabela) e dispara o download via Blob + link temporario - sem
 * biblioteca nenhuma, e um padrao nativo do browser. `;` como separador
 * (nao `,`) porque o Excel em pt-BR usa virgula como separador decimal
 * (`R$ 1.234,56`) - usar `,` como delimitador de coluna quebraria a
 * importacao. O BOM (marca de ordem de bytes) UTF-8 no inicio do arquivo
 * evita que o Excel abra acentos e caracteres como `Ç`/`Ã` corrompidos
 * (sem esse marcador explicito, o Excel assume ISO-8859-1 por padrao).
 */
function gerarCsv(lancamentos) {
  const cabecalho = ['Descrição', 'Tipo', 'Valor', 'Data', 'Status'];
  const linhas = lancamentos.map((item) => [
    item.descricao,
    item.tipo === 'ENTRADA' ? 'Entrada' : 'Saída',
    Number(item.valor).toFixed(2).replace('.', ','),
    formatarData(item.dataVencimento),
    estaAtrasado(item) ? 'Vencido' : item.status === 'PAGO' ? rotuloStatusConcluido(item) : 'Pendente',
  ]);

  return [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(';')).join('\r\n');
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

/**
 * Rotulo do status "concluido" (pedido explicito): uma Entrada paga e
 * dinheiro que efetivamente ENTROU no caixa - "Recebido" descreve isso
 * melhor que "Pago" (que soa como algo que VOCE pagou, o oposto). Uma
 * Saida paga continua "Pago" (a leitura antiga, correta pra despesa).
 * So se aplica a lancamentos JA `PAGO` - "Pendente"/"Vencido" nao mudam
 * com o tipo.
 */
function rotuloStatusConcluido(lancamento) {
  return lancamento.tipo === 'ENTRADA' ? 'Recebido' : 'Pago';
}

/**
 * Filtro por Categoria: `Lancamento.categoria` agora e uma coluna real
 * (adicionada nesta tarefa, ver schema.prisma) - ate aqui era so uma
 * heuristica de palavras-chave batida contra `descricao` (documentada
 * assim numa tarefa anterior, por falta do campo). Chaves precisam bater
 * com CATEGORIAS_VALIDAS em api/src/services/lancamentos.service.js e com
 * a mesma lista em ModalLancamento.jsx (onde o usuario escolhe a categoria
 * no cadastro, em vez de o sistema adivinhar depois).
 */
const CATEGORIAS = [
  { valor: 'vendas', rotulo: 'Vendas' },
  { valor: 'fornecedores', rotulo: 'Fornecedores/Compras' },
  { valor: 'aluguel', rotulo: 'Aluguel' },
  { valor: 'salarios', rotulo: 'Salários' },
  { valor: 'impostos', rotulo: 'Impostos e Taxas' },
  { valor: 'contas_servicos', rotulo: 'Contas e Serviços' },
  { valor: 'outros', rotulo: 'Outros' },
];

const STATUS_OPCOES = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'PAGO', rotulo: 'Pago' },
  { valor: 'PENDENTE', rotulo: 'Pendente' },
  { valor: 'VENCIDO', rotulo: 'Vencido' },
];

const classesFiltro =
  'mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400';

function CampoFiltro({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

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
function TogglePago({ pago, rotuloPago, atualizando, onToggle }) {
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
        {atualizando ? 'Salvando...' : pago ? rotuloPago : 'Pendente'}
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

  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [lancamentoEmEdicao, setLancamentoEmEdicao] = useState(null);
  const [idAtualizando, setIdAtualizando] = useState(null);
  const [erroAtualizacao, setErroAtualizacao] = useState('');

  const { mostrarToast } = useToast();

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

    const inicio = dataInicial ? dataCalendario(dataInicial) : null;
    const fim = dataFinal ? dataCalendario(dataFinal) : null;

    return lancamentos.filter((item) => {
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;

      if (filtroStatus === 'PAGO' && item.status !== 'PAGO') return false;
      if (filtroStatus === 'PENDENTE' && (item.status !== 'PENDENTE' || estaAtrasado(item))) return false;
      if (filtroStatus === 'VENCIDO' && !estaAtrasado(item)) return false;

      if (filtroCategoria !== 'todas' && item.categoria !== filtroCategoria) return false;

      const vencimento = dataCalendario(item.dataVencimento);
      if (inicio && vencimento < inicio) return false;
      if (fim && vencimento > fim) return false;

      return true;
    });
  }, [lancamentos, filtroTipo, filtroStatus, filtroCategoria, dataInicial, dataFinal]);

  const nenhumFiltroAtivo =
    filtroTipo === 'todos' && filtroStatus === 'todos' && filtroCategoria === 'todas' && !dataInicial && !dataFinal;

  function handleExportar() {
    if (lancamentosFiltrados.length === 0) {
      mostrarToast('Não há dados para exportar no período selecionado.', 'aviso');
      return;
    }

    const blob = new Blob([`﻿${gerarCsv(lancamentosFiltrados)}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `lancamentos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    mostrarToast(`${lancamentosFiltrados.length} lançamento(s) exportado(s) com sucesso.`, 'sucesso');
  }

  function abrirModalNovo() {
    setLancamentoEmEdicao(null);
    setModalAberto(true);
  }

  function abrirModalEdicao(lancamento) {
    setLancamentoEmEdicao(lancamento);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setLancamentoEmEdicao(null);
  }

  /**
   * Create vs Update decidido aqui (pedido explicito) a partir de
   * `lancamentoEmEdicao`: presente = PUT (edicao), ausente = POST
   * (criacao) - o modal em si (`ModalLancamento.jsx`) so monta o payload e
   * devolve, nao sabe nada sobre verbos HTTP.
   */
  async function salvarLancamento(payload) {
    if (lancamentoEmEdicao) {
      const atualizado = await apiFetch(`/lancamentos/${lancamentoEmEdicao.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setLancamentos((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
    } else {
      const criado = await apiFetch('/lancamentos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setLancamentos((atual) => [...(atual || []), criado]);
    }
    fecharModal();
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
          onClick={abrirModalNovo}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          <Plus size={22} aria-hidden="true" />
          Novo Lançamento
        </button>
      </div>

      {/* Barra de ferramentas: filtros avancados + exportacao. Substitui os
          antigos botoes-pilula (Todos/A Pagar/A Receber/Atrasados) - esses 4
          casos continuam expressaveis aqui (Tipo=Saida, Tipo=Entrada,
          Status=Vencido), so que combinaveis entre si em vez de mutuamente
          exclusivos, alem dos 2 filtros novos (Categoria, Periodo). */}
      <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <CampoFiltro label="Tipo">
            <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)} className={classesFiltro}>
              <option value="todos">Todos</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </select>
          </CampoFiltro>

          <CampoFiltro label="Status">
            <select
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value)}
              className={classesFiltro}
            >
              {STATUS_OPCOES.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro label="Categoria">
            <select
              value={filtroCategoria}
              onChange={(event) => setFiltroCategoria(event.target.value)}
              className={classesFiltro}
            >
              <option value="todas">Todas</option>
              {CATEGORIAS.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro label="Data Inicial">
            <CampoData
              variant="compacta"
              value={dataInicial}
              onChange={setDataInicial}
              max={dataFinal || undefined}
            />
          </CampoFiltro>

          <CampoFiltro label="Data Final">
            <CampoData
              variant="compacta"
              value={dataFinal}
              onChange={setDataFinal}
              min={dataInicial || undefined}
            />
          </CampoFiltro>
        </div>

        <div className="flex items-center justify-end border-t border-slate-100 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={handleExportar}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-5 py-2.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Download size={18} className="shrink-0" aria-hidden="true" />
            Exportar
          </button>
        </div>
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
                  Data / Venc.
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {carregando && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-lg text-slate-500 dark:text-slate-400">
                    Carregando lançamentos...
                  </td>
                </tr>
              )}

              {!carregando && lancamentosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum lançamento encontrado.
                    </p>
                    <p className="mt-1 text-base text-slate-400 dark:text-slate-500">
                      {nenhumFiltroAtivo
                        ? 'Clique em "Novo Lançamento" para começar.'
                        : 'Tente ajustar os filtros ou cadastre um novo lançamento.'}
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
                          rotuloPago={rotuloStatusConcluido(lancamento)}
                          atualizando={idAtualizando === lancamento.id}
                          onToggle={() => alternarStatus(lancamento)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => abrirModalEdicao(lancamento)}
                          aria-label={`Editar ${lancamento.descricao}`}
                          title="Editar lançamento"
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                        >
                          <Pencil size={18} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <ModalLancamento lancamento={lancamentoEmEdicao} onFechar={fecharModal} onSalvar={salvarLancamento} />
      )}
    </div>
  );
}
