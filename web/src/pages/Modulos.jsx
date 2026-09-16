import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ScrollText, CheckCircle2, ArrowUpRight } from 'lucide-react';

/**
 * Vitrine de addons pagos (estilo "loja de apps" de um SaaS). Substitui o
 * antigo bloco "Modulos Extras" que vivia dentro da Sidebar - agora e uma
 * pagina de verdade, com espaco pra explicar cada modulo de verdade (preco,
 * o que resolve), nao so um item de menu com um cadeado.
 *
 * "Notas Fiscais" ja tinha uma pagina propria (`/notas` - "Modulo Fiscal em
 * Desenvolvimento", ver pages/Notas.jsx) que nao tem mais link nenhum no
 * menu depois desta reformulacao - por isso o card dela linka pra la
 * ("Saiba mais"), pra essa tela nao virar orfa. "IA no WhatsApp" e 100%
 * novo/ficticio, sem pagina propria - so existe aqui mesmo.
 */
const MODULOS = [
  {
    id: 'ia-whatsapp',
    nome: 'IA no WhatsApp',
    icon: MessageCircle,
    descricao:
      'Um atendente virtual que responde dúvidas frequentes, confirma pedidos e envia lembrete de pagamento direto pelo WhatsApp da sua loja - pra você não precisar responder tudo manualmente o dia inteiro.',
    precoMensal: 49.9,
    status: 'em_breve',
  },
  {
    id: 'notas-fiscais',
    nome: 'Emissão de Notas Fiscais',
    icon: ScrollText,
    descricao:
      'Emita NFe/NFCe direto pelo SAE, com total conformidade com a legislação fiscal - sem precisar abrir outro sistema nem digitar os mesmos dados da venda de novo.',
    precoMensal: 69.9,
    status: 'em_breve',
    saibaMaisEm: '/notas',
  },
];

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function TagStatus({ status }) {
  if (status === 'disponivel') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        Disponível
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      Em breve
    </span>
  );
}

/**
 * Cartao de modulo com CTA local ("Tenho Interesse"/"Contratar Módulo").
 * Nao existe (nem foi pedido criar) uma rota de backend pra registrar
 * interesse/contratacao - clicar so marca esse cartao como "respondido" no
 * estado do proprio componente (nada e persistido, some se recarregar a
 * pagina). E um feedback visual honesto, no mesmo espirito do botao
 * "Salvar Alteracoes" desabilitado de DadosDaLoja.jsx: comunica a intencao
 * sem fingir que ja existe uma feature de verdade por tras.
 */
function CardModulo({ modulo, interessado, onRegistrarInteresse }) {
  const Icon = modulo.icon;
  const rotuloBotao = modulo.status === 'disponivel' ? 'Contratar Módulo' : 'Tenho Interesse';

  const mockup = (
    <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300 dark:from-slate-700 dark:to-slate-900 dark:text-slate-600">
      <Icon size={56} aria-hidden="true" />
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-lg dark:bg-slate-800 dark:ring-slate-700">
      {modulo.saibaMaisEm ? (
        <Link to={modulo.saibaMaisEm} aria-label={`Saiba mais sobre ${modulo.nome}`}>
          {mockup}
        </Link>
      ) : (
        mockup
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{modulo.nome}</h3>
          <TagStatus status={modulo.status} />
        </div>

        <p className="mt-2 flex-1 text-base text-slate-500 dark:text-slate-400">{modulo.descricao}</p>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatarMoeda(modulo.precoMensal)}
          </span>
          <span className="text-base font-medium text-slate-400 dark:text-slate-500">/mês</span>
        </div>

        {modulo.saibaMaisEm && (
          <Link
            to={modulo.saibaMaisEm}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            Saiba mais
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        )}

        {interessado ? (
          <p className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-6 py-3 text-base font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 size={20} aria-hidden="true" />
            Interesse registrado!
          </p>
        ) : (
          <button
            type="button"
            onClick={() => onRegistrarInteresse(modulo.id)}
            className={`mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition-colors ${
              modulo.status === 'disponivel'
                ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                : 'border-2 border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-500/10'
            }`}
          >
            {rotuloBotao}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Modulos() {
  const [interesses, setInteresses] = useState(() => new Set());

  function registrarInteresse(id) {
    setInteresses((atual) => new Set(atual).add(id));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">Módulos</h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Recursos extras pra turbinar o seu negócio, além do que já vem no plano atual.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((modulo) => (
          <CardModulo
            key={modulo.id}
            modulo={modulo}
            interessado={interesses.has(modulo.id)}
            onRegistrarInteresse={registrarInteresse}
          />
        ))}
      </div>
    </div>
  );
}
