import { useEffect, useState } from 'react';
import { FileText, User, X } from 'lucide-react';
import CampoTexto from '../CampoTexto';
import CampoData from '../CampoData';

/**
 * Modal de criacao de tarefa do Quadro Kanban (modulo de Produtividade) -
 * mesmo padrao visual/estrutural do ModalLembrete.jsx (overlay centralizado,
 * fecha com Escape/clique fora). `usuarios` (lista de {id, nome} da equipe,
 * ja buscada em QuadroTarefas.jsx via GET /empresa/usuarios) alimenta o
 * select de responsavel - opcional, "Sem responsável" por padrao.
 *
 * `data` fica em "YYYY-MM-DD" (mesmo formato de CampoData) e vira
 * "AAAA-MM-DDT12:00:00.000Z" no submit - meio-dia UTC, mesmo truque ja
 * usado em ModalLembrete.jsx/Agenda.jsx pra uma data "so calendario" nunca
 * deslizar de dia num fuso horario diferente.
 */
export default function ModalNovaTarefa({ usuarios, onFechar, onSalvar }) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    if (!titulo.trim()) {
      setErro('Informe o título da tarefa.');
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data_vencimento: data ? `${data}T12:00:00.000Z` : undefined,
        responsavelId: responsavelId ? Number(responsavelId) : undefined,
      });
    } catch (err) {
      setErro(err.message || 'Não foi possível criar a tarefa.');
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-nova-tarefa"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-nova-tarefa" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Nova Tarefa
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <CampoTexto
            label="Título"
            icon={FileText}
            type="text"
            placeholder="Ex: Repor estoque de embalagens"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            autoFocus
            required
          />

          <label className="block">
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Descrição</span>
            <textarea
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Detalhes da tarefa (opcional)"
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-blue-400"
            />
          </label>

          <CampoData label="Prazo (opcional)" value={data} onChange={setData} />

          <label className="block">
            <span className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
              <User size={18} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              Responsável
            </span>
            <select
              value={responsavelId}
              onChange={(event) => setResponsavelId(event.target.value)}
              className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
            >
              <option value="">Sem responsável</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome}
                </option>
              ))}
            </select>
          </label>

          {erro && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-2xl px-5 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
