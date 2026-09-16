import { useEffect, useState } from 'react';
import { Calendar, FileText, Tag, X } from 'lucide-react';
import CampoTexto from '../CampoTexto';

const CORES_TAG = [
  { valor: 'azul', classe: 'bg-blue-500' },
  { valor: 'verde', classe: 'bg-emerald-500' },
  { valor: 'vermelho', classe: 'bg-rose-500' },
];

/**
 * Modal de cadastro de Lembrete - mesmo padrao visual/estrutural do
 * ModalLancamento.jsx (overlay centralizado, fecha com Escape/clique fora).
 *
 * Sem persistencia real: nao existe (ainda) uma rota POST /tarefas no
 * backend (o schema ate tem o model `Tarefa`, mas so e lido - GET
 * /agenda/:mes_ano - nunca escrito por uma rota propria). `onSalvar`
 * (implementado em Agenda.jsx) so adiciona o lembrete no estado local em
 * memoria - ele aparece no calendario imediatamente, mas some se a pagina
 * for recarregada. Documentado aqui e avisado ao usuario, mesmo espirito
 * do "Salvar Alteracoes" mockado em DadosDaLoja.jsx.
 */
export default function ModalLembrete({ dataInicial, onFechar, onSalvar }) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(dataInicial);
  const [cor, setCor] = useState('azul');
  const [erro, setErro] = useState('');

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar]);

  function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    if (!titulo.trim()) {
      setErro('Informe o título do lembrete.');
      return;
    }
    if (!data) {
      setErro('Informe a data do lembrete.');
      return;
    }

    onSalvar({ titulo: titulo.trim(), descricao: descricao.trim(), data, cor });
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
        aria-labelledby="titulo-modal-lembrete"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-lembrete" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Novo Lembrete
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
            placeholder="Ex: Ligar para o fornecedor"
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
              placeholder="Detalhes do lembrete (opcional)"
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-blue-400"
            />
          </label>

          <CampoTexto
            label="Data"
            icon={Calendar}
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            required
          />

          <div>
            <span className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
              <Tag size={18} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              Cor da tag
            </span>
            <div className="mt-2 flex gap-3">
              {CORES_TAG.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => setCor(opcao.valor)}
                  aria-label={`Cor ${opcao.valor}`}
                  aria-pressed={cor === opcao.valor}
                  className={`h-9 w-9 rounded-full ${opcao.classe} transition-all ${
                    cor === opcao.valor
                      ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-offset-slate-800 dark:ring-white'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

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
              className="rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Adicionar Lembrete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
