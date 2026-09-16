import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Wallet,
  Receipt,
  Bell,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import ModalLembrete from '../components/agenda/ModalLembrete';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Mapeamento de cor pedido: Verde = Recebimentos/Vendas, Vermelho =
// Pagamentos/Contas, Azul = Lembretes/Tarefas. Reaproveitado tanto nas
// bolinhas do calendario quanto nos icones da lista de eventos, pra manter
// a mesma linguagem visual na tela inteira.
const CONFIG_TIPO = {
  venda: { cor: 'verde', icon: ShoppingCart, rotulo: 'Venda' },
  recebimento: { cor: 'verde', icon: Wallet, rotulo: 'Recebimento' },
  pagamento: { cor: 'vermelho', icon: Receipt, rotulo: 'Pagamento' },
  lembrete: { cor: 'azul', icon: Bell, rotulo: 'Lembrete' },
};

const CLASSES_BOLINHA = {
  verde: 'bg-emerald-500',
  vermelho: 'bg-rose-500',
  azul: 'bg-blue-500',
};

const CLASSES_ICONE = {
  verde: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  vermelho: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  azul: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
};

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Extrai o dia (1-31) direto da string ISO ("2026-09-07T12:00:00.000Z"),
// sem passar por `new Date(...).getDate()` - isso evitaria depender do
// fuso horario do navegador (uma instancia UTC perto do meio-dia pode virar
// o dia anterior/seguinte em fusos muito distantes do servidor). Como a API
// ja garante que todo evento cai dentro do mes pedido, extrair o dia da
// propria string e mais simples e 100% seguro.
function extrairDia(dataIsoVencimento) {
  return Number(dataIsoVencimento.slice(8, 10));
}

/**
 * Origem do evento a partir do prefixo do `id` (ver agenda.service.js no
 * backend: "lancamento-{id}"/"tarefa-{id}") - decide pra qual API mandar o
 * "Dar baixa": Lancamento tem PUT /lancamentos/:id de verdade, Tarefa ainda
 * nao tem nenhuma rota de escrita (so e lida agregada no GET /agenda),
 * entao esses eventos (e os lembretes criados localmente, ver
 * ModalLembrete.jsx) so atualizam o estado em memoria por enquanto.
 */
function ehEventoDeLancamento(evento) {
  return evento.id.startsWith('lancamento-');
}

function idNumericoDoLancamento(evento) {
  return Number(evento.id.slice('lancamento-'.length));
}

function gerarGradeDoMes(ano, mesIndice) {
  const primeiroDiaSemana = new Date(ano, mesIndice, 1).getDay();
  const totalDias = new Date(ano, mesIndice + 1, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= totalDias; dia++) celulas.push(dia);
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}

/**
 * Agenda: calendario mensal (grade de 7 dias) + lista de eventos do dia
 * selecionado, consumindo GET /agenda/:mes_ano - Lancamentos (contas a
 * pagar/receber, incluindo as geradas automaticamente por vendas do PDV)
 * e Tarefas (lembretes manuais) reais, unificados pelo backend em
 * agenda.service.js. Sem biblioteca de datas: toda a manipulacao
 * necessaria aqui (navegar mes, formatar "7 de Setembro", montar a grade)
 * e trivial com `Date` nativo - date-fns nao traria ganho real pra esse
 * escopo, entao nao foi instalada.
 */
export default function Agenda() {
  const hoje = useMemo(() => new Date(), []);
  const [mesExibido, setMesExibido] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSelecionado, setDiaSelecionado] = useState(hoje.getDate());

  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalLembreteAberto, setModalLembreteAberto] = useState(false);
  const [idBaixaEmAndamento, setIdBaixaEmAndamento] = useState(null);
  const [erroBaixa, setErroBaixa] = useState('');

  const ano = mesExibido.getFullYear();
  const mesIndice = mesExibido.getMonth(); // 0-11
  const mesAno = `${String(mesIndice + 1).padStart(2, '0')}-${ano}`;

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch(`/agenda/${mesAno}`)
      .then((dados) => {
        if (ativo) setEventos(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar a agenda.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [mesAno]);

  const eventosPorDia = useMemo(() => {
    const mapa = {};
    for (const evento of eventos) {
      const dia = extrairDia(evento.dataVencimento);
      (mapa[dia] ||= []).push(evento);
    }
    return mapa;
  }, [eventos]);

  const grade = useMemo(() => gerarGradeDoMes(ano, mesIndice), [ano, mesIndice]);

  const ehHoje = (dia) => dia === hoje.getDate() && mesIndice === hoje.getMonth() && ano === hoje.getFullYear();

  function irParaMesAnterior() {
    const novoMes = new Date(ano, mesIndice - 1, 1);
    setMesExibido(novoMes);
    setDiaSelecionado(1);
  }

  function irParaProximoMes() {
    const novoMes = new Date(ano, mesIndice + 1, 1);
    setMesExibido(novoMes);
    setDiaSelecionado(1);
  }

  function irParaHoje() {
    setMesExibido(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    setDiaSelecionado(hoje.getDate());
  }

  function selecionarDia(dia) {
    setDiaSelecionado(dia);
  }

  const dataSelecionadaFormatada = capitalizar(
    new Date(ano, mesIndice, diaSelecionado).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  );
  const eventosDoDia = eventosPorDia[diaSelecionado] || [];

  // Data do dia selecionado no formato "YYYY-MM-DD" (pro <input type="date">
  // do ModalLembrete vir pre-preenchido com o dia que o usuario ja estava
  // olhando na Agenda).
  const dataSelecionadaIso = `${ano}-${String(mesIndice + 1).padStart(2, '0')}-${String(diaSelecionado).padStart(2, '0')}`;

  /**
   * "Dar baixa": eventos vindos de Lancamento chamam o PUT real (mesma rota
   * que Lancamentos.jsx usa). Eventos de Tarefa/lembrete local so mudam o
   * estado em memoria - nao existe rota de escrita pra Tarefa no backend
   * ainda (ver comentario de `ehEventoDeLancamento` acima).
   */
  async function darBaixa(evento) {
    if (evento.statusConcluida) return;

    setErroBaixa('');
    setIdBaixaEmAndamento(evento.id);

    if (!ehEventoDeLancamento(evento)) {
      setEventos((atual) => atual.map((item) => (item.id === evento.id ? { ...item, statusConcluida: true } : item)));
      setIdBaixaEmAndamento(null);
      return;
    }

    try {
      await apiFetch(`/lancamentos/${idNumericoDoLancamento(evento)}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAGO', data_pagamento: new Date().toISOString().slice(0, 10) }),
      });
      setEventos((atual) => atual.map((item) => (item.id === evento.id ? { ...item, statusConcluida: true } : item)));
    } catch (err) {
      setErroBaixa(err.message || 'Não foi possível dar baixa neste lançamento.');
    } finally {
      setIdBaixaEmAndamento(null);
    }
  }

  /**
   * Sem POST /tarefas no backend ainda - o lembrete criado aqui existe so
   * no estado local desta pagina (`eventos`). Aparece no calendario/lista
   * na hora, mas nao sobrevive a um recarregamento de pagina nem aparece
   * pra outros usuarios da mesma empresa. `cor` (escolhida no modal) fica
   * junto do evento pra sobrescrever a cor padrao de "lembrete" (azul) nos
   * lugares que leem `evento.cor ?? CONFIG_TIPO[evento.tipo].cor`.
   */
  function criarLembrete({ titulo, descricao, data, cor }) {
    const novoEvento = {
      id: `local-${Date.now()}`,
      titulo,
      descricao,
      dataVencimento: `${data}T12:00:00.000Z`,
      tipo: 'lembrete',
      cor,
      statusConcluida: false,
      valor: null,
    };

    setEventos((atual) => [...atual, novoEvento]);
    setModalLembreteAberto(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <CalendarDays size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Agenda
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Vendas, lançamentos e contas a pagar num só calendário.
        </p>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Secao 1: calendario panoramico */}
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {capitalizar(mesExibido.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={irParaHoje}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={irParaMesAnterior}
                aria-label="Mês anterior"
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={irParaProximoMes}
                aria-label="Próximo mês"
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-sm font-semibold text-slate-500 dark:text-slate-400 sm:gap-2">
            {DIAS_SEMANA.map((dia) => (
              <div key={dia} className="py-2">
                {dia}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {grade.map((dia, indice) => {
              if (dia === null) return <div key={indice} className="min-h-[64px] sm:min-h-[84px]" />;

              const eventosDesteDia = eventosPorDia[dia] || [];
              const coresPresentes = [
                ...new Set(eventosDesteDia.map((evento) => evento.cor ?? CONFIG_TIPO[evento.tipo]?.cor)),
              ];
              const selecionado = dia === diaSelecionado;

              return (
                <button
                  key={indice}
                  type="button"
                  onClick={() => selecionarDia(dia)}
                  aria-current={selecionado ? 'date' : undefined}
                  className={`flex min-h-[64px] flex-col items-center justify-between gap-1 rounded-2xl p-2 text-left transition-colors sm:min-h-[84px] sm:items-start ${
                    selecionado
                      ? 'bg-blue-600 text-white'
                      : ehHoje(dia)
                        ? 'bg-white ring-2 ring-blue-500 dark:bg-slate-800'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <span
                    className={`text-sm font-bold sm:text-base ${
                      selecionado ? 'text-white' : ehHoje(dia) ? 'text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    {dia}
                  </span>
                  <div className="flex gap-1">
                    {coresPresentes.map((cor) => (
                      <span key={cor} className={`h-2 w-2 rounded-full ${CLASSES_BOLINHA[cor]}`} aria-hidden="true" />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Recebimentos e vendas
            </span>
            <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" />
              Pagamentos e contas
            </span>
            <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
              Lembretes e tarefas
            </span>
          </div>
        </div>

        {/* Secao 2: lista de eventos do dia selecionado */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Eventos de
              </p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{dataSelecionadaFormatada}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalLembreteAberto(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus size={20} aria-hidden="true" />
            Novo Evento/Lembrete
          </button>

          {erroBaixa && (
            <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {erroBaixa}
            </p>
          )}

          <div className="mt-6 space-y-3">
            {carregando && <p className="text-base text-slate-500 dark:text-slate-400">Carregando...</p>}

            {!carregando && eventosDoDia.length === 0 && (
              <p className="text-base text-slate-500 dark:text-slate-400">Nenhum evento neste dia.</p>
            )}

            {!carregando &&
              eventosDoDia.map((evento) => {
                const config = CONFIG_TIPO[evento.tipo] ?? CONFIG_TIPO.lembrete;
                const cor = evento.cor ?? config.cor;
                const Icon = config.icon;
                const dandoBaixa = idBaixaEmAndamento === evento.id;

                return (
                  <div
                    key={evento.id}
                    className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${CLASSES_ICONE[cor]}`}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-base font-semibold text-slate-900 dark:text-slate-100 ${
                          evento.statusConcluida ? 'line-through opacity-60' : ''
                        }`}
                      >
                        {evento.titulo}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{config.rotulo}</p>
                      {evento.valor != null && (
                        <p className="mt-1 text-base font-bold text-slate-700 dark:text-slate-200">
                          {formatarMoeda(evento.valor)}
                        </p>
                      )}
                    </div>

                    {evento.statusConcluida ? (
                      <CheckCircle2 size={22} className="mt-1 shrink-0 text-emerald-500" aria-label="Concluído" />
                    ) : dandoBaixa ? (
                      <Loader2
                        size={22}
                        className="mt-1 shrink-0 animate-spin text-slate-400 dark:text-slate-500"
                        aria-label="Dando baixa..."
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => darBaixa(evento)}
                        title="Dar baixa (marcar como concluído)"
                        className="mt-1 shrink-0 text-slate-300 transition-colors hover:text-emerald-500 dark:text-slate-600 dark:hover:text-emerald-400"
                      >
                        <Circle size={22} aria-label="Pendente - clique para dar baixa" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {modalLembreteAberto && (
        <ModalLembrete
          dataInicial={dataSelecionadaIso}
          onFechar={() => setModalLembreteAberto(false)}
          onSalvar={criarLembrete}
        />
      )}
    </div>
  );
}
