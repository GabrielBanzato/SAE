const empresaController = require('../controllers/empresa.controller');

module.exports = async function empresaRoutes(fastify) {
  // Nenhuma rota aqui declara config.public -> todas passam pelo hook
  // global de autenticacao (src/plugins/auth.js), exigindo JWT valido.
  fastify.get('/dados', empresaController.obterDados);
  fastify.get('/usuarios', empresaController.listarUsuarios);
  fastify.post('/usuarios', empresaController.adicionarUsuario);
  fastify.put('/assinatura', empresaController.atualizarAssinatura);
};
