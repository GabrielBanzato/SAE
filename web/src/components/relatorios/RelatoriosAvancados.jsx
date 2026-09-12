import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarMoedaCompacta(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });
}

function capitalizarPrimeiraLetra(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Tooltip customizado do grafico - precisa de componente proprio pra formatar em R$ e respeitar o tema atual. */
function TooltipGrafico({ active, payload, label, escuro }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-lg ${
        escuro ? 'bg-slate-800 text-slate-100 ring-1 ring-slate-700' : 'bg-white text-slate-900 ring-1 ring-slate-200'
      }`}
    >
      <p className="text-xs font-medium opacity-70">Dia {label}</p>
      <p>{formatarMoeda(payload[0].value)}</p>
    </div>
  );
}

/**
 * Relatorios do plano Apoiador: DRE (Demonstrativo do Resultado do
 * Exercicio) + grafico de vendas por dia, consumindo `GET /relatorios/dre`
 * (rota premium, 403 se a empresa nao for 'apoiador' - so chega ate aqui
 * porque Relatorios.jsx ja filtrou por `empresa.plano` antes de renderizar
 * este componente).
 *
 * O filtro de periodo (3/6 meses) da versao mockada anterior foi removido -
 * a rota so devolve o mes atual, entao um seletor de periodo que nao muda
 * nada seria enganoso. Se um dia existir um endpoint historico por mes, o
 * seletor volta a fazer sentido.
 */
export default function RelatoriosAvancados() {
  const { theme } = useTheme();
  const escuro = theme === 'dark';

  const [dre, setDre] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch('/relatorios/dre')
      .then((dados) => {
        if (ativo) setDre(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar o DRE.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) {
    return <p className="text-lg text-slate-500 dark:text-slate-400">Carregando relatório avançado...</p>;
  }

  if (erro) {
    return (
      <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
        {erro}
      </p>
    );
  }

  const { receitaBruta, custos, lucroLiquido, vendasPorDia } = dre;
  const margemPercentual = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;
  const nomeDoMes = capitalizarPrimeiraLetra(
    new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  );

  const corGrade = escuro ? '#334155' : '#e2e8f0';
  const corEixo = escuro ? '#94a3b8' : '#64748b';
  const corBarra = escuro ? '#3b82f6' : '#2563eb';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-3xl border-l-8 border-emerald-500 bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
            <TrendingUp size={22} aria-hidden="true" />
            <span className="text-base font-semibold">Receita bruta</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatarMoeda(receitaBruta)}
          </p>
        </div>

        <div className="rounded-3xl border-l-8 border-rose-500 bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400">
            <TrendingDown size={22} aria-hidden="true" />
            <span className="text-base font-semibold">Custos</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100">{formatarMoeda(custos)}</p>
        </div>

        <div className="rounded-3xl border-l-8 border-blue-500 bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3 text-blue-700 dark:text-blue-400">
            <Wallet size={22} aria-hidden="true" />
            <span className="text-base font-semibold">Lucro líquido</span>
          </div>
          <p
            className={`mt-3 text-2xl font-extrabold ${
              lucroLiquido >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatarMoeda(lucroLiquido)}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{margemPercentual.toFixed(1)}% de margem</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
          <BarChart3 size={22} aria-hidden="true" />
          <h2 className="text-lg font-bold">Vendas por dia</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{nomeDoMes}</p>

        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vendasPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={corGrade} vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fill: corEixo, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: corGrade }}
                interval={Math.max(0, Math.floor(vendasPorDia.length / 10) - 1)}
              />
              <YAxis
                tick={{ fill: corEixo, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatarMoedaCompacta}
                width={56}
              />
              <Tooltip cursor={{ fill: escuro ? '#1e293b' : '#f1f5f9' }} content={<TooltipGrafico escuro={escuro} />} />
              <Bar dataKey="total" fill={corBarra} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">DRE simplificado</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{nomeDoMes}</p>

        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
          <div className="flex items-center justify-between py-3">
            <span className="text-base text-slate-600 dark:text-slate-300">Receita bruta</span>
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {formatarMoeda(receitaBruta)}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-base text-slate-600 dark:text-slate-300">Custos</span>
            <span className="text-base font-semibold text-rose-600 dark:text-rose-400">
              - {formatarMoeda(custos)}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 text-lg font-extrabold text-slate-900 dark:text-slate-100">
            <span>Lucro líquido</span>
            <span>{formatarMoeda(lucroLiquido)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
