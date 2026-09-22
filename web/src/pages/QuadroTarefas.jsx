import { useEffect, useMemo, useState } from 'react';
import { Kanban, Plus, ChevronLeft, ChevronRight, Trash2, UserRound, CalendarClock, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { dataCalendario } from '../utils/datas';
import ModalNovaTarefa from '../components/tarefas/ModalNovaTarefa';

// Ordem das colunas do Kanban - tambem define a direcao dos botoes
// esquerda/direita (mover pra `COLUNAS[indice - 1].status`/`[indice + 1]`).
const COLUNAS = [
  { status: 'A_FAZER', titulo: 'A Fazer', corBarra: 'bg-slate-400' },
  { status: 'EM_ANDAMENTO', titulo: 'Em Andamento', corBarra: 'bg-blue-500' },
  { status: 'CONCLUIDO', titulo: 'Concluído', corBarra: 'bg-emerald-500' },
];

function formatarData(valor) {
  return dataCalendario(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Card de uma tarefa - setas esquerda/direita movem entre colunas
 * adjacentes (chamam a API na hora, ver `moverStatus` em QuadroTarefas).
 * Sem biblioteca de drag-and-drop de proposito (pedido explicito da
 * tarefa) - menos uma dependencia nova no Vite, e o resultado (mover 1
 * coluna por vez) cobre o mesmo caso de uso de um quadro pequeno de
 * equipe.
 */
function CardTarefa({ tarefa, indiceColuna, responsavel, movendo, excluindo, onMover, onExcluir }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{tarefa.titulo}</p>

      {tarefa.descricao && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{tarefa.descricao}</p>
      )}

      {(responsavel || tarefa.dataVencimento) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {responsavel && (
            <span className="flex items-center gap-1.5">
              <UserRound size={14} className="shrink-0" aria-hidden="true" />
              {responsavel.nome}
            </span>
          )}
          {tarefa.dataVencimento && (
            <span className="flex items-center gap-1.5">
              <CalendarClock size={14} className="shrink-0" aria-hidden="true" />
              {formatarData(tarefa.dataVencimento)}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMover(tarefa, -1)}
            disabled={indiceColuna === 0 || movendo}
            aria-label={`Mover para ${COLUNAS[indiceColuna - 1]?.titulo}`}
            title={indiceColuna > 0 ? `Mover para ${COLUNAS[indiceColuna - 1].titulo}` : undefined}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMover(tarefa, 1)}
            disabled={indiceColuna === COLUNAS.length - 1 || movendo}
            aria-label={`Mover para ${COLUNAS[indiceColuna + 1]?.titulo}`}
            title={indiceColuna < COLUNAS.length - 1 ? `Mover para ${COLUNAS[indiceColuna + 1].titulo}` : undefined}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {movendo && <Loader2 size={16} className="ml-1 animate-spin text-slate-400" aria-hidden="true" />}
        </div>

        <button
          type="button"
          onClick={() => onExcluir(tarefa)}
          disabled={excluindo}
          aria-label="Excluir tarefa"
          title="Excluir tarefa"
          className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Quadro de Tarefas Kanban (modulo de Produtividade) - 3 colunas fixas
 * (A_FAZER/EM_ANDAMENTO/CONCLUIDO), consumindo o CRUD real de
 * `api/src/routes/tarefas.routes.js`. Mesma tabela `Tarefa` usada pela
 * Agenda (ver schema.prisma) - uma tarefa criada aqui sem prazo so nao
 * aparece la; uma tarefa com prazo aparece nos dois lugares.
 */
export default function QuadroTarefas() {
  const [tarefas, setTarefas] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [filtroResponsavelId, setFiltroResponsavelId] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [idMovendo, setIdMovendo] = useState(null);
  const [idExcluindo, setIdExcluindo] = useState(null);

  useEffect(() => {
    let ativo = true;
    apiFetch('/empresa/usuarios')
      .then((dados) => {
        if (ativo) setUsuarios(dados);
      })
      .catch(() => {
        // Falha silenciosa: so degrada o select de responsavel (sem
        // opcoes) e os nomes nos cards (cai no fallback "Responsável #id"
        // - ver `nomeDoResponsavel` abaixo) - nao deveria travar o quadro
        // inteiro por causa disso.
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    const query = filtroResponsavelId ? `?responsavel_id=${filtroResponsavelId}` : '';
    apiFetch(`/tarefas${query}`)
      .then((dados) => {
        if (ativo) setTarefas(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar as tarefas.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [filtroResponsavelId]);

  const usuariosPorId = useMemo(() => {
    const mapa = {};
    for (const usuario of usuarios) mapa[usuario.id] = usuario;
    return mapa;
  }, [usuarios]);

  const tarefasPorStatus = useMemo(() => {
    const mapa = { A_FAZER: [], EM_ANDAMENTO: [], CONCLUIDO: [] };
    for (const tarefa of tarefas || []) {
      (mapa[tarefa.status] ||= []).push(tarefa);
    }
    return mapa;
  }, [tarefas]);

  async function criarTarefa(dados) {
    const tarefa = await apiFetch('/tarefas', { method: 'POST', body: JSON.stringify(dados) });
    setTarefas((atual) => [...(atual || []), tarefa]);
    setModalAberto(false);
  }

  async function moverStatus(tarefa, direcao) {
    const indiceAtual = COLUNAS.findIndex((coluna) => coluna.status === tarefa.status);
    const novoIndice = indiceAtual + direcao;
    if (novoIndice < 0 || novoIndice >= COLUNAS.length) return;

    const novoStatus = COLUNAS[novoIndice].status;
    const statusAnterior = tarefa.status;

    setIdMovendo(tarefa.id);
    setErro('');
    // Otimista: move o card na hora, reverte so se a API falhar de verdade.
    setTarefas((atual) => atual.map((item) => (item.id === tarefa.id ? { ...item, status: novoStatus } : item)));

    try {
      await apiFetch(`/tarefas/${tarefa.id}`, { method: 'PUT', body: JSON.stringify({ status: novoStatus }) });
    } catch (err) {
      setTarefas((atual) => atual.map((item) => (item.id === tarefa.id ? { ...item, status: statusAnterior } : item)));
      setErro(err.message || 'Não foi possível mover a tarefa.');
    } finally {
      setIdMovendo(null);
    }
  }

  async function excluirTarefa(tarefa) {
    if (!window.confirm(`Excluir a tarefa "${tarefa.titulo}"? Essa ação não pode ser desfeita.`)) return;

    setIdExcluindo(tarefa.id);
    setErro('');
    try {
      await apiFetch(`/tarefas/${tarefa.id}`, { method: 'DELETE' });
      setTarefas((atual) => atual.filter((item) => item.id !== tarefa.id));
    } catch (err) {
      setErro(err.message || 'Não foi possível excluir a tarefa.');
    } finally {
      setIdExcluindo(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
            <Kanban size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Quadro de Tarefas
          </h1>
          <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
            Produtividade da equipe - arraste o trabalho de "A Fazer" até "Concluído".
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          <Plus size={22} aria-hidden="true" />
          Nova Tarefa
        </button>
      </div>

      {usuarios.length > 0 && (
        <label className="flex max-w-xs items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200">
          Responsável
          <select
            value={filtroResponsavelId}
            onChange={(event) => setFiltroResponsavelId(event.target.value)}
            className="flex-1 rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
          >
            <option value="">Todos</option>
            {usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      {carregando && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          Carregando...
        </div>
      )}

      {!carregando && (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUNAS.map((coluna, indiceColuna) => {
            const tarefasDaColuna = tarefasPorStatus[coluna.status];

            return (
              <div
                key={coluna.status}
                className="flex flex-col rounded-3xl bg-slate-100 p-4 dark:bg-slate-900/40"
              >
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${coluna.corBarra}`} aria-hidden="true" />
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{coluna.titulo}</h2>
                  <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {tarefasDaColuna.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  {tarefasDaColuna.length === 0 && (
                    <p className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                      Nenhuma tarefa aqui.
                    </p>
                  )}

                  {tarefasDaColuna.map((tarefa) => (
                    <CardTarefa
                      key={tarefa.id}
                      tarefa={tarefa}
                      indiceColuna={indiceColuna}
                      responsavel={tarefa.responsavelId ? usuariosPorId[tarefa.responsavelId] : null}
                      movendo={idMovendo === tarefa.id}
                      excluindo={idExcluindo === tarefa.id}
                      onMover={moverStatus}
                      onExcluir={excluirTarefa}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <ModalNovaTarefa usuarios={usuarios} onFechar={() => setModalAberto(false)} onSalvar={criarTarefa} />
      )}
    </div>
  );
}
