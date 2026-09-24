const superadminController = require('../controllers/superadmin.controller');
const { criarHandlersChat, BODY_LIMIT_MENSAGEM } = require('../controllers/chatChamado.controller');

const chatAdmin = criarHandlersChat({ admin: true });

/**
 * Painel Supra Admin (2026-09-22) - nivel mais alto do sistema, exclusivo
 * pro dono do software (`Usuario.nivelAcesso === 'SUPERADMIN'`).
 *
 * O hook abaixo e ESCOPADO a este plugin (encapsulamento do Fastify - um
 * `addHook` dentro de um `register()` so vale pras rotas registradas
 * aqui dentro, nao pro resto da API) e roda DEPOIS do hook global de JWT
 * (plugins/auth.js, ja populou `request.userNivelAcesso` a essa altura) -
 * ainda exige um JWT valido primeiro (nenhuma rota aqui declara
 * `config: { public: true }`), so adiciona a checagem extra de nivel de
 * acesso em cima disso.
 */
module.exports = async function superadminRoutes(fastify) {
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.userNivelAcesso !== 'SUPERADMIN') {
      reply.code(403).send({ error: 'Acesso restrito ao Supra Admin.' });
      return reply;
    }
  });

  // Aba "Empresas/Clientes"
  fastify.get('/empresas', superadminController.listarEmpresas);
  fastify.put('/empresas/:id/status', superadminController.atualizarStatusEmpresa);
  fastify.put('/empresas/:id/doador', superadminController.definirDoador);
  fastify.get('/empresas/:id/doador', superadminController.obterDadosDoador);
  fastify.put('/empresas/:id/pagamentos', superadminController.forcarPagamento);
  fastify.delete('/empresas/:id/pagamentos/:modulo', superadminController.restringirModulo);
  fastify.get('/empresas/:id/assinaturas', superadminController.obterAssinaturas);

  // Aba "Chamados de Suporte"
  fastify.get('/chamados', superadminController.listarChamados);
  fastify.put('/chamados/:id/status', superadminController.atualizarStatusChamado);
  // Chat de Suporte (2026-09-23) - mesmo handler do lojista, escopo = todos, remetente = ADMIN.
  fastify.get('/chamados/:id', chatAdmin.obter);
  fastify.post('/chamados/:id/mensagens', { bodyLimit: BODY_LIMIT_MENSAGEM }, chatAdmin.enviar);
  fastify.get('/chamados/:id/mensagens/:mensagemId/audio', chatAdmin.audio);

  // Aba "Configurações Globais"
  fastify.get('/configuracoes/precos', superadminController.obterPrecos);
  fastify.put('/configuracoes/precos', superadminController.atualizarPrecos);
};
