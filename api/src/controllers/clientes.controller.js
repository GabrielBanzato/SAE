const clientesService = require('../services/clientes.service');

async function list(request, reply) {
  const clientes = await clientesService.list(request.server.prisma, request.tenantId);
  return reply.send(clientes);
}

async function create(request, reply) {
  const { nome } = request.body || {};

  if (!nome) {
    return reply.code(400).send({ error: 'nome e obrigatorio.' });
  }

  const cliente = await clientesService.create(request.server.prisma, request.tenantId, request.body);
  return reply.code(201).send(cliente);
}

module.exports = { list, create };
