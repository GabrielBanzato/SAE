const authController = require('../controllers/auth.controller');

module.exports = async function authRoutes(fastify) {
  // Publicas: precisam escapar do hook global de autenticacao.
  fastify.post('/register', { config: { public: true } }, authController.register);
  fastify.post('/login', { config: { public: true } }, authController.login);
  // Autenticada (sem config.public) - reidrata o usuario logado no frontend.
  fastify.get('/me', authController.me);
};
