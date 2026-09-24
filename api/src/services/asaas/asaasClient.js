const AppError = require('../../utils/AppError');

/**
 * Cliente HTTP minimo da API v3 do Asaas (2026-09-24) - so os endpoints que
 * o checkout de assinaturas usa. Sem SDK (nao existe um oficial pra Node) e
 * sem dependencia nova: `fetch` nativo do Node 20.
 *
 * Configuracao (variaveis de ambiente, NUNCA no codigo/repo):
 *   ASAAS_API_KEY  - chave da conta ($aact_...). Sem ela, `asaasConfigurado()`
 *                    e false e o checkout real responde 503.
 *   ASAAS_API_URL  - padrao SANDBOX (https://api-sandbox.asaas.com/v3). Em
 *                    producao: https://api.asaas.com/v3 (troca explicita -
 *                    nunca cai em producao por acidente).
 *
 * Erros do Asaas ({ errors: [{ code, description }] }) viram AppError 502
 * com a `description` dele (ex.: CPF/CNPJ invalido, valor abaixo do minimo)
 * - o frontend mostra a mensagem real, nao um "erro interno" generico.
 */

const URL_PADRAO_SANDBOX = 'https://api-sandbox.asaas.com/v3';
const TIMEOUT_MS = 15000;

function asaasConfigurado() {
  return Boolean(process.env.ASAAS_API_KEY);
}

async function chamarAsaas(metodo, caminho, corpo) {
  if (!asaasConfigurado()) {
    throw new AppError('Pagamentos online ainda nao estao configurados neste servidor.', 503);
  }
  const base = (process.env.ASAAS_API_URL || URL_PADRAO_SANDBOX).replace(/\/+$/, '');

  let resposta;
  try {
    resposta = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        access_token: process.env.ASAAS_API_KEY,
        'User-Agent': 'SAE-Sistema-de-Apoio-Empresarial',
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // Rede/timeout - a chave NUNCA entra na mensagem (vai pro log).
    throw new AppError(`Nao foi possivel falar com o gateway de pagamento (${err.name}). Tente de novo.`, 502);
  }

  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    const descricao = dados?.errors?.map((e) => e.description).join(' ') || `HTTP ${resposta.status}`;
    // 401 do Asaas = chave errada/revogada: problema de configuracao nosso, nao do cliente.
    const status = resposta.status === 401 ? 503 : 502;
    throw new AppError(`Gateway de pagamento recusou a operacao: ${descricao}`, status);
  }
  return dados;
}

/** POST /customers - `externalReference` = id da empresa (rastreio no painel do Asaas). */
function criarCliente({ nome, cpfCnpj, email, empresaId }) {
  return chamarAsaas('POST', '/customers', {
    name: nome,
    cpfCnpj,
    email,
    externalReference: `empresa:${empresaId}`,
    // O SAE mostra o QR/pagina de pagamento na propria tela - sem e-mails/SMS do Asaas.
    notificationDisabled: true,
  });
}

/** POST /subscriptions - assinatura recorrente MENSAL; 1a cobranca vence hoje. */
function criarAssinatura({ customerId, billingType, valor, descricao, externalReference }) {
  const hoje = new Date().toISOString().slice(0, 10);
  return chamarAsaas('POST', '/subscriptions', {
    customer: customerId,
    billingType,
    value: valor,
    nextDueDate: hoje,
    cycle: 'MONTHLY',
    description: descricao,
    externalReference,
  });
}

function cancelarAssinatura(subscriptionId) {
  return chamarAsaas('DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

/** Cobrancas geradas por uma assinatura (a 1a e criada junto com ela). */
function listarCobrancasDaAssinatura(subscriptionId) {
  return chamarAsaas('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`);
}

/** GET /payments/{id}/pixQrCode -> { encodedImage (PNG base64), payload (copia e cola), expirationDate }. */
function obterQrCodePix(paymentId) {
  return chamarAsaas('GET', `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
}

module.exports = {
  asaasConfigurado,
  criarCliente,
  criarAssinatura,
  cancelarAssinatura,
  listarCobrancasDaAssinatura,
  obterQrCodePix,
};
