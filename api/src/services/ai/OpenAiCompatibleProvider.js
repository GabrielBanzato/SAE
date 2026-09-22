const OpenAI = require('openai');
const AiProvider = require('./AiProvider');

const MODELO_PADRAO_OPENAI = 'gpt-4o-mini';
const MODELO_PADRAO_OLLAMA = 'qwen2.5';

/**
 * Provedor unico que atende tanto a OpenAI de verdade quanto qualquer
 * servidor compativel com a API dela (Ollama, LM Studio, Groq, etc) - o
 * SDK oficial "openai" ja aceita um `baseURL` customizado, entao NAO
 * existe uma classe "OllamaProvider" separada aqui: seria codigo
 * duplicado fingindo ser 2 integracoes diferentes, quando na pratica e o
 * mesmo protocolo (Chat Completions) com config diferente. Uma classe
 * nova de verdade so faria sentido pra um provedor com um protocolo
 * REALMENTE diferente (ex.: Anthropic, Gemini) - e ai o contrato
 * `AiProvider` (padrao Strategy) ja deixa esse encaixe pronto, sem mudar
 * nada em quem consome `generateResponse`.
 *
 * Variaveis de ambiente:
 * - `AI_BASE_URL` (opcional): se omitida, o SDK usa o endpoint padrao da
 *   OpenAI de verdade. Se definida como `http://localhost:11434/v1`
 *   (endpoint OpenAI-compatible que o Ollama expoe), aponta pra um
 *   modelo local.
 * - `AI_API_KEY`: obrigatoria pra OpenAI de verdade. O Ollama local nao
 *   valida a chave, mas o SDK exige o campo preenchido mesmo assim - por
 *   isso o fallback pra uma string qualquer quando `AI_BASE_URL` esta
 *   setada (ver constructor).
 * - `AI_MODEL` (opcional - nao fazia parte do pedido original de 2
 *   variaveis, mas e necessaria pra decidir qual modelo chamar em cada
 *   servidor; documentado aqui pra nao parecer uma omissao). Se omitida:
 *   usa "gpt-4o-mini" quando `AI_BASE_URL` tambem estiver vazia (OpenAI),
 *   ou "qwen2.5" quando `AI_BASE_URL` estiver setada (assume um Ollama
 *   local rodando Qwen, como pedido). O nome exato do modelo baixado no
 *   Ollama de cada maquina pode variar (ex.: "qwen2.5:7b-instruct"), por
 *   isso da pra sobrescrever via `AI_MODEL` quando o padrao nao bater.
 */
class OpenAiCompatibleProvider extends AiProvider {
  constructor() {
    super();

    const baseURL = process.env.AI_BASE_URL || undefined;

    // Fallback sempre presente (nao so no ramo Ollama) - o SDK da OpenAI
    // lanca na hora de CONSTRUIR o client se `apiKey` vier `undefined`
    // (nao so quando chamado). Como este provedor e instanciado 1 vez no
    // module-load de services/ai/index.js, um `.env` sem AI_API_KEY (comum
    // em dev, ver .env.example) derrubaria o boot inteiro da API assim que
    // qualquer rota importasse services/ai - mesmo sem nunca chamar
    // generateResponse de verdade. Com o fallback, o erro real (401 da
    // OpenAI por chave invalida) so aparece na hora de uma chamada de fato.
    this.client = new OpenAI({
      apiKey: process.env.AI_API_KEY || (baseURL ? 'ollama-nao-valida-chave' : 'chave-nao-configurada'),
      baseURL,
    });

    this.model = process.env.AI_MODEL || (baseURL ? MODELO_PADRAO_OLLAMA : MODELO_PADRAO_OPENAI);
  }

  async generateResponse(systemPrompt, userMessage) {
    const resposta = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    return resposta.choices[0]?.message?.content ?? '';
  }
}

module.exports = OpenAiCompatibleProvider;
