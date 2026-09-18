const vendasService = require('../services/vendas.service');

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

async function create(request, reply) {
  const {
    itens,
    cliente_id: clienteId,
    funcionario_id: funcionarioId,
    forma_pagamento: formaPagamento,
    data,
  } = request.body || {};

  if (!Array.isArray(itens) || itens.length === 0) {
    return reply.code(400).send({ error: 'itens deve ser um array com pelo menos 1 { produto_id, quantidade }.' });
  }

  const resultado = await vendasService.registrarVenda(request.server, {
    tenantId: request.tenantId,
    usuarioId: request.userId,
    itens,
    clienteId: clienteId || undefined,
    funcionarioId: funcionarioId || undefined,
    formaPagamento,
    data,
  });

  return reply.code(201).send(resultado);
}

async function list(request, reply) {
  const vendas = await vendasService.listar(request.server.prisma, request.tenantId);
  return reply.send(vendas);
}

async function getById(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const venda = await vendasService.buscarPorId(request.server.prisma, request.tenantId, id);
  return reply.send(venda);
}

module.exports = { create, list, getById };
