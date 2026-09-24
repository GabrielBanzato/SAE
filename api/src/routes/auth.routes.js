const authController = require('../controllers/auth.controller');

module.exports = async function authRoutes(fastify) {
  // Publicas: precisam escapar do hook global de autenticacao.
  fastify.post('/register', { config: { public: true } }, authController.register);
  fastify.post('/login', { config: { public: true } }, authController.login);

  // Autenticadas, mas LIBERADAS com senha temporaria pendente (as unicas -
  // ver hook global em plugins/permissoes.js): o frontend precisa saber
  // quem e o usuario e deixa-lo definir a senha nova.
  const liberadaComSenhaTemporaria = { config: { permitidoComSenhaTemporaria: true } };
  fastify.get('/me', liberadaComSenhaTemporaria, authController.me);
  fastify.put('/senha', liberadaComSenhaTemporaria, authController.alterarSenha);
};
