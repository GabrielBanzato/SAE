/**
 * Contrato (padrao Strategy) que todo provedor de IA precisa implementar.
 * Quem consome IA na aplicacao (ex.: o futuro modulo de atendimento via
 * WhatsApp) so deveria depender desta interface, nunca de um provedor
 * concreto - troca de provedor vira so uma mudanca de config, sem tocar
 * em quem consome.
 *
 * Metodos sao assincronos (`async`) porque toda chamada de IA de verdade
 * e uma requisicao de rede.
 */
class AiProvider {
  /**
   * Gera uma resposta de texto a partir de um prompt de sistema (define o
   * comportamento/persona) e a mensagem do usuario.
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @returns {Promise<string>}
   */
  async generateResponse(systemPrompt, userMessage) {
    throw new Error('generateResponse(systemPrompt, userMessage) precisa ser implementado pelo provedor concreto.');
  }
}

module.exports = AiProvider;
