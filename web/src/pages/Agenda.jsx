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
} from 'lucide-react';
import { apiFetch } from '../services/api';

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
  const [mostrarAvisoNovoEvento, setMostrarAvisoNovoEvento] = useState(false);

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
    setMostrarAvisoNovoEvento(false);
  }

  function irParaProximoMes() {
    const novoMes = new Date(ano, mesIndice + 1, 1);
    setMesExibido(novoMes);
    setDiaSelecionado(1);
    setMostrarAvisoNovoEvento(false);
  }

  function irParaHoje() {
    setMesExibido(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    setDiaSelecionado(hoje.getDate());
    setMostrarAvisoNovoEvento(false);
  }

  function selecionarDia(dia) {
    setDiaSelecionado(dia);
    setMostrarAvisoNovoEvento(false);
  }

  const dataSelecionadaFormatada = capitalizar(
    new Date(ano, mesIndice, diaSelecionado).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  );
  const eventosDoDia = eventosPorDia[diaSelecionado] || [];

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
              const coresPresentes = [...new Set(eventosDesteDia.map((evento) => CONFIG_TIPO[evento.tipo]?.cor))];
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
            onClick={() => setMostrarAvisoNovoEvento(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus size={20} aria-hidden="true" />
            Novo Evento/Lembrete
          </button>

          {mostrarAvisoNovoEvento && (
            <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Em breve você poderá criar eventos e lembretes por aqui.
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
                const Icon = config.icon;

                return (
                  <div
                    key={evento.id}
                    className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${CLASSES_ICONE[config.cor]}`}
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
                      <CheckCircle2
                        size={22}
                        className="mt-1 shrink-0 text-emerald-500"
                        aria-label="Concluído"
                      />
                    ) : (
                      <Circle size={22} className="mt-1 shrink-0 text-slate-300 dark:text-slate-600" aria-label="Pendente" />
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
