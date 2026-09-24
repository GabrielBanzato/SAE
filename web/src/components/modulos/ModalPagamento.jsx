import { useEffect, useState } from 'react';
import { QrCode, CreditCard, X, Loader2, Copy, Check, CheckCircle2, ExternalLink, Clock, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../services/api';
import usePollingAssinatura from './usePollingAssinatura';

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarExpiracao(valor) {
  if (!valor) return null;
  const data = new Date(String(valor).replace(' ', 'T'));
  return Number.isNaN(data.getTime()) ? null : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const TEMPO_FECHAR_APOS_SUCESSO_MS = 2500;

/**
 * Checkout REAL de um modulo da App Store via Asaas (2026-09-24) -
 * substituiu o checkout simulado. Etapas (`etapa`):
 *
 *  - 'escolha': preco (o EXIBIDO vem do pai; o COBRADO e recalculado no
 *               backend - `valor` da resposta e a fonte da verdade) e os 2
 *               botoes. Clique -> POST /assinaturas/checkout.
 *  - 'pix':     QR Code (PNG base64 da API -> <img src="data:image/png;base64,...">)
 *               + "copia e cola" + short polling do status.
 *  - 'cartao':  pagina de pagamento HOSPEDADA pelo Asaas (invoiceUrl) numa
 *               nova aba - o numero do cartao e digitado la, nunca passa
 *               pelo SAE (fora do escopo PCI) - + o mesmo polling.
 *  - 'sucesso': webhook confirmou (status ATIVA) -> mensagem e fecha sozinho,
 *               avisando o pai (`onConcluido`, que atualiza a App Store/menu).
 *
 * Fechar enquanto espera e permitido: se a pessoa pagar depois, o webhook
 * libera o modulo do mesmo jeito (a tela so nao acompanha ao vivo).
 */
export default function ModalPagamento({ modulo, planoIa, nome, preco, precoComDesconto, isDoador, onFechar, onConcluido }) {
  const [etapa, setEtapa] = useState('escolha');
  const [formaEmAndamento, setFormaEmAndamento] = useState(null); // 'PIX' | 'CARTAO' durante o POST
  const [checkout, setCheckout] = useState(null); // resposta da API
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  const aguardandoPagamento = etapa === 'pix' || etapa === 'cartao';
  const precoExibido = checkout?.valor ?? (isDoador ? precoComDesconto : preco);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape' && !formaEmAndamento) onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar, formaEmAndamento]);

  usePollingAssinatura(checkout?.assinaturaId, aguardandoPagamento, {
    onConfirmado: () => setEtapa('sucesso'),
  });

  // Sucesso: mostra a confirmacao por um instante e fecha sozinho.
  useEffect(() => {
    if (etapa !== 'sucesso') return undefined;
    const timer = setTimeout(() => onConcluido?.(), TEMPO_FECHAR_APOS_SUCESSO_MS);
    return () => clearTimeout(timer);
  }, [etapa, onConcluido]);

  async function iniciar(forma) {
    setErro('');
    setFormaEmAndamento(forma);
    // Cartao: a aba e aberta AGORA, dentro do clique (senao o bloqueador de
    // pop-up do navegador barra o window.open feito depois do await) e so
    // recebe o endereco quando a API responder.
    const novaAba = forma === 'CARTAO' ? window.open('', '_blank') : null;
    try {
      const resposta = await apiFetch('/assinaturas/checkout', {
        method: 'POST',
        body: JSON.stringify({ modulo, plano_ia: planoIa, forma }),
      });
      setCheckout(resposta);
      if (forma === 'CARTAO') {
        if (novaAba && resposta.invoiceUrl) novaAba.location.href = resposta.invoiceUrl;
        setEtapa('cartao');
      } else {
        setEtapa('pix');
      }
    } catch (err) {
      novaAba?.close();
      setErro(err.message || 'Não foi possível iniciar o pagamento agora.');
    } finally {
      setFormaEmAndamento(null);
    }
  }

  async function copiarPix() {
    try {
      await navigator.clipboard.writeText(checkout.pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro('Não foi possível copiar - selecione o código e copie manualmente.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !formaEmAndamento && etapa !== 'sucesso' && onFechar()}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-pagamento"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-pagamento" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {etapa === 'sucesso' ? 'Pagamento confirmado!' : `Assinar ${nome}`}
          </h2>
          {etapa !== 'sucesso' && (
            <button
              type="button"
              onClick={onFechar}
              disabled={Boolean(formaEmAndamento)}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              <X size={22} aria-hidden="true" />
            </button>
          )}
        </div>

        {etapa === 'sucesso' ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <CheckCircle2 size={36} aria-hidden="true" />
            </span>
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{nome} liberado!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Assinatura mensal de {formatarMoeda(precoExibido)} ativa. Fechando…
            </p>
          </div>
        ) : (
          <>
            {/* Preco (sempre visivel) */}
            <div className="mt-5 flex items-baseline gap-2">
              {isDoador && <s className="text-lg font-semibold text-slate-400 dark:text-slate-500">{formatarMoeda(preco)}</s>}
              <span
                className={`text-3xl font-extrabold ${
                  isDoador ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formatarMoeda(precoExibido)}
              </span>
              <span className="text-base font-medium text-slate-400 dark:text-slate-500">/mês</span>
            </div>
            {isDoador && (
              <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">Desconto de Apoiador (15%) já aplicado</p>
            )}

            {etapa === 'escolha' && (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => iniciar('PIX')}
                  disabled={Boolean(formaEmAndamento)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formaEmAndamento === 'PIX' ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <QrCode size={20} aria-hidden="true" />}
                  {formaEmAndamento === 'PIX' ? 'Gerando Pix...' : 'Pagar com Pix'}
                </button>
                <button
                  type="button"
                  onClick={() => iniciar('CARTAO')}
                  disabled={Boolean(formaEmAndamento)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 px-6 py-3 text-lg font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {formaEmAndamento === 'CARTAO' ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <CreditCard size={20} aria-hidden="true" />}
                  {formaEmAndamento === 'CARTAO' ? 'Abrindo pagamento...' : 'Pagar com Cartão'}
                </button>
                <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-slate-400 dark:text-slate-500">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Cobrança mensal recorrente, processada pelo Asaas. Cancele quando quiser.
                </p>
              </div>
            )}

            {etapa === 'pix' && checkout?.pix && (
              <div className="mt-6 space-y-4">
                <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-slate-200 p-4 dark:border-slate-700">
                  {/* QR Code: PNG em base64 vindo da API (campo encodedImage do Asaas). Fundo branco fixo - leitor de QR precisa de contraste, inclusive no modo escuro. */}
                  <img
                    src={`data:image/png;base64,${checkout.pix.qrCodeBase64}`}
                    alt="QR Code Pix para pagamento"
                    className="h-56 w-56 rounded-xl bg-white p-2"
                  />
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Escaneie com o app do seu banco</p>
                  {formatarExpiracao(checkout.pix.expiraEm) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Válido até {formatarExpiracao(checkout.pix.expiraEm)}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ou use o Pix copia e cola</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      readOnly
                      value={checkout.pix.copiaECola}
                      onFocus={(event) => event.target.select()}
                      aria-label="Código Pix copia e cola"
                      className="min-w-0 flex-1 truncate rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={copiarPix}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                      {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <p className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" role="status">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Aguardando o pagamento… esta janela fecha sozinha quando for confirmado.
                </p>
              </div>
            )}

            {etapa === 'cartao' && (
              <div className="mt-6 space-y-4">
                <p className="text-base text-slate-600 dark:text-slate-300">
                  Abrimos a página de pagamento segura do Asaas em uma nova aba. Os dados do cartão são digitados lá — não
                  passam pelo SAE.
                </p>
                {checkout?.invoiceUrl && (
                  <a
                    href={checkout.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 px-6 py-3 text-base font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <ExternalLink size={18} aria-hidden="true" />
                    Abrir a página de pagamento de novo
                  </a>
                )}
                <p className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" role="status">
                  <Clock size={16} aria-hidden="true" />
                  Aguardando a confirmação do cartão…
                </p>
              </div>
            )}

            {erro && (
              <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{erro}</p>
            )}

            {aguardandoPagamento && (
              <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
                Pode fechar esta janela: se você pagar depois, o módulo é liberado assim que o pagamento for confirmado.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
