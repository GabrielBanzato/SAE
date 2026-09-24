const agendaController = require('../controllers/agenda.controller');

module.exports = async function agendaRoutes(fastify) {
  // Nenhuma rota aqui declara config.public -> passa pelo hook global de
  // autenticacao (src/plugins/auth.js), igual todo o resto da API.
  fastify.get('/:mes_ano', { preHandler: fastify.requirePermission('VER_AGENDA') }, agendaController.listarPorMes);
};
