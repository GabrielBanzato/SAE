const AiProvider = require('./AiProvider');
const OpenAiCompatibleProvider = require('./OpenAiCompatibleProvider');

// Instancia unica do provedor configurado - o cliente do SDK so guarda
// config (nao abre conexao nenhuma no momento da criacao), entao e seguro
// instanciar aqui uma vez so e reaproveitar em toda chamada. Trocar de
// provedor no futuro (ex.: um dia usar Anthropic em vez de qualquer
// endpoint OpenAI-compatible) e so trocar esta linha - quem consome
// `generateResponse` abaixo nao muda.
const provider = new OpenAiCompatibleProvider();

/**
 * Funcao simples pedida pra esta tarefa: gera uma resposta de texto a
 * partir de um prompt de sistema + mensagem do usuario, delegando pro
 * provedor de IA configurado via env (ver OpenAiCompatibleProvider.js).
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
async function generateResponse(systemPrompt, userMessage) {
  return provider.generateResponse(systemPrompt, userMessage);
}

module.exports = { generateResponse, AiProvider };
