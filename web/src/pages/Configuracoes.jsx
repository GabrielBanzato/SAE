import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Store, Users, HeartHandshake, Lock } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DadosDaLoja from '../components/configuracoes/DadosDaLoja';
import UsuariosEquipe from '../components/configuracoes/UsuariosEquipe';
import Assinatura from '../components/configuracoes/Assinatura';

const MENSAGEM_EQUIPE_BLOQUEADA = 'Recurso exclusivo para Apoiadores do sistema.';

const ABAS = [
  { id: 'dados', label: 'Dados da Loja', icon: Store },
  { id: 'usuarios', label: 'Equipe', icon: Users },
  { id: 'assinatura', label: 'Assinatura', icon: HeartHandshake },
];

function Carregando() {
  return <p className="text-lg text-slate-500 dark:text-slate-400">Carregando...</p>;
}

function Erro({ mensagem }) {
  return (
    <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
      {mensagem}
    </p>
  );
}

/**
 * Pagina de Configuracoes: layout de abas consumindo a API real
 * (/empresa/dados, /empresa/usuarios - Prisma + JWT + isolamento de
 * tenant, sem mock).
 *
 * Cada aba busca seus proprios dados SOB DEMANDA, na primeira vez que e
 * clicada - nao busca tudo de uma vez no carregamento da pagina. Uma vez
 * carregado, o resultado fica em cache no estado (nao refaz o fetch se o
 * usuario voltar pra uma aba ja visitada). "Dados da Loja" e "Assinatura"
 * compartilham os mesmos dados de empresa (a aba inicial ja dispara a
 * primeira busca, sem precisar de clique).
 */
export default function Configuracoes() {
  // Permite abrir uma aba especifica via link (ex.: banner de Relatorios.jsx
  // linkando pra "/configuracoes?aba=assinatura") - ignora o parametro se
  // vier um id que nao existe em ABAS, caindo no padrao "dados".
  const [searchParams] = useSearchParams();
  const abaInicial = searchParams.get('aba');
  const [abaAtiva, setAbaAtiva] = useState(
    ABAS.some((aba) => aba.id === abaInicial) ? abaInicial : 'dados'
  );

  // Plano vem do AuthContext (ja populado desde o login, sem esperar o
  // fetch proprio desta pagina) - usado so pra decidir se a aba "Equipe"
  // aparece bloqueada. Ver UsuariosEquipe.jsx pro bloqueio de conteudo em
  // si (o motivo de negocio da mudanca mora la, nao aqui).
  const { empresa: empresaSessao } = useAuth();
  const ehApoiador = empresaSessao?.plano === 'apoiador';

  const [empresa, setEmpresa] = useState(null);
  const [carregandoEmpresa, setCarregandoEmpresa] = useState(false);
  const [erroEmpresa, setErroEmpresa] = useState('');

  const [usuarios, setUsuarios] = useState(null);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [erroUsuarios, setErroUsuarios] = useState('');

  // "usuarios" tambem precisa de `empresa` agora - o contador/limite de
  // usuarios do UsuariosEquipe.jsx depende de `empresa.plano`.
  const precisaDeEmpresa = abaAtiva === 'dados' || abaAtiva === 'assinatura' || abaAtiva === 'usuarios';

  // Nota: "carregando*" NAO entra no array de dependencias de proposito -
  // como o proprio efeito atualiza esse estado, incluir ele como dependencia
  // faria o efeito re-rodar (e a limpeza cancelar `ativo`) antes do fetch em
  // andamento terminar, descartando a resposta silenciosamente. O guard
  // contra fetch duplicado usa so `empresa`/`usuarios` (null = ainda nao
  // carregado).
  useEffect(() => {
    if (!precisaDeEmpresa || empresa !== null) {
      return undefined;
    }

    let ativo = true;
    setCarregandoEmpresa(true);
    setErroEmpresa('');

    apiFetch('/empresa/dados')
      .then((dados) => {
        if (ativo) setEmpresa(dados);
      })
      .catch((err) => {
        if (ativo) setErroEmpresa(err.message || 'Não foi possível carregar os dados da loja.');
      })
      .finally(() => {
        if (ativo) setCarregandoEmpresa(false);
      });

    return () => {
      ativo = false;
    };
  }, [precisaDeEmpresa, empresa]);

  useEffect(() => {
    // Nao busca a equipe se a aba esta bloqueada pra este plano - evita
    // uma chamada de API desperdicada, ja que UsuariosEquipe.jsx nem usa
    // `usuarios` enquanto `plano !== 'apoiador'` (so mostra o aviso de
    // bloqueio).
    if (abaAtiva !== 'usuarios' || usuarios !== null || !ehApoiador) {
      return undefined;
    }

    let ativo = true;
    setCarregandoUsuarios(true);
    setErroUsuarios('');

    apiFetch('/empresa/usuarios')
      .then((dados) => {
        if (ativo) setUsuarios(dados);
      })
      .catch((err) => {
        if (ativo) setErroUsuarios(err.message || 'Não foi possível carregar a equipe.');
      })
      .finally(() => {
        if (ativo) setCarregandoUsuarios(false);
      });

    return () => {
      ativo = false;
    };
  }, [abaAtiva, usuarios, ehApoiador]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">Configurações</h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Dados da loja, sua equipe e a assinatura do sistema.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Secoes de configuracao"
        className="-mx-6 flex gap-2 overflow-x-auto border-b border-slate-200 px-6 pb-2 dark:border-slate-800"
      >
        {ABAS.map(({ id, label, icon: Icon }) => {
          const bloqueada = id === 'usuarios' && !ehApoiador;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={abaAtiva === id}
              onClick={() => setAbaAtiva(id)}
              title={bloqueada ? MENSAGEM_EQUIPE_BLOQUEADA : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-base font-semibold transition-colors sm:px-5 sm:py-3 sm:text-lg ${
                abaAtiva === id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              } ${bloqueada ? 'opacity-60' : ''}`}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              {label}
              {bloqueada && <Lock size={16} className="shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {abaAtiva === 'dados' &&
          (carregandoEmpresa ? (
            <Carregando />
          ) : erroEmpresa ? (
            <Erro mensagem={erroEmpresa} />
          ) : (
            <DadosDaLoja empresa={empresa} onEmpresaAtualizada={setEmpresa} />
          ))}

        {abaAtiva === 'usuarios' &&
          (carregandoUsuarios || carregandoEmpresa ? (
            <Carregando />
          ) : erroUsuarios ? (
            <Erro mensagem={erroUsuarios} />
          ) : (
            <UsuariosEquipe
              usuarios={usuarios}
              plano={empresa?.plano}
              onIrParaAssinatura={() => setAbaAtiva('assinatura')}
            />
          ))}

        {abaAtiva === 'assinatura' &&
          (carregandoEmpresa ? (
            <Carregando />
          ) : erroEmpresa ? (
            <Erro mensagem={erroEmpresa} />
          ) : (
            <Assinatura empresa={empresa} onEmpresaAtualizada={setEmpresa} />
          ))}
      </div>
    </div>
  );
}
