const lancamentosService = require('../services/lancamentos.service');
const { CATEGORIAS_VALIDAS } = lancamentosService;

const TIPOS_VALIDOS = ['ENTRADA', 'SAIDA'];
const STATUS_VALIDOS = ['PENDENTE', 'PAGO'];
const CAMPOS_ATUALIZAVEIS = ['descricao', 'valor', 'tipo', 'data_vencimento', 'data_pagamento', 'status', 'categoria'];

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

/** "MM-AAAA" -> `{ ano, mesNumero }`, ou `null` se o formato/mes for invalido - mesma convencao de agenda.controller.js. */
function parseMesAno(mesAno) {
  const match = /^(\d{2})-(\d{4})$/.exec(mesAno || '');
  if (!match) return null;

  const mesNumero = Number(match[1]);
  const ano = Number(match[2]);
  if (mesNumero < 1 || mesNumero > 12) return null;

  return { ano, mesNumero };
}

/**
 * `?status=PAGO|PENDENTE` e/ou `?mes_ano=MM-AAAA` (ambos opcionais) -
 * filtragem sob demanda, sem quebrar quem ja chama `GET /lancamentos` sem
 * nenhum parametro (Lancamentos.jsx/ControleFinanceiro.jsx continuam
 * buscando tudo e filtrando no proprio frontend, decisao ja documentada
 * la - isso aqui e pra outros consumidores, ver relatorios.service.js).
 */
async function list(request, reply) {
  const { status, mes_ano: mesAno } = request.query || {};

  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    return reply.code(400).send({ error: `status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.` });
  }

  let ano, mesNumero;
  if (mesAno !== undefined) {
    const parsed = parseMesAno(mesAno);
    if (!parsed) {
      return reply.code(400).send({ error: 'mes_ano deve estar no formato MM-AAAA (ex.: 09-2026).' });
    }
    ({ ano, mesNumero } = parsed);
  }

  const lancamentos = await lancamentosService.list(request.server.prisma, request.tenantId, { status, ano, mesNumero });
  return reply.send(lancamentos);
}

async function getById(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const lancamento = await lancamentosService.findById(request.server.prisma, request.tenantId, id);
  if (!lancamento) {
    return reply.code(404).send({ error: 'Lancamento nao encontrado.' });
  }
  return reply.send(lancamento);
}

async function create(request, reply) {
  const { descricao, valor, tipo, data_vencimento: dataVencimento, status, categoria } = request.body || {};

  if (!descricao || valor === undefined || valor === null || valor === '') {
    return reply.code(400).send({ error: 'descricao e valor sao obrigatorios.' });
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return reply.code(400).send({ error: `tipo deve ser um dos seguintes: ${TIPOS_VALIDOS.join(', ')}.` });
  }
  if (!dataVencimento) {
    return reply.code(400).send({ error: 'data_vencimento e obrigatoria.' });
  }
  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    return reply.code(400).send({ error: `status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.` });
  }
  if (categoria !== undefined && !CATEGORIAS_VALIDAS.includes(categoria)) {
    return reply.code(400).send({ error: `categoria deve ser uma das seguintes: ${CATEGORIAS_VALIDAS.join(', ')}.` });
  }

  const lancamento = await lancamentosService.create(request.server.prisma, request.tenantId, request.body);
  return reply.code(201).send(lancamento);
}

async function update(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const body = request.body || {};
  const temCampoValido = CAMPOS_ATUALIZAVEIS.some((campo) => body[campo] !== undefined);
  if (!temCampoValido) {
    return reply
      .code(400)
      .send({ error: `Informe ao menos um campo para atualizar: ${CAMPOS_ATUALIZAVEIS.join(', ')}.` });
  }
  if (body.tipo !== undefined && !TIPOS_VALIDOS.includes(body.tipo)) {
    return reply.code(400).send({ error: `tipo deve ser um dos seguintes: ${TIPOS_VALIDOS.join(', ')}.` });
  }
  if (body.status !== undefined && !STATUS_VALIDOS.includes(body.status)) {
    return reply.code(400).send({ error: `status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.` });
  }
  if (body.categoria !== undefined && !CATEGORIAS_VALIDAS.includes(body.categoria)) {
    return reply.code(400).send({ error: `categoria deve ser uma das seguintes: ${CATEGORIAS_VALIDAS.join(', ')}.` });
  }

  const lancamento = await lancamentosService.update(request.server.prisma, request.tenantId, id, body);
  return reply.send(lancamento);
}

async function remove(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  await lancamentosService.remove(request.server.prisma, request.tenantId, id);
  return reply.code(204).send();
}

module.exports = { list, getById, create, update, remove };
