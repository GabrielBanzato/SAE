import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileBarChart, Lock, Heart, Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function anosDisponiveis() {
  const anoAtual = new Date().getFullYear();
  // 2 anos pra tras + o atual - suficiente pra comparar o mes com o mesmo
  // periodo do ano anterior, sem oferecer uma lista enorme de anos vazios.
  return [anoAtual - 2, anoAtual - 1, anoAtual];
}

function CardFluxo({ icon: Icon, cor, titulo, valor }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className={`flex items-center gap-2 ${cor}`}>
        <Icon size={18} aria-hidden="true" />
        <span className="text-sm font-semibold">{titulo}</span>
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">{formatarMoeda(valor)}</p>
    </div>
  );
}

/**
 * Linha da "escadinha" do DRE - cada subtotal soma ou subtrai do anterior,
 * ate chegar no Lucro/Prejuízo Operacional (ultima linha, destacada e
 * colorida por sinal - ver `destaque` abaixo). `sinal` decide o prefixo
 * visual ("+"/"−"/"=") - meramente estetico, o valor em si ja vem com o
 * sinal certo calculado no backend (relatorios.service.js#gerarDRE).
 */
function LinhaDRE({ rotulo, valor, sinal, destaque = false }) {
  const negativo = valor < 0;

  if (destaque) {
    return (
      <div
        className={`mt-2 flex items-center justify-between rounded-2xl p-4 text-xl font-extrabold ${
          negativo
            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`}
      >
        <span>{rotulo}</span>
        <span>{formatarMoeda(valor)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2.5 text-base">
      <span className="text-slate-600 dark:text-slate-300">
        <span className="mr-2 inline-block w-4 text-slate-400 dark:text-slate-500">{sinal}</span>
        {rotulo}
      </span>
      <span className="font-semibold text-slate-800 dark:text-slate-100">{formatarMoeda(valor)}</span>
    </div>
  );
}

/**
 * DRE (Demonstrativo do Resultado do Exercicio) em "escadinha", com
 * seletor de Mês/Ano - diferente do painel resumido que já existia em
 * RelatoriosAvancados.jsx (so o mes atual, so o resultado final + gráfico
 * de vendas por dia). Consome `GET /relatorios/dre-mensal/:mes_ano`
 * (`gerarDRE`) e `GET /relatorios/fluxo-caixa/:mes_ano`
 * (`obterFluxoCaixa`), os 2 endpoints novos desta tarefa.
 *
 * Mesmo gate de plano já usado em Relatorios.jsx/UsuariosEquipe.jsx: DRE é
 * funcionalidade premium (mesma regra de negócio de `obterDre`, só que
 * validada aqui também no frontend pra não mostrar um formulário inteiro
 * pra depois estourar 403 - o backend segue sendo a fonte da verdade,
 * gerarDRE valida de novo independente do que esta tela decidir exibir).
 */
export default function DRE() {
  const { empresa } = useAuth();
  const ehApoiador = empresa?.plano === 'apoiador';

  const hoje = new Date();
  const [mesNumero, setMesNumero] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const [dre, setDre] = useState(null);
  const [fluxo, setFluxo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!ehApoiador) {
      setCarregando(false);
      return undefined;
    }

    let ativo = true;
    setCarregando(true);
    setErro('');

    const mesAno = `${String(mesNumero).padStart(2, '0')}-${ano}`;

    Promise.all([apiFetch(`/relatorios/dre-mensal/${mesAno}`), apiFetch(`/relatorios/fluxo-caixa/${mesAno}`)])
      .then(([dadosDre, dadosFluxo]) => {
        if (ativo) {
          setDre(dadosDre);
          setFluxo(dadosFluxo);
        }
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar o DRE deste período.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [ehApoiador, mesNumero, ano]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <FileBarChart size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          DRE — Fluxo de Caixa
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Demonstrativo do Resultado do Exercício, mês a mês.
        </p>
      </div>

      {!ehApoiador && (
        // Sem `aria-disabled` aqui de proposito: diferente de Notas.jsx
        // (nada clicavel, modulo inteiro indisponivel), este card TEM uma
        // acao real (o link "Vire Apoiador") - marcar o container como
        // aria-disabled tornaria esse link inalcancavel por teclado/leitor
        // de tela (Playwright, que respeita ARIA de verdade, confirmou
        // esse efeito durante o teste desta tarefa). Mesma inconsistencia
        // ja existia em UsuariosEquipe.jsx (fora do escopo desta tarefa
        // corrigir la tambem).
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <Lock size={32} aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">DRE é exclusivo para Apoiadores</h2>
          <p className="max-w-md text-lg text-slate-500 dark:text-slate-400">
            Recurso exclusivo para Apoiadores do sistema. Vire Apoiador para acompanhar o Demonstrativo do Resultado
            do Exercício mês a mês.
          </p>
          <Link
            to="/configuracoes?aba=assinatura"
            className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Heart size={20} aria-hidden="true" />
            Vire Apoiador
          </Link>
        </div>
      )}

      {ehApoiador && (
        <>
          {/* Seletor de Mes/Ano */}
          <div className="flex flex-wrap items-end gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <label className="block">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Mês</span>
              <select
                value={mesNumero}
                onChange={(event) => setMesNumero(Number(event.target.value))}
                className="mt-1 w-48 rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
              >
                {NOMES_MESES.map((nome, indice) => (
                  <option key={nome} value={indice + 1}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Ano</span>
              <select
                value={ano}
                onChange={(event) => setAno(Number(event.target.value))}
                className="mt-1 w-28 rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
              >
                {anosDisponiveis().map((anoOpcao) => (
                  <option key={anoOpcao} value={anoOpcao}>
                    {anoOpcao}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {carregando && <p className="py-6 text-center text-lg text-slate-500 dark:text-slate-400">Carregando...</p>}

          {!carregando && erro && (
            <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {erro}
            </p>
          )}

          {!carregando && !erro && fluxo && dre && (
            <>
              {/* Fluxo de Caixa */}
              <div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Wallet size={18} aria-hidden="true" />
                  <h2 className="text-base font-bold uppercase tracking-wide">Fluxo de Caixa</h2>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <CardFluxo icon={Wallet} cor="text-blue-700 dark:text-blue-400" titulo="Saldo Atual" valor={fluxo.saldoAtual} />
                  <CardFluxo
                    icon={ArrowUpCircle}
                    cor="text-emerald-700 dark:text-emerald-400"
                    titulo="A Receber (pendente no mês)"
                    valor={fluxo.totalAReceber}
                  />
                  <CardFluxo
                    icon={ArrowDownCircle}
                    cor="text-red-700 dark:text-red-400"
                    titulo="A Pagar (pendente no mês)"
                    valor={fluxo.totalAPagar}
                  />
                </div>
              </div>

              {/* DRE em escadinha */}
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  {dre.lucroOperacional >= 0 ? (
                    <TrendingUp size={18} aria-hidden="true" />
                  ) : (
                    <TrendingDown size={18} aria-hidden="true" />
                  )}
                  <h2 className="text-base font-bold uppercase tracking-wide">
                    DRE — {NOMES_MESES[mesNumero - 1]} de {ano}
                  </h2>
                </div>

                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
                  <LinhaDRE rotulo="Receita Bruta" valor={dre.receitaBruta} sinal="" />
                  <LinhaDRE rotulo="Deduções / Impostos" valor={-dre.deducoes} sinal="−" />
                  <LinhaDRE rotulo="Receita Líquida" valor={dre.receitaLiquida} sinal="=" />
                  <LinhaDRE rotulo="Custos Variáveis" valor={-dre.custosVariaveis} sinal="−" />
                  <LinhaDRE rotulo="Margem de Contribuição" valor={dre.margemContribuicao} sinal="=" />
                  <LinhaDRE rotulo="Custos Fixos" valor={-dre.custosFixos} sinal="−" />
                </div>

                <LinhaDRE
                  rotulo={dre.lucroOperacional >= 0 ? 'Lucro Operacional' : 'Prejuízo Operacional'}
                  valor={dre.lucroOperacional}
                  destaque
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
