import { useEffect, useState } from 'react';
import { LifeBuoy, Send, CheckCircle2, History, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

function formatarData(valor) {
  return new Date(valor).toLocaleDateString('pt-BR');
}

const TIPOS_PROBLEMA = [
  { value: 'bug', label: 'Bug (algo não está funcionando)', rotuloCurto: 'Bug' },
  { value: 'duvida', label: 'Dúvida', rotuloCurto: 'Dúvida' },
  { value: 'sugestao', label: 'Sugestão', rotuloCurto: 'Sugestão' },
];

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

/**
 * Helpdesk simples - desde o Painel Supra Admin (2026-09-22), "enviar" aqui
 * persiste de verdade via `POST /chamados` (`ChamadoSuporte`, ver
 * schema.prisma) e aparece na rota "Chamados de Suporte" do Painel Master
 * (`pages/superadmin/ChamadosSuporte.jsx`). `titulo` do chamado e composto do tipo escolhido +
 * inicio da descricao (o modelo `ChamadoSuporte` nao tem um campo `tipo`
 * proprio - so id/empresaId/titulo/descricao/status/data, pedido explicito
 * da tarefa) - `nome`/`email` continuam so locais (pre-preenchidos do
 * usuario logado, editaveis), a empresa de quem abriu o chamado ja fica
 * registrada via `empresaId` (tenant do token), sem precisar duplicar isso
 * no chamado.
 *
 * "Seu ID" (Ajuste no Formulario de Suporte, 2026-09-23) - mostra
 * `usuario.codigoUsuario` (o codigo de 5 digitos, ja disponivel no
 * AuthContext desde o login/registro - ver auth.service.js), NAO o `id`
 * interno (autoincrement do banco) - o codigo de 5 digitos foi feito
 * justamente pra esse cenario (ver comentario dele em schema.prisma:
 * "suporte confirmando identidade por telefone"), mais curto e sem expor
 * um identificador tecnico do banco pro usuario final. Campo `readOnly` de
 * proposito - so uma cortesia de UX (evita erro de digitação), NAO uma
 * fronteira de seguranca: o backend (`chamados.controller.js#create`)
 * ignora qualquer valor de usuario mandado no corpo da requisicao, sempre
 * usa `request.userId` (do token) - ver comentario la.
 */
export default function Suporte() {
  const { usuario } = useAuth();

  const [nome, setNome] = useState(usuario?.nome || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [tipo, setTipo] = useState('duvida');
  const [descricao, setDescricao] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // "Meus Chamados" (correcao de bug, 2026-09-23) - antes desta correcao
  // nao existia NENHUMA tela pro lojista ver seus proprios chamados depois
  // de enviados (so o Supra Admin via a lista completa, de todas as
  // empresas) - GET /chamados (tenant-scoped, ja existia no backend desde
  // a tarefa original) nunca tinha um consumidor no frontend.
  const [meusChamados, setMeusChamados] = useState(null);
  const [erroLista, setErroLista] = useState('');

  function carregarMeusChamados() {
    apiFetch('/chamados')
      .then(setMeusChamados)
      .catch((err) => setErroLista(err.message || 'Não foi possível carregar seus chamados anteriores.'));
  }

  useEffect(() => {
    carregarMeusChamados();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setEnviando(true);

    const rotuloTipo = TIPOS_PROBLEMA.find((item) => item.value === tipo)?.rotuloCurto || 'Chamado';
    const titulo = `${rotuloTipo}: ${descricao.slice(0, 80)}${descricao.length > 80 ? '…' : ''}`;

    try {
      await apiFetch('/chamados', {
        method: 'POST',
        // `usuario_codigo` vai no corpo so por transparencia (visivel na aba
        // de rede, confere o que foi enviado) - o backend NAO confia nele,
        // sempre deriva o usuario real do token (ver comentario acima).
        body: JSON.stringify({ titulo, descricao, usuario_codigo: usuario?.codigoUsuario }),
      });
      setEnviado(true);
      carregarMeusChamados();
    } catch (err) {
      setErro(err.message || 'Não foi possível enviar o chamado agora.');
    } finally {
      setEnviando(false);
    }
  }

  function handleNovoChamado() {
    setEnviado(false);
    setDescricao('');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <LifeBuoy size={30} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Suporte
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
          Encontrou um problema ou tem alguma dúvida? Conta pra gente.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-8">
        {enviado ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <CheckCircle2 size={32} aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Mensagem enviada!</h2>
            <p className="max-w-sm text-lg text-slate-500 dark:text-slate-400">
              Recebemos sua mensagem e nossa equipe vai entrar em contato pelo e-mail informado em breve.
            </p>
            <button
              type="button"
              onClick={handleNovoChamado}
              className="mt-2 text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Abrir outro chamado
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Campo label="Seu ID">
              <input
                type="text"
                value={usuario?.codigoUsuario || '-----'}
                readOnly
                aria-readonly="true"
                title="Preenchido automaticamente - identifica você para nossa equipe de suporte."
                className={`${classesInput} cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400`}
              />
            </Campo>

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
                className={`${classesInput} resize-none`}
              />
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
        )}
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
          <History size={22} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          Meus Chamados
        </h2>

        {erroLista && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erroLista}
          </p>
        )}

        {meusChamados === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400 dark:text-slate-500">
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            Carregando...
          </div>
        ) : meusChamados.length === 0 ? (
          <p className="py-6 text-center text-base text-slate-400 dark:text-slate-500">
            Você ainda não abriu nenhum chamado.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 pr-4 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    ID
                  </th>
                  <th className="py-2 pr-4 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Assunto
                  </th>
                  <th className="py-2 pr-4 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Data
                  </th>
                  <th className="py-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {meusChamados.map((chamado) => (
                  <tr key={chamado.id}>
                    <td className="py-3 pr-4 font-mono text-sm font-semibold text-slate-400 dark:text-slate-500">
                      #{chamado.id}
                    </td>
                    <td className="py-3 pr-4 text-base font-medium text-slate-800 dark:text-slate-200">
                      {chamado.titulo}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-500 dark:text-slate-400">
                      {formatarData(chamado.criadoEm)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          chamado.status === 'ABERTO'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}
                      >
                        {chamado.status === 'ABERTO' ? 'Aberto' : 'Resolvido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
