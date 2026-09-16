const WhatsAppProvider = require('./WhatsAppProvider');

/**
 * Provedor "Conexao Padrao" (QR Code, nao oficial) - corresponde a
 * modalidade "IA no WhatsApp - Conexao Padrao" da pagina de Modulos
 * (web/src/pages/Modulos.jsx). A biblioteca real
 * (`@whiskeysockets/baileys`) ainda NAO foi instalada nem conectada -
 * esta classe e so o encaixe/mock pedido nesta tarefa (arquitetura),
 * pronta pra receber a implementacao de verdade numa proxima tarefa
 * (gerar/renderizar o QR Code, manter a sessao viva, reconectar sozinha
 * se cair) sem precisar mudar a interface publica (`WhatsAppProvider`).
 */
class BaileysProvider extends WhatsAppProvider {
  constructor() {
    super();
    this._callback = null;
  }

  async initialize() {
    // TODO: instalar `@whiskeysockets/baileys`, abrir o socket, exibir o
    // QR Code (terminal ou base64 pro frontend escanear) e persistir as
    // credenciais da sessao (evitar escanear de novo a cada restart).
    console.log('[BaileysProvider] initialize() chamado (mock) - sessao real ainda nao implementada.');
  }

  async sendMessage(to, text) {
    // TODO: chamar `sock.sendMessage(jid, { text })` do Baileys de verdade.
    console.log(`[BaileysProvider] sendMessage() chamado (mock) para "${to}": "${text}"`);
  }

  onMessageReceived(callback) {
    // TODO: registrar este callback no listener de eventos real do
    // Baileys (`sock.ev.on('messages.upsert', ...)`), traduzindo o
    // payload dele pro formato `{ from, text }` do contrato.
    this._callback = callback;
    console.log('[BaileysProvider] onMessageReceived() registrado (mock) - nenhum evento real dispara ainda.');
  }
}

module.exports = BaileysProvider;
