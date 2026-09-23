import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Users, MessageCircle, Kanban, ScrollText, Lock, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ModalPagamento from '../components/modulos/ModalPagamento';

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Preço de Apoiador (desconto pra empresa com `isDoador === true`, coluna
 * persistida - ver empresa.service.js#obterDados/Empresa.isDoador em
 * schema.prisma, sempre gravada junto com `plano` pra nunca divergir) -
 * metade do
 * preço cheio, arredondado pra baixo mantendo a terminação ",90" (mesma
 * psicologia de preço do resto do catálogo). Ex.: R$ 5,90 -> R$ 2,90;
 * R$ 39,90 -> R$ 19,90. Fórmula única (não preço fixo por módulo) pra
 * qualquer preço novo já sair com desconto consistente, sem precisar
 * lembrar de calcular a mão.
 */
function calcularPrecoDoador(preco) {
  return Math.floor(preco * 5) / 10;
}

/**
 * App Store do SaaS (arquitetura modular, 2026-09-22 + motor de pricing,
 * mesmo dia) - cada card liga/desliga um modulo OPCIONAL de verdade via
 * `PUT /empresa/modulos`. `empresa.modulos` (AuthContext) e a fonte da
 * verdade de quais telas aparecem na Sidebar/App.jsx - o toggle aqui muda
 * ela direto (via `refreshEmpresa()` logo apos o PUT), entao a Sidebar
 * reflete a mudanca na hora, sem precisar de F5.
 *
 * Handoff pagamento -> ativacao: os 4 modulos abaixo (`pdv_touch`,
 * `clientes`, `ia_whatsapp`, `tarefas`) exigem pagamento simulado ANTES de
 * poderem ser ligados (`empresa.pagamentos`, ver empresa.service.js -
 * MODULOS_PAGOS). O Switch de um modulo nao pago abre `ModalPagamento` em
 * vez de chamar `PUT /empresa/modulos` direto - o backend tambem reforca
 * essa regra (402 se tentar ligar sem pagar), entao a UI nunca fica
 * "prometendo" algo que a API recusaria.
 *
 * "Notas Fiscais" continua um mock "em breve" (preco placeholder, "A
 * definir") - o backend dela nunca foi implementado, entao nao ha modulo
 * real pra cobrar nem ativar ainda.
 *
 * Precos NAO ficam mais fixos aqui (ver `PRECOS_PADRAO` abaixo, so um
 * fallback pro primeiro instante antes da API responder) - vem de
 * `GET /configuracoes/precos` (`ConfiguracaoGlobal`, schema.prisma),
 * editaveis pelo Supra Admin em `pages/superadmin/ConfiguracoesGlobais.jsx` -
 * mudar um preco la reflete AQUI, pra qualquer empresa, sem precisar
 * alterar codigo.
 */
const MODULOS_OPCIONAIS = [
  {
    chave: 'pdv_touch',
    nome: 'Frente de Loja (PDV)',
    icon: Zap,
    descricao:
      'Tela cheia, touch-friendly, pensada pro caixa rápido de balcão - carrinho grande, checkout em poucos toques.',
  },
  {
    chave: 'clientes',
    nome: 'CRM e Perfil 360',
    icon: Users,
    descricao:
      'Cadastro de clientes com histórico de compras, LTV e ticket médio calculados automaticamente - saiba quem são seus melhores clientes.',
  },
  {
    chave: 'tarefas',
    nome: 'Gestão de Equipe/Kanban',
    icon: Kanban,
    descricao:
      'Quadro de tarefas com 3 colunas (A Fazer, Em Andamento, Concluído) pra organizar o trabalho da equipe, com responsável e prazo por tarefa.',
  },
];

/** As 2 ofertas do único módulo pago com mais de 1 preço - `chave` bate com `PLANOS_IA_WHATSAPP` em empresa.service.js. */
const PLANOS_IA_WHATSAPP = [
  { chave: 'whatsapp_web', nome: 'Conexão Alternativa (WhatsApp Web)' },
  { chave: 'meta_api', nome: 'Conexão Oficial (API Meta) + Taxas de uso' },
];

/** Card ainda sem backend real - so um mock de "registrar interesse", igual a versao antiga desta pagina. Preco "A definir" - placeholder visual, nao cobra de verdade. */
const MODULO_MOCK = {
  id: 'notas-fiscais',
  nome: 'Emissão de Notas Fiscais',
  icon: ScrollText,
  descricao:
    'Emita NFe/NFCe direto pelo SAE, com total conformidade com a legislação fiscal - sem precisar abrir outro sistema nem digitar os mesmos dados da venda de novo.',
  saibaMaisEm: '/notas',
};

/** Fallback so pro primeiro instante do render, antes de `GET /configuracoes/precos` responder - nunca fica visivel por mais que um piscar de tela (ver `carregando` em `Modulos()`). */
const PRECOS_PADRAO = {
  pdv_touch: 5.9,
  clientes: 3.9,
  tarefas: 3.9,
  notas_fiscais: 9.9,
  ia_whatsapp: { whatsapp_web: 39.9, meta_api: 69.9 },
};

/** Mesmo padrao visual de switch ja usado em InboxUnificado.jsx (toggle "Bot de IA Ativo"). */
function Switch({ ligado, disabled, onClick, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={`absolute inset-0 rounded-full transition-colors ${ligado ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        aria-hidden="true"
      />
      <span
        className={`relative inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          ligado ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/** Preço com risco + desconto verde quando `isDoador` - reaproveitado pelos cards normais e pelas linhas de plano do card de WhatsApp. */
function PrecoLinha({ preco, isDoador, compacto }) {
  const precoFinal = isDoador ? calcularPrecoDoador(preco) : preco;

  return (
    <div className={`flex flex-wrap items-baseline gap-x-1.5 ${compacto ? '' : 'mt-4'}`}>
      {isDoador && (
        <s className={`font-semibold text-slate-400 dark:text-slate-500 ${compacto ? 'text-sm' : 'text-base'}`}>
          {formatarMoeda(preco)}
        </s>
      )}
      <span
        className={`font-extrabold ${compacto ? 'text-base' : 'text-2xl'} ${
          isDoador ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {formatarMoeda(precoFinal)}
      </span>
      <span className={`font-medium text-slate-400 dark:text-slate-500 ${compacto ? 'text-xs' : 'text-sm'}`}>
        /mês
      </span>
    </div>
  );
}

function CardModuloOpcional({ modulo, preco, ligado, pago, isDoador, salvando, onAlternar, onAbrirPagamento }) {
  const Icon = modulo.icon;

  function handleSwitchClick() {
    if (pago) {
      onAlternar(modulo.chave, !ligado);
    } else {
      onAbrirPagamento({ chave: modulo.chave, nome: modulo.nome, preco });
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-lg dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300 dark:from-slate-700 dark:to-slate-900 dark:text-slate-600">
        <Icon size={56} aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{modulo.nome}</h3>
          {salvando ? (
            <Loader2 size={20} className="mt-1 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              {!pago && <Lock size={14} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />}
              <Switch
                ligado={ligado}
                onClick={handleSwitchClick}
                label={pago ? `${ligado ? 'Desativar' : 'Ativar'} módulo ${modulo.nome}` : `Assinar módulo ${modulo.nome}`}
              />
            </div>
          )}
        </div>

        <p className="mt-2 flex-1 text-base text-slate-500 dark:text-slate-400">{modulo.descricao}</p>

        <PrecoLinha preco={preco} isDoador={isDoador} />

        <p
          className={`mt-3 text-sm font-bold ${
            ligado ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {ligado ? 'Ativo - já aparece no seu menu' : pago ? 'Pago - toque no switch pra ativar' : 'Toque no switch pra assinar'}
        </p>
      </div>
    </div>
  );
}

/**
 * Card especial do Inbox de IA - o único módulo com 2 ofertas de preço
 * diferentes (pedido explícito: radio buttons antes do Switch). O plano
 * selecionado decide tanto o preço mostrado quanto qual checkout abre se
 * o Switch for clicado sem esse plano especifico pago - pagar um plano
 * não libera o outro (`pagoNestePlano` só é `true` quando o plano
 * selecionado bate com o que consta em `empresa.pagamentos.ia_whatsapp.planoIa`).
 */
function CardModuloWhatsApp({ precos, ligado, planoPago, isDoador, salvando, onAlternar, onAbrirPagamento }) {
  const [planoSelecionado, setPlanoSelecionado] = useState(planoPago || PLANOS_IA_WHATSAPP[0].chave);

  // Sincroniza a selecao se um pagamento for confirmado por fora (outro
  // plano) - evita o radio ficar "atrasado" em relacao ao que foi pago de
  // verdade.
  useEffect(() => {
    if (planoPago) setPlanoSelecionado(planoPago);
  }, [planoPago]);

  const planoInfo = PLANOS_IA_WHATSAPP.find((plano) => plano.chave === planoSelecionado);
  const pagoNestePlano = planoPago === planoSelecionado;

  function handleSwitchClick() {
    if (pagoNestePlano) {
      onAlternar('ia_whatsapp', !ligado);
    } else {
      onAbrirPagamento({
        chave: 'ia_whatsapp',
        nome: `Inbox de IA - ${planoInfo.nome}`,
        preco: precos[planoSelecionado],
        planoIa: planoSelecionado,
      });
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-lg dark:bg-slate-800 dark:ring-slate-700 sm:col-span-2 lg:col-span-1">
      <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300 dark:from-slate-700 dark:to-slate-900 dark:text-slate-600">
        <MessageCircle size={56} aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Inbox de Inteligência Artificial</h3>
          {salvando ? (
            <Loader2 size={20} className="mt-1 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              {!pagoNestePlano && <Lock size={14} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />}
              <Switch
                ligado={ligado}
                onClick={handleSwitchClick}
                label={pagoNestePlano ? `${ligado ? 'Desativar' : 'Ativar'} Inbox de IA` : 'Assinar Inbox de IA'}
              />
            </div>
          )}
        </div>

        <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
          Atendimento unificado de WhatsApp com um bot de IA respondendo dúvidas automaticamente - a equipe assume a
          conversa quando quiser, sem perder o histórico.
        </p>

        <div className="mt-4 space-y-2">
          {PLANOS_IA_WHATSAPP.map((plano) => (
            <label
              key={plano.chave}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition-colors ${
                planoSelecionado === plano.chave
                  ? 'border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/20'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900/40'
              }`}
            >
              <input
                type="radio"
                name="plano-ia-whatsapp"
                value={plano.chave}
                checked={planoSelecionado === plano.chave}
                onChange={() => setPlanoSelecionado(plano.chave)}
                className="h-4 w-4 shrink-0 accent-blue-600"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{plano.nome}</p>
                <PrecoLinha preco={precos[plano.chave]} isDoador={isDoador} compacto />
              </div>
              {planoPago === plano.chave && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Pago
                </span>
              )}
            </label>
          ))}
        </div>

        <p
          className={`mt-3 text-sm font-bold ${
            ligado ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {ligado
            ? 'Ativo - já aparece no seu menu'
            : pagoNestePlano
              ? 'Pago - toque no switch pra ativar'
              : 'Toque no switch pra assinar o plano selecionado'}
        </p>
      </div>
    </div>
  );
}

function CardModuloMock({ modulo, preco, interessado, onRegistrarInteresse }) {
  const Icon = modulo.icon;

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-lg dark:bg-slate-800 dark:ring-slate-700">
      <Link to={modulo.saibaMaisEm} aria-label={`Saiba mais sobre ${modulo.nome}`}>
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300 dark:from-slate-700 dark:to-slate-900 dark:text-slate-600">
          <Icon size={56} aria-hidden="true" />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{modulo.nome}</h3>
          <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Em breve
          </span>
        </div>

        <p className="mt-2 flex-1 text-base text-slate-500 dark:text-slate-400">{modulo.descricao}</p>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-slate-400 dark:text-slate-500">A definir</span>
          <span className="text-sm text-slate-400 dark:text-slate-500">
            (estimativa: {formatarMoeda(preco)}/mês)
          </span>
        </div>

        <div className="mt-5">
          {interessado ? (
            <p className="rounded-2xl bg-emerald-50 px-6 py-3 text-center font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Interesse registrado!
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onRegistrarInteresse(modulo.id)}
              className="w-full rounded-2xl border-2 border-amber-400 px-6 py-3 text-lg font-bold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-500/10"
            >
              Tenho Interesse
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Modulos() {
  const { empresa, refreshEmpresa } = useAuth();
  const [salvandoChave, setSalvandoChave] = useState(null);
  const [erro, setErro] = useState('');
  const [interesses, setInteresses] = useState(() => new Set());
  const [pagamentoAberto, setPagamentoAberto] = useState(null);
  // Precos globais (Supra Admin > Configurações Globais) - `null` so no
  // instante antes da 1a resposta, PRECOS_PADRAO cobre esse instante caso
  // algum card renderize antes (ver `precos` computado abaixo).
  const [precosCarregados, setPrecosCarregados] = useState(null);

  useEffect(() => {
    let ativo = true;
    apiFetch('/configuracoes/precos')
      .then((dados) => {
        if (ativo) setPrecosCarregados(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar os preços dos módulos.');
      });
    return () => {
      ativo = false;
    };
  }, []);

  const precos = precosCarregados ?? PRECOS_PADRAO;
  const modulosAtivos = empresa?.modulos ?? [];
  const pagamentos = empresa?.pagamentos ?? {};
  const isDoador = empresa?.isDoador ?? false;
  const carregando = empresa === null || precosCarregados === null;

  async function alternarModulo(chave, ligar) {
    setErro('');
    setSalvandoChave(chave);

    const novosModulos = ligar ? [...modulosAtivos, chave] : modulosAtivos.filter((item) => item !== chave);

    try {
      await apiFetch('/empresa/modulos', {
        method: 'PUT',
        body: JSON.stringify({ modulos: novosModulos }),
      });
      // Resincroniza o AuthContext (localStorage + estado React) com a
      // resposta oficial do backend - e o que faz a Sidebar/App.jsx
      // reagirem na hora, sem precisar de F5.
      await refreshEmpresa();
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar este módulo agora.');
    } finally {
      setSalvandoChave(null);
    }
  }

  function abrirPagamento(dados) {
    setErro('');
    setPagamentoAberto(dados);
  }

  /** Confirma o checkout simulado - `PUT /empresa/pagamentos` já marca o módulo pago E o ativa na mesma resposta (ver empresa.service.js#confirmarPagamento), então um único `refreshEmpresa()` já traz os dois estados atualizados. */
  async function confirmarPagamento() {
    const { chave, planoIa } = pagamentoAberto;
    await apiFetch('/empresa/pagamentos', {
      method: 'PUT',
      body: JSON.stringify({ modulo: chave, plano_ia: planoIa }),
    });
    await refreshEmpresa();
    setPagamentoAberto(null);
  }

  function registrarInteresse(id) {
    setInteresses((atual) => new Set(atual).add(id));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">Módulos</h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Ligue e desligue os recursos que a sua equipe usa - o menu lateral se ajusta na hora.
          {isDoador && ' Como Apoiador, você tem desconto em todos os módulos pagos.'}
        </p>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          Carregando...
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS_OPCIONAIS.map((modulo) => (
            <CardModuloOpcional
              key={modulo.chave}
              modulo={modulo}
              preco={precos[modulo.chave]}
              ligado={modulosAtivos.includes(modulo.chave)}
              pago={Boolean(pagamentos[modulo.chave])}
              isDoador={isDoador}
              salvando={salvandoChave === modulo.chave}
              onAlternar={alternarModulo}
              onAbrirPagamento={abrirPagamento}
            />
          ))}

          <CardModuloWhatsApp
            precos={precos.ia_whatsapp}
            ligado={modulosAtivos.includes('ia_whatsapp')}
            planoPago={pagamentos.ia_whatsapp?.planoIa ?? null}
            isDoador={isDoador}
            salvando={salvandoChave === 'ia_whatsapp'}
            onAlternar={alternarModulo}
            onAbrirPagamento={abrirPagamento}
          />

          <CardModuloMock
            modulo={MODULO_MOCK}
            preco={precos.notas_fiscais}
            interessado={interesses.has(MODULO_MOCK.id)}
            onRegistrarInteresse={registrarInteresse}
          />
        </div>
      )}

      {pagamentoAberto && (
        <ModalPagamento
          nome={pagamentoAberto.nome}
          preco={pagamentoAberto.preco}
          precoComDesconto={calcularPrecoDoador(pagamentoAberto.preco)}
          isDoador={isDoador}
          onFechar={() => setPagamentoAberto(null)}
          onConfirmar={confirmarPagamento}
        />
      )}
    </div>
  );
}
