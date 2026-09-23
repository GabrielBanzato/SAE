import { useEffect, useState } from 'react';
import { X, Gift, Heart, Loader2, Ban } from 'lucide-react';
import { apiFetch } from '../../services/api';

// Espelha `VALOR_MINIMO_DOACAO` de api/src/services/superadmin.service.js.
const VALOR_MINIMO_DOACAO = 10;

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(valor) {
  return valor ? new Date(valor).toLocaleDateString('pt-BR') : '-';
}

/** "Doador há X dias/meses/anos", a partir de `doadorDesde` - ISO cru vindo da API, calculado aqui (mesmo padrao de formatacao de data feita no frontend usado no resto do app). */
function formatarTempoComoDoador(desde) {
  if (!desde) return null;
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);
  if (dias < 1) return 'Doador há menos de 1 dia';
  if (dias < 30) return `Doador há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;

  const meses = Math.floor(dias / 30);
  if (meses < 12) return `Doador há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;

  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  const parteAnos = `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return mesesRestantes === 0 ? `Doador há ${parteAnos}` : `Doador há ${parteAnos} e ${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`;
}

function BadgeStatusDoacao({ status }) {
  const estilos = {
    PAGO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ATRASADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  const rotulo = { PAGO: 'Pago', ATRASADO: 'Atrasado' };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${estilos[status]}`}>
      {rotulo[status]}
    </span>
  );
}

/** Estado A - empresa AINDA NAO e doadora: formulario pra tornar. */
function EstadoNaoDoador({ salvando, erro, onConfirmar }) {
  const [valor, setValor] = useState('');
  const [erroValor, setErroValor] = useState('');

  // Minimo de R$10,00 (correcao de bug, 2026-09-23) - o `min` do input
  // sozinho nao bastava (so vale no submit nativo, e era 0.01). Checado
  // aqui E no backend (superadmin.controller/service - fonte de verdade).
  const numero = Number(valor);
  const valorValido = valor !== '' && Number.isFinite(numero) && numero >= VALOR_MINIMO_DOACAO;

  function handleSubmit(event) {
    event.preventDefault();
    if (!valorValido) {
      setErroValor('O valor mínimo da doação é R$ 10,00.');
      return;
    }
    setErroValor('');
    onConfirmar(numero);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/40">
        <Heart size={24} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Esta empresa ainda não é doadora da plataforma.
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Valor Mensal da Doação</span>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-4 py-2.5 focus-within:border-purple-500 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-purple-400">
          <span className="text-slate-400 dark:text-slate-500">R$</span>
          <input
            type="number"
            step="0.01"
            min={VALOR_MINIMO_DOACAO}
            required
            autoFocus
            value={valor}
            onChange={(event) => {
              setValor(event.target.value);
              setErroValor('');
            }}
            placeholder="10,00"
            aria-invalid={Boolean(erroValor)}
            className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none dark:text-slate-100"
          />
          <span className="text-sm text-slate-400 dark:text-slate-500">/mês</span>
        </div>
        <span className="mt-1.5 block text-xs text-slate-400 dark:text-slate-500">Valor mínimo: R$ 10,00</span>
      </label>

      {(erroValor || erro) && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erroValor || erro}
        </p>
      )}

      <button
        type="submit"
        disabled={salvando || !valorValido}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-6 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {salvando ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Gift size={20} aria-hidden="true" />}
        Tornar Doador
      </button>
    </form>
  );
}

/** Estado B - empresa JA e doadora: status + acao de remover. */
function EstadoDoador({ dados, salvando, erro, onRemover }) {
  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-center gap-3 rounded-2xl bg-purple-50 p-4 dark:bg-purple-950/20">
        <Heart size={24} className="shrink-0 fill-purple-600 text-purple-600 dark:fill-purple-400 dark:text-purple-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-purple-700 dark:text-purple-300">Doador ativo</p>
          <p className="text-sm text-purple-600/80 dark:text-purple-400/80">{formatarTempoComoDoador(dados.doadorDesde)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Valor mensal</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">{formatarMoeda(dados.valorContribuicao)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Status</p>
          <div className="mt-1.5">
            <BadgeStatusDoacao status={dados.status} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Próximo vencimento</p>
        <p className="mt-1 text-base font-semibold text-slate-700 dark:text-slate-200">{formatarData(dados.doadorProximoVencimento)}</p>
      </div>

      {erro && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={onRemover}
        disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-300 px-6 py-3 text-base font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        {salvando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Ban size={18} aria-hidden="true" />}
        Remover status de Doador
      </button>
    </div>
  );
}

/**
 * "Modal de Gestão de Doadores" (Painel Master - Etapa 3, 2026-09-23) -
 * substitui o toggle direto que a aba Empresas/Clientes tinha antes (clicar
 * no ícone de presente já virava/desvirava doador na hora, sem confirmação
 * nem detalhe nenhum). Dados carregados via `GET .../doador` na abertura -
 * decide sozinho entre Estado A (`EstadoNaoDoador`) e Estado B
 * (`EstadoDoador`) a partir de `dados.isDoador`.
 *
 * `PUT .../doador` faz as duas ações (tornar E remover) - `is_doador` no
 * corpo decide qual; `valor_contribuicao` só é exigido (e só é lido pelo
 * backend) quando `is_doador: true` (ver `superadminService.definirDoador`).
 */
export default function ModalDoador({ empresa, onFechar, onAtualizado }) {
  const [dados, setDados] = useState(null);
  const [erroCarregar, setErroCarregar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState('');

  function carregar() {
    apiFetch(`/superadmin/empresas/${empresa.id}/doador`)
      .then(setDados)
      .catch((err) => setErroCarregar(err.message || 'Não foi possível carregar os dados de doação.'));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa.id]);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !salvando) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, salvando]);

  async function tornarDoador(valorContribuicao) {
    setErroAcao('');
    setSalvando(true);
    try {
      await apiFetch(`/superadmin/empresas/${empresa.id}/doador`, {
        method: 'PUT',
        body: JSON.stringify({ is_doador: true, valor_contribuicao: valorContribuicao }),
      });
      carregar();
      onAtualizado?.();
    } catch (err) {
      setErroAcao(err.message || 'Não foi possível tornar esta empresa doadora.');
    } finally {
      setSalvando(false);
    }
  }

  async function removerDoador() {
    setErroAcao('');
    setSalvando(true);
    try {
      await apiFetch(`/superadmin/empresas/${empresa.id}/doador`, {
        method: 'PUT',
        body: JSON.stringify({ is_doador: false }),
      });
      carregar();
      onAtualizado?.();
    } catch (err) {
      setErroAcao(err.message || 'Não foi possível remover o status de doador.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !salvando && onFechar()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-doador"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-doador" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Gestão de Doadores
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{empresa.nomeLoja || empresa.razaoSocial}</p>

        {erroCarregar && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erroCarregar}
          </p>
        )}

        {dados === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
            <Loader2 size={24} className="animate-spin" aria-hidden="true" />
            Carregando...
          </div>
        ) : dados.isDoador ? (
          <EstadoDoador dados={dados} salvando={salvando} erro={erroAcao} onRemover={removerDoador} />
        ) : (
          <EstadoNaoDoador salvando={salvando} erro={erroAcao} onConfirmar={tornarDoador} />
        )}
      </div>
    </div>
  );
}
