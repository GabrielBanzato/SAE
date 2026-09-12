import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Receipt, Wallet, Sparkles } from 'lucide-react';
import { apiFetch } from '../../services/api';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Relatorios do plano Gratuito: so os totais do mes (sem filtros, graficos
 * ou DRE - reservados pro RelatoriosAvancados/plano Apoiador), consumindo
 * `GET /relatorios/resumo` (rota sem gate de plano, criada na tarefa
 * anterior). "Ticket medio" e calculado aqui no frontend
 * (total / quantidade, com guarda contra divisao por zero) - o backend so
 * devolve os 2 numeros brutos.
 */
export default function RelatoriosSimples() {
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch('/relatorios/resumo')
      .then((dados) => {
        if (ativo) setResumo(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar o resumo.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) {
    return <p className="text-lg text-slate-500 dark:text-slate-400">Carregando resumo...</p>;
  }

  if (erro) {
    return (
      <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
        {erro}
      </p>
    );
  }

  const ticketMedio = resumo.quantidadePedidos > 0 ? resumo.totalVendasMes / resumo.quantidadePedidos : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
            <TrendingUp size={24} aria-hidden="true" />
            <span className="text-base font-semibold">Total vendido no mês</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatarMoeda(resumo.totalVendasMes)}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3 text-blue-700 dark:text-blue-400">
            <Receipt size={24} aria-hidden="true" />
            <span className="text-base font-semibold">Pedidos realizados</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {resumo.quantidadePedidos}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center gap-3 text-purple-700 dark:text-purple-400">
            <Wallet size={24} aria-hidden="true" />
            <span className="text-base font-semibold">Ticket médio</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatarMoeda(ticketMedio)}
          </p>
        </div>
      </div>

      {/*
        Banner premium: gradiente escuro FIXO (nao segue o `dark:` do resto
        do app) de proposito - o pedido queria "aquele toque premium do
        Dark Mode" como identidade visual da propria peca publicitaria, nao
        como resposta ao tema atual da tela (que pode estar claro). Mesmo
        truque de blur decorativo ja usado em AuthLayout.jsx.
      */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-8 shadow-xl sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
              <Sparkles size={26} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Desbloqueie o DRE e Gráficos Avançados</h2>
              <p className="mt-2 max-w-xl text-lg text-blue-100">
                Tornando-se um <strong className="text-white">Apoiador</strong> do projeto, você ganha acesso ao
                Demonstrativo do Resultado do Exercício, gráfico de vendas por dia e muito mais.
              </p>
            </div>
          </div>

          <Link
            to="/configuracoes?aba=assinatura"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-amber-400/20 transition-colors hover:bg-amber-300 sm:w-auto"
          >
            <Sparkles size={20} aria-hidden="true" />
            Quero Apoiar
          </Link>
        </div>
      </div>
    </div>
  );
}
