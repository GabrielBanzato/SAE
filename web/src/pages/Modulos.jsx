import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Users, MessageCircle, Kanban, ScrollText, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * App Store do SaaS (arquitetura modular, 2026-09-22, ultimo passo do
 * roadmap): cada card liga/desliga um modulo OPCIONAL de verdade via
 * `PUT /empresa/modulos` - substitui a antiga vitrine mock (so registrava
 * "interesse" localmente, nada persistia, nenhum modulo aqui era real
 * ainda). `empresa.modulos` (AuthContext) e a fonte da verdade de quais
 * telas aparecem na Sidebar/App.jsx - o toggle aqui muda ela direto (via
 * `refreshEmpresa()` logo apos o PUT), entao a Sidebar reflete a mudanca
 * na hora, sem precisar de F5.
 *
 * So os modulos com card aqui tem toggle de verdade - os demais opcionais
 * "legados" (Precificação/Estoque Avançado/Agenda/Relatórios) continuam
 * liberados so pelo `MAPA_MODULOS` do cadastro (ver auth.service.js),
 * ainda sem card proprio (fora do escopo desta tarefa, sinalizado em
 * NOTAS_IMPORTANTES.md). "Notas Fiscais" continua um mock "em breve" - o
 * backend dela nunca foi implementado, entao nao ha nada real pra ligar.
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
    chave: 'ia_whatsapp',
    nome: 'Inbox de Inteligência Artificial',
    icon: MessageCircle,
    descricao:
      'Atendimento unificado de WhatsApp com um bot de IA respondendo dúvidas automaticamente - a equipe assume a conversa quando quiser, sem perder o histórico.',
  },
  {
    chave: 'tarefas',
    nome: 'Gestão de Equipe/Kanban',
    icon: Kanban,
    descricao:
      'Quadro de tarefas com 3 colunas (A Fazer, Em Andamento, Concluído) pra organizar o trabalho da equipe, com responsável e prazo por tarefa.',
  },
];

/** Card ainda sem backend real - so um mock de "registrar interesse", igual a versao antiga desta pagina. */
const MODULO_MOCK = {
  id: 'notas-fiscais',
  nome: 'Emissão de Notas Fiscais',
  icon: ScrollText,
  descricao:
    'Emita NFe/NFCe direto pelo SAE, com total conformidade com a legislação fiscal - sem precisar abrir outro sistema nem digitar os mesmos dados da venda de novo.',
  saibaMaisEm: '/notas',
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

function CardModuloOpcional({ modulo, ligado, salvando, onAlternar }) {
  const Icon = modulo.icon;

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
            <Switch
              ligado={ligado}
              disabled={salvando}
              onClick={() => onAlternar(modulo.chave, !ligado)}
              label={`${ligado ? 'Desativar' : 'Ativar'} módulo ${modulo.nome}`}
            />
          )}
        </div>

        <p className="mt-2 flex-1 text-base text-slate-500 dark:text-slate-400">{modulo.descricao}</p>

        <p
          className={`mt-4 text-sm font-bold ${
            ligado ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {ligado ? 'Ativo - já aparece no seu menu' : 'Desativado'}
        </p>
      </div>
    </div>
  );
}

function CardModuloMock({ modulo, interessado, onRegistrarInteresse }) {
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

  const modulosAtivos = empresa?.modulos ?? [];
  const carregando = empresa === null;

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

  function registrarInteresse(id) {
    setInteresses((atual) => new Set(atual).add(id));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">Módulos</h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Ligue e desligue os recursos que a sua equipe usa - o menu lateral se ajusta na hora.
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
              ligado={modulosAtivos.includes(modulo.chave)}
              salvando={salvandoChave === modulo.chave}
              onAlternar={alternarModulo}
            />
          ))}

          <CardModuloMock
            modulo={MODULO_MOCK}
            interessado={interesses.has(MODULO_MOCK.id)}
            onRegistrarInteresse={registrarInteresse}
          />
        </div>
      )}
    </div>
  );
}
