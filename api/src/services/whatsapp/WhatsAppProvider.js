/**
 * Contrato (padrao Strategy/Adapter) que todo provedor de WhatsApp
 * precisa implementar - permite trocar Baileys (QR Code, nao oficial)
 * pela API oficial da Meta (Cloud API) sem mudar nada em quem consome
 * esse servico (ex.: o futuro modulo de IA no WhatsApp), so a config
 * (`WHATSAPP_PROVIDER`, ver index.js).
 */
class WhatsAppProvider {
  /** Abre a sessao/conexao com o WhatsApp (ex.: exibir o QR Code, ou validar o token da Meta). */
  async initialize() {
    throw new Error('initialize() precisa ser implementado pelo provedor concreto.');
  }

  /**
   * Envia uma mensagem de texto.
   * @param {string} to - numero de destino (formato E.164, ex.: "5511999999999").
   * @param {string} text
   */
  async sendMessage(to, text) {
    throw new Error('sendMessage(to, text) precisa ser implementado pelo provedor concreto.');
  }

  /**
   * Registra um callback pra ser chamado a cada mensagem recebida.
   * @param {(mensagem: { from: string, text: string }) => void} callback
   */
  onMessageReceived(callback) {
    throw new Error('onMessageReceived(callback) precisa ser implementado pelo provedor concreto.');
  }
}

module.exports = WhatsAppProvider;
