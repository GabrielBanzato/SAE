const assinaturasController = require('../controllers/assinaturas.controller');

/**
 * Webhooks de servicos externos - rotas PUBLICAS (sem JWT); cada uma se
 * autentica do seu jeito (ver o controller). URL a cadastrar no painel do
 * Asaas (Integracoes > Webhooks): https://<dominio-da-api>/webhooks/asaas
 */
module.exports = async function webhooksRoutes(fastify) {
  fastify.post('/asaas', { config: { public: true } }, assinaturasController.webhookAsaas);
};
