import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Receipt,
  PackagePlus,
  UserPlus,
  DollarSign,
  ShoppingBag,
  PackageX,
  CalendarClock,
  PartyPopper,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { dataCalendario } from '../utils/datas';
import { useAuth } from '../context/AuthContext';

function capitalizarPrimeiraLetra(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const HOJE_FORMATADO = capitalizarPrimeiraLetra(
  new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
);

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Igual a `diferencaEmDias` de ControleFinanceiro.jsx - hoje = 0, negativo = atrasado. */
function diferencaEmDias(dataVencimento, hoje) {
  const diffMs = dataCalendario(dataVencimento) - hoje;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function rotuloVencimento(dias) {
  if (dias < 0) return `Atrasado há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  return `Vence em ${dias} dias`;
}

const ATALHOS = [
  { label: 'Nova Venda', to: '/vendas', icon: ShoppingCart, cor: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' },
  {
    label: 'Novo Lançamento',
    to: '/lancamentos',
    icon: Receipt,
    cor: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30',
  },
  {
    label: 'Adicionar Produto',
    to: '/produtos',
    icon: PackagePlus,
    cor: 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30',
  },
  {
    label: 'Novo Cliente',
    to: '/clientes',
    icon: UserPlus,
    cor: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30',
  },
];

/** "Zero alerts" bonito - icone + texto centralizado, reaproveitado nos 2 paineis (estoque/financeiro). */
function EstadoVazio({ texto }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
        <PartyPopper size={28} aria-hidden="true" />
      </span>
      <p className="text-base font-semibold text-slate-500 dark:text-slate-400">{texto}</p>
    </div>
  );
}

/**
 * Centro de comando do SAE: atalhos rapidos, resumo do dia e 2 paineis de
 * alerta (estoque baixo / proximos pagamentos), tudo consumindo
 * `GET /dashboard` (rota real criada na tarefa anterior - `vendasHoje`,
 * `estoqueBaixo`, `contasPendentes`).
 *
 * A antiga `CalculadoraPrecificacao` (que morava embutida aqui, sem rota
 * propria) foi movida pra `/precificacao` (nova entrada na Sidebar) - o
 * pedido desta tarefa redesenhou o Dashboard inteiro sem mencionar a
 * calculadora, e deixa-la aqui nao caberia mais no layout de "centro de
 * comando" pedido; mas remove-la sem lhe dar uma rota propria deixaria
 * essa funcionalidade (que ja fala com o backend de verdade) inacessivel
 * pra sempre - por isso a mudanca de rota, nao so a remocao.
 */
export default function Dashboard() {
  const { usuario } = useAuth();
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch('/dashboard')
      .then((dados) => {
        if (ativo) setResumo(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar o resumo do dia.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  // "Hoje" e o momento atual do navegador (nao um valor vindo do backend),
  // entao NAO passa por `dataCalendario` (que so desfaz o deslocamento de
  // campos gravados como meia-noite UTC - ver web/src/utils/datas.js) -
  // aqui e so meia-noite local mesmo, igual ControleFinanceiro.jsx faz.
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
          {usuario?.nome ? `Olá, ${usuario.nome}! Aqui está o resumo de hoje` : 'Olá! Aqui está o resumo de hoje'}
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">{HOJE_FORMATADO}</p>
      </div>

      {/* Atalhos rapidos */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ATALHOS.map(({ label, to, icon: Icon, cor }) => (
          <Link
            key={label}
            to={to}
            className={`flex flex-col items-center justify-center gap-2 rounded-3xl px-4 py-6 text-center text-white shadow-lg transition-colors ${cor}`}
          >
            <Icon size={28} aria-hidden="true" />
            <span className="text-base font-bold sm:text-lg">{label}</span>
          </Link>
        ))}
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="py-6 text-center text-lg text-slate-500 dark:text-slate-400">Carregando resumo do dia...</p>
      )}

      {!carregando && resumo && (
        <>
          {/* Resumo do dia */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-xl dark:border-slate-800">
              <div className="flex items-center gap-3 text-blue-100">
                <DollarSign size={26} aria-hidden="true" />
                <span className="text-lg font-semibold">Total Faturado Hoje</span>
              </div>
              <p className="mt-3 text-4xl font-extrabold sm:text-5xl">{formatarMoeda(resumo.vendasHoje.total)}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-500 to-teal-700 p-8 text-white shadow-xl dark:border-slate-800">
              <div className="flex items-center gap-3 text-emerald-100">
                <ShoppingBag size={26} aria-hidden="true" />
                <span className="text-lg font-semibold">Vendas Hoje</span>
              </div>
              <p className="mt-3 text-4xl font-extrabold sm:text-5xl">{resumo.vendasHoje.quantidade}</p>
            </div>
          </div>

          {/* Paineis de alerta */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Coluna esquerda: Estoque */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                  <PackageX size={24} aria-hidden="true" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Estoque Baixo</h2>
                </div>
                <Link
                  to="/estoque"
                  className="shrink-0 text-sm font-semibold text-blue-600 transition-colors hover:underline dark:text-blue-400"
                >
                  Gerenciar Estoque
                </Link>
              </div>

              {resumo.estoqueBaixo.length === 0 ? (
                <EstadoVazio texto="Nenhum produto com estoque baixo agora." />
              ) : (
                <ul className="mt-4 space-y-3">
                  {resumo.estoqueBaixo.map((produto) => (
                    <li
                      key={produto.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 p-3 dark:bg-red-900/20"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                          {produto.nome}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          mínimo: {produto.estoqueMinimo} un.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        {produto.estoqueAtual} un.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Coluna direita: Financeiro */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-800">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <CalendarClock size={24} aria-hidden="true" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Próximos Pagamentos</h2>
              </div>

              {resumo.contasPendentes.length === 0 ? (
                <EstadoVazio texto="Nenhuma conta a pagar nos próximos 7 dias." />
              ) : (
                <ul className="mt-4 space-y-3">
                  {resumo.contasPendentes.map((conta) => {
                    const dias = diferencaEmDias(conta.dataVencimento, hoje);
                    const atrasado = dias < 0;
                    return (
                      <li
                        key={conta.id}
                        className={`flex items-center justify-between gap-3 rounded-2xl p-3 ${
                          atrasado
                            ? 'bg-red-50 ring-1 ring-red-300 dark:bg-red-900/30 dark:ring-red-800'
                            : 'bg-slate-50 dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                            {conta.descricao}
                          </p>
                          <p
                            className={`text-sm ${
                              atrasado
                                ? 'font-bold text-red-600 dark:text-red-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {rotuloVencimento(dias)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-lg font-bold ${
                            atrasado ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {formatarMoeda(conta.valor)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
