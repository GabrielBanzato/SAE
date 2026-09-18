const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;

// Tamanho esperado do documento (so digitos) por tipo de pessoa - CPF tem
// 11 digitos, CNPJ tem 14.
const TAMANHO_DOCUMENTO = { PF: 11, PJ: 14 };

function gerarToken(fastify, usuario) {
  return fastify.jwt.sign(
    {
      sub: usuario.id,
      empresa_id: usuario.empresaId,
      role: usuario.role,
    },
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/**
 * Cadastra uma nova empresa (tenant) e seu primeiro usuario (admin) numa
 * unica transacao: se a criacao do usuario falhar por qualquer motivo, a
 * empresa recem-criada tambem e desfeita - nunca deve sobrar um tenant
 * "orfao" sem nenhum usuario capaz de acessa-lo.
 */
async function register(fastify, { nome_empresa, tipo_pessoa, documento, nome_usuario, email, senha, segmento }) {
  const { prisma } = fastify;

  const tamanhoEsperado = TAMANHO_DOCUMENTO[tipo_pessoa];
  if (documento.length !== tamanhoEsperado) {
    throw new AppError(
      `documento deve ter ${tamanhoEsperado} digitos (somente numeros) para tipo_pessoa '${tipo_pessoa}'.`,
      422
    );
  }

  const empresaExistente = await prisma.empresa.findUnique({ where: { documento } });
  if (empresaExistente) {
    throw new AppError('Ja existe uma empresa cadastrada com este documento.', 409);
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  const { empresa, usuario } = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      // `segmento` e opcional aqui - se vier `undefined`, o Prisma nao inclui
      // o campo no INSERT e o `@default("outros")` do schema assume sozinho.
      data: { razaoSocial: nome_empresa, tipoPessoa: tipo_pessoa, documento, segmento },
    });

    // Primeiro usuario da empresa e sempre admin - nao ha ninguem mais para
    // convida-lo, entao ele precisa de acesso total desde o inicio.
    const usuario = await tx.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: nome_usuario,
        email,
        senhaHash,
        role: 'admin',
      },
    });

    return { empresa, usuario };
  });

  const token = gerarToken(fastify, usuario);

  return {
    token,
    empresa: {
      id: empresa.id,
      razaoSocial: empresa.razaoSocial,
      tipoPessoa: empresa.tipoPessoa,
      documento: empresa.documento,
      segmento: empresa.segmento,
    },
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    },
  };
}

/**
 * Autentica um usuario apenas por email + senha.
 *
 * Atencao: `Usuario.email` e unico apenas POR empresa
 * (@@unique([empresaId, email]) no schema.prisma), nao globalmente. Como o
 * fluxo de cadastro (register acima) e self-service - cada empresa nova
 * cria seu proprio usuario admin -, colisao de e-mail entre tenants
 * diferentes e possivel na teoria; usamos `findFirst` e ficamos com a
 * primeira ocorrencia. Se isso virar um problema real, a solucao correta e
 * tornar `email` unico globalmente no schema.
 */
async function login(fastify, { email, senha }) {
  const { prisma } = fastify;

  const usuario = await prisma.usuario.findFirst({ where: { email } });
  if (!usuario) {
    return null;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    return null;
  }

  const token = gerarToken(fastify, usuario);

  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    },
  };
}

module.exports = { register, login };
