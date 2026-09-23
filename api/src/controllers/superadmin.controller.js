const superadminService = require('../services/superadmin.service');
const configuracoesService = require('../services/configuracoes.service');

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

async function listarEmpresas(request, reply) {
  const empresas = await superadminService.listarEmpresas(request.server.prisma);
  return reply.send(empresas);
}

/** PUT /superadmin/empresas/:id/status - "Suspender Acesso"/reativar. */
async function atualizarStatusEmpresa(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { ativo } = request.body || {};
  const empresa = await superadminService.atualizarStatusEmpresa(request.server.prisma, id, ativo);
  return reply.send(empresa);
}

/** PUT /superadmin/empresas/:id/doador - "Tornar Doador" manual. */
async function definirDoador(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { is_doador: isDoador } = request.body || {};
  const empresa = await superadminService.definirDoador(request.server.prisma, id, isDoador);
  return reply.send(empresa);
}

/** PUT /superadmin/empresas/:id/pagamentos - "Gerenciar Assinaturas" (forca ativacao de um modulo pago). */
async function forcarPagamento(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { modulo, plano_ia: planoIa } = request.body || {};
  if (!modulo) {
    return reply.code(400).send({ error: 'modulo e obrigatorio.' });
  }

  const resultado = await superadminService.forcarPagamento(request.server.prisma, id, { modulo, planoIa });
  return reply.send(resultado);
}

async function listarChamados(request, reply) {
  const chamados = await superadminService.listarChamados(request.server.prisma);
  return reply.send(chamados);
}

async function atualizarStatusChamado(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { status } = request.body || {};
  if (!status) {
    return reply.code(400).send({ error: 'status e obrigatorio.' });
  }

  const chamado = await superadminService.atualizarStatusChamado(request.server.prisma, id, status);
  return reply.send(chamado);
}

async function obterPrecos(request, reply) {
  const precos = await configuracoesService.obterPrecos(request.server.prisma);
  return reply.send(precos);
}

async function atualizarPrecos(request, reply) {
  const precos = await configuracoesService.atualizarPrecos(request.server.prisma, request.body || {});
  return reply.send(precos);
}

module.exports = {
  listarEmpresas,
  atualizarStatusEmpresa,
  definirDoador,
  forcarPagamento,
  listarChamados,
  atualizarStatusChamado,
  obterPrecos,
  atualizarPrecos,
};
