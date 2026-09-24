import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

const TIPOS_PROBLEMA = [
  { value: 'bug', label: 'Bug (algo não está funcionando)', rotuloCurto: 'Bug' },
  { value: 'duvida', label: 'Dúvida', rotuloCurto: 'Dúvida' },
  { value: 'sugestao', label: 'Sugestão', rotuloCurto: 'Sugestão' },
];

const TAMANHO_MAX_TITULO = 80;

/** Mesma linguagem visual dos campos de DadosDaLoja.jsx/Assinatura.jsx (borda 2px, foco azul, texto grande). */
function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">{label}</span>
      {children}
    </label>
  );
}

const classesInput =
  'mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-blue-400';

/** "Bug: <inicio da descricao>" - `ChamadoSuporte` nao tem campo `tipo` proprio, o tipo vai no titulo. */
function montarTitulo(tipo, descricao) {
  const rotuloTipo = TIPOS_PROBLEMA.find((item) => item.value === tipo)?.rotuloCurto || 'Chamado';
  const resumo = descricao.trim().replace(/\s+/g, ' ');
  const cortado = resumo.length > TAMANHO_MAX_TITULO ? `${resumo.slice(0, TAMANHO_MAX_TITULO)}…` : resumo;
  return `${rotuloTipo}: ${cortado}`;
}

/**
 * Formulario de abertura de chamado (extraido de pages/Suporte.jsx na
 * reestruturacao de 2026-09-23 - a pagina virou so composicao).
 *
 * "ID da Loja" = `empresa.codigoLoja` (codigo de 5 digitos da EMPRESA, igual
 * pra toda a equipe - correcao de 2026-09-24; antes era o codigo pessoal do
 * usuario). `readOnly` e so UX: o backend (`chamados.controller.js#create`)
 * nao le nenhum id do corpo - a empresa vem do `tenantId` e quem abriu vem
 * do `userId`, ambos do token.
 */
export default function FormularioChamado({ usuario, codigoLoja, onEnviado }) {
  const [nome, setNome] = useState(usuario?.nome || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [tipo, setTipo] = useState('duvida');
  const [descricao, setDescricao] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!descricao.trim()) {
      setErro('Descreva o problema antes de enviar.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      await apiFetch('/chamados', {
        method: 'POST',
        body: JSON.stringify({ titulo: montarTitulo(tipo, descricao), descricao: descricao.trim() }),
      });
      setEnviado(true);
      onEnviado?.();
    } catch (err) {
      setErro(err.message || 'Não foi possível enviar o chamado agora.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          <CheckCircle2 size={32} aria-hidden="true" />
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Mensagem enviada!</h2>
        <p className="max-w-sm text-lg text-slate-500 dark:text-slate-400">
          Recebemos sua mensagem. Acompanhe o andamento em "Meus Chamados", logo abaixo.
        </p>
        <button
          type="button"
          onClick={() => {
            setEnviado(false);
            setDescricao('');
          }}
          className="mt-2 text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Abrir outro chamado
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Campo label="ID da Loja">
        <input
          type="text"
          value={codigoLoja ?? 'Carregando...'}
          readOnly
          aria-readonly="true"
          title="Preenchido automaticamente - identifica a sua loja para a nossa equipe de suporte."
          className={`${classesInput} cursor-not-allowed bg-slate-100 font-mono tracking-widest text-slate-500 dark:bg-slate-900/60 dark:text-slate-400`}
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo label="Nome">
          <input
            type="text"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Seu nome completo"
            required
            className={classesInput}
          />
        </Campo>

        <Campo label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@seunegocio.com.br"
            required
            className={classesInput}
          />
        </Campo>
      </div>

      <Campo label="Tipo de Problema">
        <select value={tipo} onChange={(event) => setTipo(event.target.value)} className={classesInput}>
          {TIPOS_PROBLEMA.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Descrição">
        <textarea
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
          placeholder="Descreva com o máximo de detalhes possível: o que você esperava que acontecesse e o que aconteceu de fato."
          required
          rows={5}
          maxLength={1000}
          className={`${classesInput} resize-none`}
        />
        <span className="mt-1 block text-right text-xs text-slate-400 dark:text-slate-500">{descricao.length}/1000</span>
      </Campo>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-xl font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <Send size={20} aria-hidden="true" />
        {enviando ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
}
