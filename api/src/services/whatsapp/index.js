const WhatsAppProvider = require('./WhatsAppProvider');
const BaileysProvider = require('./BaileysProvider');
const MetaApiProvider = require('./MetaApiProvider');

const PROVEDORES = {
  baileys: BaileysProvider,
  meta: MetaApiProvider,
};

/**
 * Fabrica do provedor ativo de WhatsApp (padrao Strategy/Adapter),
 * decidido por `WHATSAPP_PROVIDER` no `.env` - "baileys" (padrao, QR
 * Code) ou "meta" (API oficial). Quem for consumir WhatsApp na aplicacao
 * deve sempre chamar `getWhatsAppProvider()` e usar so os 3 metodos do
 * contrato (`initialize`/`sendMessage`/`onMessageReceived`) - nunca
 * importar `BaileysProvider`/`MetaApiProvider` direto, pra nao acoplar
 * no provedor especifico (trocar de provedor vira so uma mudanca de
 * variavel de ambiente, sem tocar em codigo).
 *
 * Nao e um singleton de proposito (cada chamada devolve uma instancia
 * nova) - quando a implementacao real existir, quem for manter a sessao
 * viva (ex.: um plugin do Fastify no boot da API) decide guardar essa
 * instancia uma unica vez; a fabrica em si so decide QUAL classe usar.
 */
function getWhatsAppProvider() {
  const nome = (process.env.WHATSAPP_PROVIDER || 'baileys').toLowerCase();
  const Provider = PROVEDORES[nome];

  if (!Provider) {
    throw new Error(
      `WHATSAPP_PROVIDER invalido: "${nome}". Use um dos seguintes: ${Object.keys(PROVEDORES).join(', ')}.`
    );
  }

  return new Provider();
}

module.exports = { getWhatsAppProvider, WhatsAppProvider };
