const empresaService = require('../services/empresa.service');

async function obterDados(request, reply) {
  const empresa = await empresaService.obterDados(request.server.prisma, request.tenantId);
  return reply.send(empresa);
}

async function atualizarDados(request, reply) {
  const { razaoSocial, endereco, telefone, segmento } = request.body || {};

  const temCampoValido = [razaoSocial, endereco, telefone, segmento].some((valor) => valor !== undefined);
  if (!temCampoValido) {
    return reply
      .code(400)
      .send({ error: 'Informe ao menos um campo para atualizar: razaoSocial, endereco, telefone, segmento.' });
  }

  const empresa = await empresaService.atualizarDados(request.server.prisma, request.tenantId, {
    razaoSocial,
    endereco,
    telefone,
    segmento,
  });
  return reply.send(empresa);
}

async function listarUsuarios(request, reply) {
  const usuarios = await empresaService.listarUsuarios(request.server.prisma, request.tenantId);
  return reply.send(usuarios);
}

async function adicionarUsuario(request, reply) {
  const { nome, email, senha, role } = request.body || {};

  if (!nome || !email || !senha) {
    return reply.code(400).send({ error: 'nome, email e senha sao obrigatorios.' });
  }

  const usuario = await empresaService.adicionarUsuario(request.server.prisma, request.tenantId, {
    nome,
    email,
    senha,
    role,
  });

  return reply.code(201).send(usuario);
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

module.exports = { obterDados, atualizarDados, listarUsuarios, adicionarUsuario, atualizarAssinatura };
