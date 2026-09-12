const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;

const PLANOS_VALIDOS = ['gratuito', 'apoiador'];
const ROLES_VALIDOS = ['admin', 'gerente', 'vendedor'];
// Ramos de atuacao suportados - hoje so decide se Produto pode ter Ficha
// Tecnica de ingredientes vinculada (ver produtos.service.js). Validado
// aqui na aplicacao porque `Empresa.nicho` e String solto no schema, nao
// enum (decisao registrada no schema.prisma).
const NICHOS_VALIDOS = ['geral', 'alimentos'];

// Quantos usuarios cada plano pode ter vinculados ao mesmo tenant_id.
const LIMITE_USUARIOS_POR_PLANO = { gratuito: 2, apoiador: 5 };

// Contribuicao minima mensal pra virar Apoiador (a "mensalidade caridosa").
const VALOR_MINIMO_CONTRIBUICAO = 10;

/**
 * Dados da propria empresa (tenant). `tenantId` sempre vem do token
 * (request.tenantId), nunca de parametro de rota/query - do contrario um
 * usuario poderia consultar dados de outra empresa trocando um id na URL.
 */
async function obterDados(prisma, tenantId) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      razaoSocial: true,
      tipoPessoa: true,
      documento: true,
      endereco: true,
      telefone: true,
      plano: true,
      nicho: true,
      valorContribuicao: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });

  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  return empresa;
}

/**
 * Usuarios vinculados a empresa. `senhaHash` e deliberadamente excluido do
 * `select` - nunca deve sair da API, nem pra tela de configuracoes.
 */
async function listarUsuarios(prisma, tenantId) {
  return prisma.usuario.findMany({
    where: { empresaId: tenantId },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      criadoEm: true,
    },
    orderBy: { nome: 'asc' },
  });
}

/**
 * Adiciona um novo usuario a equipe da empresa, respeitando o limite de
 * usuarios do plano atual (gratuito: 2, apoiador: 5). O limite conta TODOS
 * os usuarios ja vinculados a esse tenant_id, incluindo o admin criado no
 * registro - ou seja, no plano gratuito so cabe mais 1 pessoa alem do
 * admin.
 */
async function adicionarUsuario(prisma, tenantId, { nome, email, senha, role }) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: { plano: true },
  });

  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const limite = LIMITE_USUARIOS_POR_PLANO[empresa.plano];
  const totalUsuarios = await prisma.usuario.count({ where: { empresaId: tenantId } });

  if (totalUsuarios >= limite) {
    throw new AppError(
      `Limite de usuarios do plano '${empresa.plano}' atingido (maximo ${limite}). Vire Apoiador para adicionar mais pessoas a equipe.`,
      403
    );
  }

  const roleFinal = role || 'vendedor';
  if (!ROLES_VALIDOS.includes(roleFinal)) {
    throw new AppError(`role deve ser um dos seguintes: ${ROLES_VALIDOS.join(', ')}.`, 422);
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  try {
    return await prisma.usuario.create({
      data: { empresaId: tenantId, nome, email, senhaHash, role: roleFinal },
      select: { id: true, nome: true, email: true, role: true, criadoEm: true },
    });
  } catch (err) {
    // P2002 = violacao de unique constraint - aqui, @@unique([empresaId, email]).
    if (err.code === 'P2002') {
      throw new AppError('Ja existe um usuario com este e-mail nesta empresa.', 409);
    }
    throw err;
  }
}

/**
 * Atualiza o plano da empresa. "Simulada" porque nao ha integracao real de
 * pagamento aqui - so grava a mudanca de plano direto, como se o pagamento
 * ja tivesse sido confirmado em algum outro lugar.
 *
 * `valorContribuicao` (a mensalidade caridosa) so e exigido/validado
 * quando o plano e 'apoiador' - voltar pro 'gratuito' zera a contribuicao
 * (nao faz sentido guardar um valor de contribuicao pra quem nao esta mais
 * contribuindo).
 */
async function atualizarAssinatura(prisma, tenantId, { plano, valorContribuicao }) {
  if (!PLANOS_VALIDOS.includes(plano)) {
    throw new AppError(`plano deve ser um dos seguintes: ${PLANOS_VALIDOS.join(', ')}.`, 422);
  }

  let valor = 0;
  if (plano === 'apoiador') {
    valor = Number(valorContribuicao);
    if (!Number.isFinite(valor) || valor < VALOR_MINIMO_CONTRIBUICAO) {
      throw new AppError(
        `valor_contribuicao deve ser um numero de pelo menos R$ ${VALOR_MINIMO_CONTRIBUICAO.toFixed(2)} para o plano apoiador.`,
        422
      );
    }
  }

  return prisma.empresa.update({
    where: { id: tenantId },
    data: { plano, valorContribuicao: valor },
    select: {
      id: true,
      razaoSocial: true,
      documento: true,
      plano: true,
      valorContribuicao: true,
      atualizadoEm: true,
    },
  });
}

module.exports = {
  obterDados,
  listarUsuarios,
  adicionarUsuario,
  atualizarAssinatura,
  PLANOS_VALIDOS,
  ROLES_VALIDOS,
  NICHOS_VALIDOS,
  LIMITE_USUARIOS_POR_PLANO,
  VALOR_MINIMO_CONTRIBUICAO,
};
