const assinaturasController = require('../controllers/assinaturas.controller');

/**
 * Assinaturas reais de modulos (gateway Asaas, 2026-09-24). So o ADMIN da
 * loja contrata/paga (mesma regra da App Store - Modulos.jsx e so admin).
 */
module.exports = async function assinaturasRoutes(fastify) {
  fastify.addHook('preHandler', fastify.requireAdmin());

  fastify.get('/', assinaturasController.listar);
  fastify.post('/checkout', assinaturasController.checkout);
  fastify.get('/:id/status', assinaturasController.status);
  // Cancelar = desligar um modulo pago com assinatura (so admin, empresa do token).
  fastify.delete('/:modulo', assinaturasController.cancelar);
};
