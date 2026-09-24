const empresaService = require('../services/empresa.service');
const { asaasConfigurado } = require('../services/asaas/asaasClient');

async function obterDados(request, reply) {
  const empresa = await empresaService.obterDados(request.server.prisma, request.tenantId);
  return reply.send(empresa);
}

async function atualizarDados(request, reply) {
  const { razaoSocial, nomeLoja, endereco, telefone, segmento } = request.body || {};

  const temCampoValido = [razaoSocial, nomeLoja, endereco, telefone, segmento].some((valor) => valor !== undefined);
  if (!temCampoValido) {
    return reply.code(400).send({
      error: 'Informe ao menos um campo para atualizar: razaoSocial, nomeLoja, endereco, telefone, segmento.',
    });
  }

  const empresa = await empresaService.atualizarDados(request.server.prisma, request.tenantId, {
    razaoSocial,
    nomeLoja,
    endereco,
    telefone,
    segmento,
  });
  return reply.send(empresa);
}

/** PUT /empresa/modulos - liga/desliga modulos de negocio (Modulos.jsx, a "App Store" do SaaS). */
async function atualizarModulos(request, reply) {
  const { modulos } = request.body || {};

  if (modulos === undefined) {
    return reply.code(400).send({ error: 'modulos e obrigatorio.' });
  }

  const resultado = await empresaService.atualizarModulos(request.server.prisma, request.tenantId, modulos);
  return reply.send(resultado);
}

/** PUT /empresa/pagamentos - checkout simulado (ModalPagamento, Modulos.jsx): marca um modulo pago e ja o ativa. */
/**
 * PUT /empresa/pagamentos - checkout SIMULADO (marca o modulo como pago sem
 * cobrar nada). Desde a integracao com o Asaas (2026-09-24) so vale em
 * DESENVOLVIMENTO sem gateway configurado: com ASAAS_API_KEY definida, ou em
 * producao, responde 410 - senao qualquer admin continuaria liberando
 * modulo pago de graca, anulando a cobranca real (POST /assinaturas/checkout).
 * Liberacao gratuita legitima continua existindo so pelo Supra Admin
 * (PUT /superadmin/empresas/:id/pagamentos).
 */
async function confirmarPagamento(request, reply) {
  if (asaasConfigurado() || process.env.NODE_ENV === 'production') {
    return reply.code(410).send({ error: 'O checkout simulado foi desativado. Use o pagamento por Pix ou Cartão.' });
  }

  const { modulo, plano_ia: planoIa } = request.body || {};

  if (!modulo) {
    return reply.code(400).send({ error: 'modulo e obrigatorio.' });
  }

  const resultado = await empresaService.confirmarPagamento(request.server.prisma, request.tenantId, {
    modulo,
    planoIa,
  });
  return reply.send(resultado);
}

async function listarUsuarios(request, reply) {
  const usuarios = await empresaService.listarUsuarios(request.server.prisma, request.tenantId);
  return reply.send(usuarios);
}

/**
 * POST /empresa/usuarios - "Convidar Usuario" (RBAC, 2026-09-24):
 * { email, perfil_id, nome? }. A resposta traz `senhaTemporaria` UMA vez
 * (ver empresaService.adicionarUsuario). `senha`/`role` do corpo antigo
 * sao ignorados de proposito (convidado nunca vira admin).
 */
async function adicionarUsuario(request, reply) {
  const { nome, email, perfil_id: perfilId } = request.body || {};

  if (!email || !perfilId) {
    return reply.code(400).send({ error: 'email e perfil_id sao obrigatorios.' });
  }

  const usuario = await empresaService.adicionarUsuario(request.server.prisma, request.tenantId, { nome, email, perfilId });
  return reply.code(201).send(usuario);
}

/** PUT /empresa/usuarios/:id/perfil - { perfil_id } - troca o perfil de acesso de alguem da equipe. */
async function atualizarPerfilUsuario(request, reply) {
  const usuarioId = Number(request.params.id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
  }
  const { perfil_id: perfilId } = request.body || {};
  const usuario = await empresaService.atualizarPerfilUsuario(request.server.prisma, request.tenantId, usuarioId, perfilId);
  return reply.send(usuario);
}

async function atualizarAssinatura(request, reply) {
  const { plano, valor_contribuicao: valorContribuicao } = request.body || {};

  if (!plano) {
    return reply.code(400).send({ error: 'plano e obrigatorio.' });
  }

  const empresa = await empresaService.atualizarAssinatura(request.server.prisma, request.tenantId, {
    plano,
    valorContribuicao,
  });
  return reply.send(empresa);
}

function parseUsuarioId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

/** POST /empresa/usuarios/:id/redefinir-senha - nova senha temporaria (devolvida uma vez) + troca obrigatoria. */
async function redefinirSenhaUsuario(request, reply) {
  const usuarioId = parseUsuarioId(request, reply);
  if (usuarioId === null) return;
  const resultado = await empresaService.redefinirSenhaUsuario(request.server.prisma, request.tenantId, request.userId, usuarioId);
  return reply.send(resultado);
}

/** DELETE /empresa/usuarios/:id - "Remover da equipe" (desativa; historico preservado, sessoes caem na hora). */
async function removerUsuario(request, reply) {
  const usuarioId = parseUsuarioId(request, reply);
  if (usuarioId === null) return;
  await empresaService.removerUsuario(request.server.prisma, request.tenantId, request.userId, usuarioId);
  return reply.code(204).send();
}

module.exports = {
  redefinirSenhaUsuario,
  removerUsuario,
  obterDados,
  atualizarDados,
  atualizarModulos,
  confirmarPagamento,
  listarUsuarios,
  adicionarUsuario,
  atualizarPerfilUsuario,
  atualizarAssinatura,
};
