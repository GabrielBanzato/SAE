const authService = require('../services/auth.service');
const { SEGMENTOS_VALIDOS } = require('../services/empresa.service');

const TIPOS_PESSOA_VALIDOS = ['PF', 'PJ'];

async function register(request, reply) {
  const { nome_empresa, tipo_pessoa, documento, nome_usuario, email, senha, segmento } = request.body || {};

  if (!nome_empresa || !tipo_pessoa || !documento || !nome_usuario || !email || !senha) {
    return reply.code(400).send({
      error: 'nome_empresa, tipo_pessoa, documento, nome_usuario, email e senha sao obrigatorios.',
    });
  }

  if (!TIPOS_PESSOA_VALIDOS.includes(tipo_pessoa)) {
    return reply.code(400).send({ error: "tipo_pessoa deve ser 'PF' ou 'PJ'." });
  }

  // Opcional - se nao vier, o schema ja tem @default("outros") no banco.
  // O frontend de Cadastro ainda nao pede o segmento nesta tela (a tarefa
  // que introduziu o campo pediu ele em Configuracoes/Dados da Loja, nao
  // no registro inicial) - fica pronto pra aceitar caso isso mude.
  if (segmento !== undefined && !SEGMENTOS_VALIDOS.includes(segmento)) {
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

module.exports = { register, login };
