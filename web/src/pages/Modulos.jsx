import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ScrollText, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';

/**
 * Vitrine de addons pagos (estilo "loja de apps" de um SaaS). Substitui o
 * antigo bloco "Modulos Extras" que vivia dentro da Sidebar - agora e uma
 * pagina de verdade, com espaco pra explicar cada modulo de verdade (preco,
 * o que resolve), nao so um item de menu com um cadeado.
 *
 * "Notas Fiscais" ja tinha uma pagina propria (`/notas` - "Modulo Fiscal em
 * Desenvolvimento", ver pages/Notas.jsx) que nao tem mais link nenhum no
 * menu depois da reformulacao da Sidebar - por isso o card dela linka pra
 * la ("Saiba mais"), pra essa tela nao virar orfa.
 */
const MODULO_WHATSAPP = {
  id: 'ia-whatsapp',
  nome: 'IA no WhatsApp',
  icon: MessageCircle,
  descricao:
    'Um atendente virtual que responde dúvidas frequentes, confirma pedidos e envia lembrete de pagamento direto pelo WhatsApp da sua loja - pra você não precisar responder tudo manualmente o dia inteiro. Duas modalidades de conexão, com trade-offs diferentes de custo, risco e recursos - escolha a que fizer mais sentido pro seu negócio.',
  status: 'em_breve',
  modalidades: [
    {
      id: 'ia-whatsapp-qrcode',
      nome: 'Conexão Padrão (QR Code)',
      selo: 'Configuração rápida',
      precoMensal: 49.9,
      pros: ['Configuração em 1 minuto - só ler o QR Code', 'Sem custo por mensagem enviada'],
      contras: ['Risco de bloqueio do número pelo WhatsApp se houver denúncias de spam'],
      idealPara: 'Ideal para números de suporte ou atendimento receptivo.',
    },
    {
      id: 'ia-whatsapp-oficial',
      nome: 'API Oficial Meta (Cloud API)',
      selo: 'Mais seguro',
      destaque: true,
      precoMensal: 97.9,
      custoAdicional: 'custos da Meta',
      pros: ['Risco zero de banimento', 'Selo de confiabilidade', 'Suporte a botões interativos', 'Catálogos nativos'],
      contras: [
        'Exige aprovação de empresa na Meta (CNPJ)',
        'A Meta cobra uma taxa em centavos por conversa iniciada',
      ],
    },
  ],
};

/** Demais modulos, com preco unico (sem modalidades pra comparar) - continuam usando o card simples de antes. */
const MODULOS_SIMPLES = [
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
 * Botao de interesse local, reaproveitado tanto pelo card simples quanto
 * por cada modalidade do WhatsApp. Nao existe (nem foi pedido criar) uma
 * rota de backend pra registrar interesse/contratacao - clicar so marca
 * como "respondido" no estado do proprio componente pai (nada e
 * persistido, some se recarregar a pagina). Feedback visual honesto, mesmo
 * espirito do botao "Salvar Alteracoes" mockado em DadosDaLoja.jsx.
 */
function BotaoInteresse({ id, rotulo, interessado, onRegistrarInteresse, tamanho = 'normal' }) {
  if (interessado) {
    return (
      <p
        className={`flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ${
          tamanho === 'normal' ? 'px-6 py-3 text-base' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <CheckCircle2 size={tamanho === 'normal' ? 20 : 18} aria-hidden="true" />
        Interesse registrado!
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onRegistrarInteresse(id)}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-400 font-bold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-500/10 ${
        tamanho === 'normal' ? 'px-6 py-3 text-lg' : 'px-4 py-2.5 text-base'
      }`}
    >
      {rotulo}
    </button>
  );
}

function CardModulo({ modulo, interessado, onRegistrarInteresse }) {
  const Icon = modulo.icon;

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

        <div className="mt-5">
          <BotaoInteresse
            id={modulo.id}
            rotulo={modulo.status === 'disponivel' ? 'Contratar Módulo' : 'Tenho Interesse'}
            interessado={interessado}
            onRegistrarInteresse={onRegistrarInteresse}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Um card de modalidade dentro do modulo de WhatsApp - preco, lista de
 * pros (check verde) e contras (alerta ambar) e CTA proprios. `destaque`
 * (so a modalidade "API Oficial") ganha borda azul pra chamar mais
 * atencao - e a opcao sem risco de banimento, o argumento mais forte de
 * venda das duas.
 */
function CardModalidade({ modalidade, interessado, onRegistrarInteresse }) {
  return (
    <div
      className={`flex flex-col rounded-2xl border-2 p-5 ${
        modalidade.destaque
          ? 'border-blue-500 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{modalidade.nome}</h4>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            modalidade.destaque
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {modalidade.selo}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-1">
        <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          {formatarMoeda(modalidade.precoMensal)}
        </span>
        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
          /mês{modalidade.custoAdicional ? ` + ${modalidade.custoAdicional}` : ''}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {modalidade.pros.map((texto) => (
          <li key={texto} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {texto}
          </li>
        ))}
        {modalidade.contras.map((texto) => (
          <li key={texto} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            {texto}
          </li>
        ))}
      </ul>

      {modalidade.idealPara && (
        <p className="mt-3 text-xs italic text-slate-400 dark:text-slate-500">{modalidade.idealPara}</p>
      )}

      <div className="mt-5">
        <BotaoInteresse
          id={modalidade.id}
          rotulo="Tenho Interesse"
          interessado={interessado}
          onRegistrarInteresse={onRegistrarInteresse}
          tamanho="compacto"
        />
      </div>
    </div>
  );
}

/**
 * Secao dedicada do modulo de WhatsApp: mockup + descricao geral (igual
 * aos outros modulos) seguido de um comparativo lado a lado das 2
 * modalidades de contratacao (`CardModalidade`) - layout de "2 cards"
 * escolhido entre as 3 opcoes sugeridas (tabela / 2 cards / toggle) por
 * deixar as duas ofertas visiveis ao mesmo tempo pra comparar, sem
 * esconder uma atras de um clique de toggle. Mesmo padrao visual ja usado
 * em Assinatura.jsx (2 planos lado a lado).
 */
function SecaoModuloWhatsApp({ interesses, onRegistrarInteresse }) {
  const Icon = MODULO_WHATSAPP.icon;

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex aspect-[3/1] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300 dark:from-slate-700 dark:to-slate-900 dark:text-slate-600 sm:aspect-[4/1]">
        <Icon size={56} aria-hidden="true" />
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{MODULO_WHATSAPP.nome}</h3>
          <TagStatus status={MODULO_WHATSAPP.status} />
        </div>
        <p className="mt-2 max-w-3xl text-base text-slate-500 dark:text-slate-400">{MODULO_WHATSAPP.descricao}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {MODULO_WHATSAPP.modalidades.map((modalidade) => (
            <CardModalidade
              key={modalidade.id}
              modalidade={modalidade}
              interessado={interesses.has(modalidade.id)}
              onRegistrarInteresse={onRegistrarInteresse}
            />
          ))}
        </div>
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

      <SecaoModuloWhatsApp interesses={interesses} onRegistrarInteresse={registrarInteresse} />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS_SIMPLES.map((modulo) => (
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
