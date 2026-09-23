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

  // `usuarioId` sempre de `request.userId` (do token) - qualquer campo de
  // "id do usuario" que o corpo da requisicao mande e ignorado de proposito
  // (ver comentario de `chamadosService.criar`).
  const chamado = await chamadosService.criar(request.server.prisma, request.tenantId, request.userId, {
    titulo,
    descricao,
  });
  return reply.code(201).send(chamado);
}

module.exports = { list, create };
