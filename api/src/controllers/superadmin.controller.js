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

/** PUT /superadmin/empresas/:id/doador - Modal de Gestao de Doadores: tornar/remover doador. */
async function definirDoador(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { is_doador: isDoador, valor_contribuicao: valorContribuicao } = request.body || {};
  const empresa = await superadminService.definirDoador(request.server.prisma, id, { isDoador, valorContribuicao });
  return reply.send(empresa);
}

/** GET /superadmin/empresas/:id/doador - dados de doacao de uma empresa, pro Modal de Gestao de Doadores. */
async function obterDadosDoador(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const dados = await superadminService.obterDadosDoador(request.server.prisma, id);
  return reply.send(dados);
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

/** DELETE /superadmin/empresas/:id/pagamentos/:modulo - "Restringir" (revoga pagamento e desativa o modulo). */
async function restringirModulo(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { modulo } = request.params;
  const resultado = await superadminService.restringirModulo(request.server.prisma, id, { modulo });
  return reply.send(resultado);
}

/** GET /superadmin/empresas/:id/assinaturas - breakdown por modulo (ativo/inativo + status de cobranca), pro modal "Gestao Detalhada de Assinaturas". */
async function obterAssinaturas(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const assinaturas = await superadminService.obterAssinaturas(request.server.prisma, id);
  return reply.send(assinaturas);
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
  obterDadosDoador,
  forcarPagamento,
  restringirModulo,
  obterAssinaturas,
  listarChamados,
  atualizarStatusChamado,
  obterPrecos,
  atualizarPrecos,
};
