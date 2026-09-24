import { useEffect, useState } from 'react';
import { X, UserPlus, Mail, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../services/api';
import SenhaTemporaria from './SenhaTemporaria';

/**
 * "Convidar Usuario" (aba Equipe, RBAC 2026-09-24) - 2 passos:
 *
 *  1) Formulario: e-mail (obrigatorio), nome (opcional - a API usa o
 *     inicio do e-mail se vazio) e o PERFIL de acesso num select
 *     (GET /perfis). Sem nenhum perfil criado ainda, o select da lugar a um
 *     atalho pra aba "Perfis de Acesso" - convite sem perfil nao existe.
 *  2) Resultado: o sistema nao tem envio de e-mail, entao a API gera uma
 *     SENHA TEMPORARIA e a devolve UMA vez (POST /empresa/usuarios). Ela e
 *     mostrada aqui com botao de copiar e o aviso de que nao aparece de
 *     novo - o admin repassa pro funcionario.
 */
export default function ModalConvidarUsuario({ onFechar, onConvidado, onIrParaPerfis }) {
  const [perfis, setPerfis] = useState(null);
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [perfilId, setPerfilId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [convidado, setConvidado] = useState(null); // resposta da API (com senhaTemporaria)

  useEffect(() => {
    apiFetch('/perfis')
      .then((lista) => {
        setPerfis(lista);
        if (lista.length === 1) setPerfilId(String(lista[0].id));
      })
      .catch((err) => {
        setErro(err.message || 'Não foi possível carregar os perfis.');
        setPerfis([]);
      });
  }, []);

  // Depois do convite criado, so fecha pelo botao (X/Concluir) - um Esc ou
  // clique fora sem querer perderia a senha temporaria, que nao volta.
  const podeFecharSemQuerer = !enviando && !convidado;

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && podeFecharSemQuerer) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, podeFecharSemQuerer]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!perfilId) {
      setErro('Escolha o perfil de acesso da pessoa.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const resultado = await apiFetch('/empresa/usuarios', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), nome: nome.trim() || undefined, perfil_id: Number(perfilId) }),
      });
      setConvidado(resultado);
      onConvidado?.();
    } catch (err) {
      setErro(err.message || 'Não foi possível convidar esta pessoa.');
    } finally {
      setEnviando(false);
    }
  }

  const perfilSelecionado = perfis?.find((p) => String(p.id) === perfilId);
  const classesInput =
    'mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => podeFecharSemQuerer && onFechar()}
      role="presentation"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-convidar"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-convidar" className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            <UserPlus size={24} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {convidado ? 'Pessoa adicionada!' : 'Convidar Usuário'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {convidado ? (
          <div className="mt-6 space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <p className="text-base text-emerald-800 dark:text-emerald-200">
                <strong>{convidado.nome}</strong> já faz parte da equipe com o perfil <strong>{convidado.perfil?.nome}</strong>.
                Envie os dados de acesso abaixo para a pessoa.
              </p>
            </div>

            <SenhaTemporaria email={convidado.email} senha={convidado.senhaTemporaria} />

            <button
              type="button"
              onClick={onFechar}
              className="w-full rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Concluir
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <label className="block">
              <span className="text-base font-semibold text-slate-800 dark:text-slate-200">E-mail do funcionário</span>
              <div className="relative">
                <Mail size={20} className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="funcionario@email.com"
                  className={`${classesInput} pl-12`}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Nome <span className="font-normal text-slate-400">(opcional)</span>
              </span>
              <input
                type="text"
                value={nome}
                maxLength={120}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Como a pessoa aparece na equipe"
                className={classesInput}
              />
            </label>

            <div>
              <label htmlFor="perfil-convite" className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Perfil de acesso
              </label>
              {perfis === null ? (
                <p className="mt-2 flex items-center gap-2 text-slate-400">
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando perfis...
                </p>
              ) : perfis.length === 0 ? (
                <div className="mt-2 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                  Você ainda não criou nenhum perfil de acesso.{' '}
                  <button type="button" onClick={onIrParaPerfis} className="font-bold text-blue-600 hover:underline dark:text-blue-400">
                    Criar um perfil agora
                  </button>
                </div>
              ) : (
                <>
                  <select
                    id="perfil-convite"
                    required
                    value={perfilId}
                    onChange={(event) => setPerfilId(event.target.value)}
                    className={classesInput}
                  >
                    <option value="" disabled>
                      Selecione o perfil...
                    </option>
                    {perfis.map((perfil) => (
                      <option key={perfil.id} value={perfil.id}>
                        {perfil.nome}
                      </option>
                    ))}
                  </select>
                  {perfilSelecionado && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <ShieldCheck size={15} aria-hidden="true" />
                      {perfilSelecionado.permissoes.length} área(s) liberada(s) neste perfil
                    </p>
                  )}
                </>
              )}
            </div>

            {erro && <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onFechar}
                className="rounded-2xl px-5 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando || !perfis?.length}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
                Convidar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
