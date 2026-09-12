import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Wallet } from 'lucide-react';
import { apiFetch } from '../services/api';
import { dataCalendario } from '../utils/datas';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function capitalizarPrimeiraLetra(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function inicioDoDia(data) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function mesmoMes(dataVencimento, referencia) {
  const data = dataCalendario(dataVencimento);
  return data.getMonth() === referencia.getMonth() && data.getFullYear() === referencia.getFullYear();
}

/** Diferenca em dias de calendario (hoje = 0) - os dois lados ja chegam ancorados na meia-noite local. */
function diferencaEmDias(dataVencimento, hoje) {
  const diffMs = dataCalendario(dataVencimento) - hoje;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function rotuloVencimento(diasRestantes) {
  if (diasRestantes === 0) return 'Vence hoje';
  if (diasRestantes === 1) return 'Vence amanhã';
  return `Vence em ${diasRestantes} dias`;
}

function BarraComparativa({ icon: Icon, rotulo, valor, corBarra, corTexto, largura }) {
  return (
    <div>
      <div className="flex items-center justify-between text-base font-semibold text-slate-700 dark:text-slate-200">
        <span className="flex items-center gap-2">
          <Icon size={18} aria-hidden="true" />
          {rotulo}
        </span>
        <span className={`font-bold ${corTexto}`}>{formatarMoeda(valor)}</span>
      </div>
      <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
        <div
          className={`h-full rounded-full transition-all duration-500 ${corBarra}`}
          style={{ width: `${largura}%` }}
        />
      </div>
    </div>
  );
}

function CardResumo({ icon: Icon, corBorda, corIcone, titulo, valor, corValor, legenda }) {
  return (
    <div
      className={`rounded-3xl border-l-8 bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 ${corBorda}`}
    >
      <div className={`flex items-center gap-3 ${corIcone}`}>
        <Icon size={28} aria-hidden="true" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{titulo}</h2>
      </div>
      <p className={`mt-4 text-3xl font-extrabold sm:text-4xl ${corValor}`}>{formatarMoeda(valor)}</p>
      <p className="mt-1 text-base text-slate-500 dark:text-slate-400">{legenda}</p>
    </div>
  );
}

/**
 * Central de inteligencia do caixa: consome GET /lancamentos (rota que ja
 * existe, CRUD completo criado nas tarefas anteriores) e faz todas as
 * somatorias aqui no frontend - o pedido deu a escolha entre isso e um
 * endpoint de totais prontos na API, e como a lista de lancamentos de uma
 * loja pequena e curta (sem paginacao em lugar nenhum do app ainda),
 * buscar tudo uma vez e agregar em memoria e mais simples que criar um
 * endpoint novo so pra isso - mesma decisao ja tomada pros filtros de
 * Lancamentos.jsx.
 */
export default function ControleFinanceiro() {
  const [lancamentos, setLancamentos] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

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

  const dados = useMemo(() => {
    const hoje = inicioDoDia(new Date());
    const lista = lancamentos || [];

    // Saldo Atual: soma de TUDO que ja foi efetivamente pago (nao so o mes
    // atual) - e o dinheiro que realmente entrou/saiu do caixa ate agora.
    const saldoAtual = lista.reduce((soma, item) => {
      if (item.status !== 'PAGO') return soma;
      const valor = Number(item.valor);
      return item.tipo === 'ENTRADA' ? soma + valor : soma - valor;
    }, 0);

    // A Receber / A Pagar: so pendencias com vencimento dentro do mes atual.
    const aReceberMes = lista
      .filter((item) => item.tipo === 'ENTRADA' && item.status === 'PENDENTE' && mesmoMes(item.dataVencimento, hoje))
      .reduce((soma, item) => soma + Number(item.valor), 0);

    const aPagarMes = lista
      .filter((item) => item.tipo === 'SAIDA' && item.status === 'PENDENTE' && mesmoMes(item.dataVencimento, hoje))
      .reduce((soma, item) => soma + Number(item.valor), 0);

    // Grafico "Receitas vs Despesas do mes": todo lancamento com vencimento
    // no mes atual, pago ou nao - da o panorama completo do mes (o que ja
    // entrou/saiu + o que ainda esta previsto), diferente dos cards acima
    // (que olham so pendencias).
    const receitasMes = lista
      .filter((item) => item.tipo === 'ENTRADA' && mesmoMes(item.dataVencimento, hoje))
      .reduce((soma, item) => soma + Number(item.valor), 0);

    const despesasMes = lista
      .filter((item) => item.tipo === 'SAIDA' && mesmoMes(item.dataVencimento, hoje))
      .reduce((soma, item) => soma + Number(item.valor), 0);

    // Proximos Vencimentos: so contas a pagar (Saida) pendentes, entre hoje
    // e daqui 7 dias (inclusive nos dois extremos), ordenadas pela mais urgente.
    const proximosVencimentos = lista
      .filter((item) => item.tipo === 'SAIDA' && item.status === 'PENDENTE')
      .map((item) => ({ ...item, diasRestantes: diferencaEmDias(item.dataVencimento, hoje) }))
      .filter((item) => item.diasRestantes >= 0 && item.diasRestantes <= 7)
      .sort((a, b) => a.diasRestantes - b.diasRestantes);

    return { saldoAtual, aReceberMes, aPagarMes, receitasMes, despesasMes, proximosVencimentos };
  }, [lancamentos]);

  const nomeDoMes = capitalizarPrimeiraLetra(
    new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  );
  const maiorValorMes = Math.max(dados.receitasMes, dados.despesasMes, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <Wallet size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Controle Financeiro
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Visão geral de contas a pagar, a receber e fluxo de caixa.
        </p>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="py-6 text-center text-lg text-slate-500 dark:text-slate-400">Carregando dados financeiros...</p>
      )}

      {!carregando && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <CardResumo
              icon={Wallet}
              corBorda={dados.saldoAtual >= 0 ? 'border-blue-500' : 'border-red-500'}
              corIcone="text-blue-700 dark:text-blue-400"
              titulo="Saldo Atual"
              valor={dados.saldoAtual}
              corValor={
                dados.saldoAtual >= 0 ? 'text-emerald-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }
              legenda="Entradas pagas menos saídas pagas"
            />
            <CardResumo
              icon={ArrowUpCircle}
              corBorda="border-emerald-500"
              corIcone="text-emerald-700 dark:text-emerald-400"
              titulo="A Receber"
              valor={dados.aReceberMes}
              corValor="text-emerald-600 dark:text-green-400"
              legenda={`Pendente em ${nomeDoMes}`}
            />
            <CardResumo
              icon={ArrowDownCircle}
              corBorda="border-red-500"
              corIcone="text-red-700 dark:text-red-400"
              titulo="A Pagar"
              valor={dados.aPagarMes}
              corValor="text-red-600 dark:text-red-400"
              legenda={`Pendente em ${nomeDoMes}`}
            />
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Receitas vs Despesas</h2>
            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">{nomeDoMes}</p>

            <div className="mt-6 space-y-5">
              <BarraComparativa
                icon={ArrowUpCircle}
                rotulo="Receitas"
                valor={dados.receitasMes}
                corBarra="bg-emerald-500 dark:bg-green-500"
                corTexto="text-emerald-600 dark:text-green-400"
                largura={(dados.receitasMes / maiorValorMes) * 100}
              />
              <BarraComparativa
                icon={ArrowDownCircle}
                rotulo="Despesas"
                valor={dados.despesasMes}
                corBarra="bg-red-500 dark:bg-red-500"
                corTexto="text-red-600 dark:text-red-400"
                largura={(dados.despesasMes / maiorValorMes) * 100}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <div className="flex items-center gap-3">
              <CalendarClock size={24} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Próximos Vencimentos</h2>
            </div>
            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">Contas a pagar nos próximos 7 dias.</p>

            {dados.proximosVencimentos.length === 0 ? (
              <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
                Nenhuma conta a pagar nos próximos 7 dias.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
                {dados.proximosVencimentos.map((lancamento) => (
                  <li key={lancamento.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {lancamento.descricao}
                      </p>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        {rotuloVencimento(lancamento.diasRestantes)}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-bold text-red-600 dark:text-red-400">
                      {formatarMoeda(lancamento.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
