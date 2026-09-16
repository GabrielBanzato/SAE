import { useState } from 'react';
import { Heart, CheckCircle2, Percent, Rocket, Headphones, Users } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/**
 * Lista de beneficios reformulada (pedido explicito: tirar qualquer mencao
 * a "Nota Fiscal" daqui - emissao fiscal continua existindo como um modulo
 * pago a parte, ver pages/Modulos.jsx, nao mais como beneficio incluido no
 * Apoiador). "Liberacao da Gestao de Equipe" e o motivo pelo qual
 * UsuariosEquipe.jsx agora bloqueia a aba "Equipe" pra quem nao e
 * Apoiador - os dois lados dessa mudanca (o beneficio aqui, o bloqueio la)
 * precisam ficar em sincronia se a regra mudar de novo.
 */
const RECURSOS_APOIADOR = [
  { icon: Percent, texto: 'Desconto de 15% em todos os Módulos Premium' },
  { icon: Rocket, texto: 'Acesso Antecipado a Novidades' },
  { icon: Headphones, texto: 'Prioridade no Suporte' },
  { icon: Users, texto: 'Liberação da Gestão de Equipe' },
];

const VALOR_MINIMO_CONTRIBUICAO = 10;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Aba de assinatura: explica o modelo "mensalidade caridosa" e permite
 * virar Apoiador. Ao contrario do botao de convite (visual, por enquanto),
 * este chama de verdade PUT /empresa/assinatura - a rota ja existe e faz
 * exatamente isso.
 *
 * O backend agora exige `valor_contribuicao` (minimo R$ 10,00) sempre que
 * `plano: 'apoiador'` e enviado - por isso o campo de valor aqui, que antes
 * nao existia (o botao so mandava `{ plano: 'apoiador' }` sem valor).
 */
export default function Assinatura({ empresa, onEmpresaAtualizada }) {
  const { refreshEmpresa } = useAuth();
  const [valorContribuicao, setValorContribuicao] = useState(String(VALOR_MINIMO_CONTRIBUICAO));
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  if (!empresa) {
    return null;
  }

  const ehApoiador = empresa.plano === 'apoiador';
  const valorNumero = Number(valorContribuicao);
  const valorValido = Number.isFinite(valorNumero) && valorNumero >= VALOR_MINIMO_CONTRIBUICAO;

  // "Trava" o minimo no blur: se o usuario digitar/apagar pra um valor
  // abaixo de R$10 e sair do campo, volta pro minimo em vez de deixar um
  // valor invalido parado ali ate o clique em "Quero Apoiar".
  function handleValorBlur() {
    if (!Number.isFinite(valorNumero) || valorNumero < VALOR_MINIMO_CONTRIBUICAO) {
      setValorContribuicao(String(VALOR_MINIMO_CONTRIBUICAO));
    }
  }

  async function handleApoiar() {
    if (!valorValido) {
      setErro(`Informe um valor de pelo menos ${formatarMoeda(VALOR_MINIMO_CONTRIBUICAO)}.`);
      return;
    }

    setAtualizando(true);
    setErro('');

    try {
      const atualizada = await apiFetch('/empresa/assinatura', {
        method: 'PUT',
        body: JSON.stringify({ plano: 'apoiador', valor_contribuicao: valorNumero }),
      });
      onEmpresaAtualizada((atual) => ({ ...atual, ...atualizada }));
      // Mantem a copia cacheada no AuthContext em sincronia - sem isso,
      // Relatorios.jsx (que le o plano de la, nao daqui) so veria a
      // mudanca apos um reload/novo login.
      refreshEmpresa();
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar sua assinatura agora.');
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <Heart size={28} aria-hidden="true" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Ajude a manter o sistema gratuito e ganhe vantagens exclusivas
          </h2>
        </div>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
          O SAE é e sempre será gratuito para quem está começando. Se o sistema já está ajudando o seu negócio a
          crescer e você pode contribuir, vire um Apoiador — isso mantém o sistema gratuito para outros pequenos
          empreendedores que estão dando os primeiros passos, como você um dia deu, e ainda desbloqueia vantagens
          exclusivas pra você.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Seu plano atual
          </span>
          <h3 className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {ehApoiador ? 'Plano Apoiador' : 'Plano Essencial'}
          </h3>
          <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
            {ehApoiador ? 'Obrigado por apoiar o projeto! 💙' : 'Gratuito e ativo — funções base'}
          </p>
          <ul className="mt-4 space-y-2 text-base text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Dashboard e resumo de vendas
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Calculadora de precificação
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Controle de estoque e alertas
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border-2 border-blue-500 bg-blue-50 p-6 dark:border-blue-500 dark:bg-blue-950/40">
          <span className="inline-block rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white">
            Plano Apoiador
          </span>
          <h3 className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100">Recursos avançados</h3>
          <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
            Valor flexível — você escolhe quanto contribuir. Tudo do Essencial, mais:
          </p>
          <ul className="mt-4 space-y-3 text-base text-slate-700 dark:text-slate-200">
            {RECURSOS_APOIADOR.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-center gap-2">
                <Icon size={18} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                {texto}
              </li>
            ))}
          </ul>

          {!ehApoiador && (
            <>
              <label className="mt-6 block">
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  Defina o valor da sua contribuição mensal
                </span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-blue-400">
                  <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">R$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={VALOR_MINIMO_CONTRIBUICAO}
                    step="0.01"
                    value={valorContribuicao}
                    onChange={(event) => setValorContribuicao(event.target.value)}
                    onBlur={handleValorBlur}
                    className="w-full bg-transparent text-xl font-semibold text-slate-900 outline-none dark:text-slate-100"
                  />
                </div>
                <span className="mt-1 block text-sm text-slate-400 dark:text-slate-500">
                  Valor mínimo: {formatarMoeda(VALOR_MINIMO_CONTRIBUICAO)} por mês.
                </span>
              </label>

              <button
                type="button"
                onClick={handleApoiar}
                disabled={atualizando}
                className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-4 text-xl font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Heart size={24} aria-hidden="true" />
                {atualizando ? 'Um instante...' : 'Quero Apoiar'}
              </button>
              {erro && <p className="mt-3 text-base font-medium text-red-600 dark:text-red-400">{erro}</p>}
            </>
          )}

          {ehApoiador && (
            <p className="mt-6 rounded-2xl bg-emerald-100 p-4 text-center text-lg font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Você já é um Apoiador, contribuindo com {formatarMoeda(empresa.valorContribuicao)}/mês. Muito
              obrigado! 💙
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
