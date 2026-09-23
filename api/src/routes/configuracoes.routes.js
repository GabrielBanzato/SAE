const configuracoesController = require('../controllers/configuracoes.controller');

module.exports = async function configuracoesRoutes(fastify) {
  // Sem config.public -> exige JWT valido (qualquer usuario autenticado,
  // NAO so SUPERADMIN - toda empresa le os precos base em Modulos.jsx).
  // Escrever esses precos e restrito, ver PUT /superadmin/configuracoes/precos.
  fastify.get('/precos', configuracoesController.obterPrecos);
};
