const vendasService = require('../services/vendas.service');

async function create(request, reply) {
  const { produto_id: produtoId, quantidade, cliente_id: clienteId } = request.body || {};

  if (!produtoId || !Number.isInteger(quantidade) || quantidade <= 0) {
    return reply.code(400).send({ error: 'produto_id e quantidade (inteiro > 0) sao obrigatorios.' });
  }

  const resultado = await vendasService.registrarVenda(request.server, {
    tenantId: request.tenantId,
    usuarioId: request.userId,
    produtoId,
    quantidade,
    clienteId: clienteId || undefined,
  });

  return reply.code(201).send(resultado);
}

module.exports = { create };
