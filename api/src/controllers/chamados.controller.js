const chamadosService = require('../services/chamados.service');

async function list(request, reply) {
  const chamados = await chamadosService.listarPorEmpresa(request.server.prisma, request.tenantId);
  return reply.send(chamados);
}

async function create(request, reply) {
  const { titulo, descricao } = request.body || {};

  if (!titulo) {
    return reply.code(400).send({ error: 'titulo e obrigatorio.' });
  }

  const chamado = await chamadosService.criar(request.server.prisma, request.tenantId, { titulo, descricao });
  return reply.code(201).send(chamado);
}

module.exports = { list, create };
