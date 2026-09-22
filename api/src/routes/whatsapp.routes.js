const whatsappController = require('../controllers/whatsapp.controller');

module.exports = async function whatsappRoutes(fastify) {
  // Publica - chamada pelo provedor de WhatsApp (Baileys/Meta), nao por um usuario logado
  // (nao existe sessao/JWT nesse momento). Tenant identificado pela propria URL.
  fastify.post('/webhook/:empresaId', { config: { public: true } }, whatsappController.webhook);

  // Sem config.public -> passam pelo hook global de autenticacao, exigem JWT valido.
  fastify.get('/atendimentos', whatsappController.listarAtendimentosAbertos);
  fastify.get('/atendimentos/:id/mensagens', whatsappController.listarMensagens);
  fastify.post('/atendimentos/:id/mensagens', whatsappController.enviarMensagemManual);
  fastify.patch('/atendimentos/:id/ia-ativa', whatsappController.alternarIaAtiva);
};
