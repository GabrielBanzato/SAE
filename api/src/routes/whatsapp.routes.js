const whatsappController = require('../controllers/whatsapp.controller');

module.exports = async function whatsappRoutes(fastify) {
  // Publica - chamada pelo provedor de WhatsApp (Baileys/Meta), nao por um usuario logado
  // (nao existe sessao/JWT nesse momento). Tenant identificado pela propria URL.
  fastify.post('/webhook/:empresaId', { config: { public: true } }, whatsappController.webhook);

  // Sem config.public -> passam pelo hook global de autenticacao, exigem JWT valido.
  // RBAC por rota (nao hook do plugin): o webhook acima e publico, sem usuario.
  fastify.get('/atendimentos', { preHandler: fastify.requirePermission('VER_INBOX') }, whatsappController.listarAtendimentosAbertos);
  fastify.get('/atendimentos/:id/mensagens', { preHandler: fastify.requirePermission('VER_INBOX') }, whatsappController.listarMensagens);
  fastify.post('/atendimentos/:id/mensagens', { preHandler: fastify.requirePermission('VER_INBOX') }, whatsappController.enviarMensagemManual);
  fastify.patch('/atendimentos/:id/ia-ativa', { preHandler: fastify.requirePermission('VER_INBOX') }, whatsappController.alternarIaAtiva);
};
