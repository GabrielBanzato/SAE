const tarefasController = require('../controllers/tarefas.controller');

module.exports = async function tarefasRoutes(fastify) {
  // Sem config.public -> passa pelo hook global de autenticacao, exige JWT valido.
  fastify.get('/', tarefasController.list);
  fastify.post('/', tarefasController.create);
  fastify.put('/:id', tarefasController.update);
  fastify.delete('/:id', tarefasController.remove);
};
