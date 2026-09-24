const authService = require('../services/auth.service');
const { SEGMENTOS_VALIDOS } = authService;

const TIPOS_PESSOA_VALIDOS = ['PF', 'PJ'];

async function register(request, reply) {
  const { nome_empresa, tipo_pessoa, documento, nome_usuario, email, senha, segmento, nome_loja } =
    request.body || {};

  // `segmento` agora e obrigatorio (schema.prisma nao tem mais
  // @default("outros")) - decide os modulos de negocio liberados pra essa
  // empresa (MAPA_MODULOS em auth.service.js), entao o Cadastro.jsx sempre
  // pede uma escolha explicita, sem fallback implicito.
  if (!nome_empresa || !tipo_pessoa || !documento || !nome_usuario || !email || !senha || !segmento) {
    return reply.code(400).send({
      error: 'nome_empresa, tipo_pessoa, documento, nome_usuario, email, senha e segmento sao obrigatorios.',
    });
  }

  if (!TIPOS_PESSOA_VALIDOS.includes(tipo_pessoa)) {
    return reply.code(400).send({ error: "tipo_pessoa deve ser 'PF' ou 'PJ'." });
  }

  if (!SEGMENTOS_VALIDOS.includes(segmento)) {
    return reply.code(400).send({ error: `segmento deve ser um dos seguintes: ${SEGMENTOS_VALIDOS.join(', ')}.` });
  }

  const resultado = await authService.register(request.server, {
    nome_empresa,
    tipo_pessoa,
    documento,
    nome_usuario,
    email,
    senha,
    segmento,
    nome_loja,
  });

  return reply.code(201).send(resultado);
}

async function login(request, reply) {
  const { email, senha } = request.body || {};

  if (!email || !senha) {
    return reply.code(400).send({ error: 'email e senha sao obrigatorios.' });
  }

  const resultado = await authService.login(request.server, { email, senha });

  if (!resultado) {
    return reply.code(401).send({ error: 'Credenciais invalidas.' });
  }

  return reply.send(resultado);
}

/** GET /auth/me - usuario logado (id sempre do token, ver auth.service.js#me). */
async function me(request, reply) {
  const usuario = await authService.me(request.server.prisma, request.userId, request.tenantId);
  return reply.send(usuario);
}

/** PUT /auth/senha - { senha_atual, nova_senha } - a propria pessoa troca a senha (id sempre do token). */
async function alterarSenha(request, reply) {
  const { senha_atual: senhaAtual, nova_senha: novaSenha } = request.body || {};
  await authService.alterarSenha(request.server.prisma, request.userId, request.tenantId, { senhaAtual, novaSenha });
  return reply.code(204).send();
}

module.exports = { register, login, me, alterarSenha };
