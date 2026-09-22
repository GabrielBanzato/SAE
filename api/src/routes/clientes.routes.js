const clientesController = require('../controllers/clientes.controller');

module.exports = async function clientesRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', clientesController.list);
  fastify.post('/', clientesController.create);
  fastify.put('/:id', clientesController.atualizar);
  fastify.get('/:id/perfil-360', clientesController.obterPerfil360);
};
