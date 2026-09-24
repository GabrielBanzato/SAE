import { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import CampoTexto from '../CampoTexto';
import { apiFetch } from '../../services/api';

// Espelha TAMANHO_MIN_SENHA em api/src/services/auth.service.js.
const TAMANHO_MIN_SENHA = 8;

/**
 * Formulario de troca da PROPRIA senha (PUT /auth/senha) - usado pela tela
 * obrigatoria pos-convite/redefinicao (pages/TrocarSenhaObrigatoria.jsx) e
 * pelo "Alterar senha" do menu (pages/AlterarSenha.jsx). Pede a senha atual
 * (inclusive a temporaria): a API exige, pra um token roubado sozinho nao
 * bastar pra sequestrar a conta. Validacoes locais sao so feedback rapido -
 * a API valida de novo.
 */
export default function FormAlterarSenha({ rotuloSenhaAtual = 'Senha atual', rotuloBotao = 'Salvar nova senha', onSucesso }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (novaSenha.length < TAMANHO_MIN_SENHA) {
      setErro(`A nova senha precisa ter pelo menos ${TAMANHO_MIN_SENHA} caracteres.`);
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro('A confirmação não bate com a nova senha.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await apiFetch('/auth/senha', {
        method: 'PUT',
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
      });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacao('');
      onSucesso?.();
    } catch (err) {
      setErro(err.message || 'Não foi possível alterar a senha.');
    } finally {
      setSalvando(false);
    }
  }

  const tipo = mostrar ? 'text' : 'password';
  const botaoMostrar = (
    <button
      type="button"
      onClick={() => setMostrar((atual) => !atual)}
      aria-label={mostrar ? 'Ocultar senhas' : 'Mostrar senhas'}
      className="shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
    >
      {mostrar ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <CampoTexto
        label={rotuloSenhaAtual}
        icon={Lock}
        type={tipo}
        autoComplete="current-password"
        value={senhaAtual}
        onChange={(event) => setSenhaAtual(event.target.value)}
        required
        autoFocus
        endAdornment={botaoMostrar}
      />
      <CampoTexto
        label="Nova senha"
        icon={KeyRound}
        type={tipo}
        autoComplete="new-password"
        value={novaSenha}
        onChange={(event) => setNovaSenha(event.target.value)}
        placeholder={`Mínimo ${TAMANHO_MIN_SENHA} caracteres`}
        maxLength={72}
        required
      />
      <CampoTexto
        label="Confirme a nova senha"
        icon={KeyRound}
        type={tipo}
        autoComplete="new-password"
        value={confirmacao}
        onChange={(event) => setConfirmacao(event.target.value)}
        maxLength={72}
        required
        error={confirmacao && confirmacao !== novaSenha ? 'As senhas não são iguais.' : ''}
      />

      {erro && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {salvando && <Loader2 size={20} className="animate-spin" aria-hidden="true" />}
        {rotuloBotao}
      </button>
    </form>
  );
}
