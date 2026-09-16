const WhatsAppProvider = require('./WhatsAppProvider');

/**
 * Provedor "API Oficial Meta" (Cloud API) - corresponde a modalidade
 * "IA no WhatsApp - API Oficial Meta" da pagina de Modulos
 * (web/src/pages/Modulos.jsx). A integracao real (chamadas HTTP pra
 * `graph.facebook.com`, verificacao do webhook de recebimento) ainda NAO
 * foi implementada - esta classe e so o encaixe/mock pedido nesta tarefa
 * (arquitetura), pronta pra receber a implementacao de verdade numa
 * proxima tarefa sem precisar mudar a interface publica
 * (`WhatsAppProvider`).
 *
 * Quando for implementado de verdade, vai exigir credenciais da Meta
 * (token de acesso permanente, ID do numero de telefone, App Secret pra
 * validar o webhook) - variaveis de ambiente que ainda nao existem
 * porque nada aqui faz chamada real ainda (ver `.env.example`).
 */
class MetaApiProvider extends WhatsAppProvider {
  constructor() {
    super();
    this._callback = null;
  }

  async initialize() {
    // TODO: validar as credenciais (META_WHATSAPP_TOKEN/
    // META_PHONE_NUMBER_ID) fazendo uma chamada de teste na Graph API, e
    // registrar/confirmar o webhook de recebimento de mensagens.
    console.log('[MetaApiProvider] initialize() chamado (mock) - integracao real ainda nao implementada.');
  }

  async sendMessage(to, text) {
    // TODO: POST em
    // `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`
    // com o payload `{ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }`.
    console.log(`[MetaApiProvider] sendMessage() chamado (mock) para "${to}": "${text}"`);
  }

  onMessageReceived(callback) {
    // TODO: este provedor recebe mensagens via webhook HTTP (nao um
    // socket persistente como o Baileys) - a rota do webhook (ainda nao
    // criada) deveria chamar este callback registrado a cada payload
    // valido recebido da Meta, traduzido pro formato `{ from, text }`.
    this._callback = callback;
    console.log('[MetaApiProvider] onMessageReceived() registrado (mock) - nenhum evento real dispara ainda.');
  }
}

module.exports = MetaApiProvider;
