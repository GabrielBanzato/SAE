const chamadosController = require('../controllers/chamados.controller');
const { criarHandlersChat, BODY_LIMIT_MENSAGEM } = require('../controllers/chatChamado.controller');

// Chat do lojista - escopo = empresa do token, remetente = LOJISTA (ver chatChamado.controller.js).
const chat = criarHandlersChat({ admin: false });

module.exports = async function chamadosRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', chamadosController.list);
  fastify.post('/', chamadosController.create);

  // Chat de Suporte (2026-09-23)
  fastify.get('/:id', chat.obter);
  // bodyLimit maior SO nesta rota - audio chega em base64 dentro do JSON.
  fastify.post('/:id/mensagens', { bodyLimit: BODY_LIMIT_MENSAGEM }, chat.enviar);
  fastify.get('/:id/mensagens/:mensagemId/audio', chat.audio);
};
