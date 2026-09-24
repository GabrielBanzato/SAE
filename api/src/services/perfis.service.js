const AppError = require('../utils/AppError');
const { normalizarPermissoes } = require('./permissoes');

/**
 * CRUD de Perfis de Acesso (RBAC, 2026-09-24) - sempre escopado ao tenant
 * (`tenantId` explicito em todo `where`, mesmo padrao do resto da API).
 * Quem chama ja passou por `requireAdmin` (ver perfis.routes.js).
 */

const TAMANHO_MAX_NOME = 60;

function validarNome(nome) {
  const valor = typeof nome === 'string' ? nome.trim() : '';
  if (!valor) throw new AppError('nome e obrigatorio.', 400);
  if (valor.length > TAMANHO_MAX_NOME) throw new AppError(`nome deve ter no maximo ${TAMANHO_MAX_NOME} caracteres.`, 400);
  return valor;
}

function serializar({ _count, ...perfil }) {
  return { ...perfil, totalUsuarios: _count?.usuarios ?? 0 };
}

const SELECT_PERFIL = {
  id: true,
  nome: true,
  permissoes: true,
  criadoEm: true,
  atualizadoEm: true,
  _count: { select: { usuarios: true } },
};

/** Traduz a violacao do @@unique([empresaId, nome]) num 409 legivel. */
function tratarNomeDuplicado(err) {
  if (err.code === 'P2002') throw new AppError('Ja existe um perfil com este nome.', 409);
  throw err;
}

async function listar(prisma, tenantId) {
  const perfis = await prisma.perfil.findMany({ where: { empresaId: tenantId }, select: SELECT_PERFIL, orderBy: { nome: 'asc' } });
  return perfis.map(serializar);
}

async function criar(prisma, tenantId, { nome, permissoes }) {
  const data = { empresaId: tenantId, nome: validarNome(nome), permissoes: normalizarPermissoes(permissoes ?? []) };
  const perfil = await prisma.perfil.create({ data, select: SELECT_PERFIL }).catch(tratarNomeDuplicado);
  return serializar(perfil);
}

/** Atualiza nome e/ou permissoes - vale na PROXIMA requisicao de quem usa o perfil (acesso e lido do banco, nao do JWT). */
async function atualizar(prisma, tenantId, perfilId, { nome, permissoes }) {
  const data = {};
  if (nome !== undefined) data.nome = validarNome(nome);
  if (permissoes !== undefined) data.permissoes = normalizarPermissoes(permissoes);
  if (!Object.keys(data).length) throw new AppError('Informe nome e/ou permissoes.', 400);

  // updateMany com empresaId no where = checagem de tenant + update numa instrucao so.
  const resultado = await prisma.perfil.updateMany({ where: { id: perfilId, empresaId: tenantId }, data }).catch(tratarNomeDuplicado);
  if (resultado.count === 0) throw new AppError('Perfil nao encontrado.', 404);

  return serializar(await prisma.perfil.findUnique({ where: { id: perfilId }, select: SELECT_PERFIL }));
}

/**
 * Remove um perfil - RECUSA (409) se houver usuarios nele. Nao "solta" os
 * usuarios (perfilId = null) de proposito: sem perfil, um nao-admin cai no
 * acesso total legado - apagar um perfil restritivo viraria escalada de
 * privilegio. O admin precisa mover as pessoas pra outro perfil antes.
 * (A FK tambem e ON DELETE RESTRICT - esta checagem so da a mensagem boa.)
 */
async function remover(prisma, tenantId, perfilId) {
  const perfil = await prisma.perfil.findFirst({
    where: { id: perfilId, empresaId: tenantId },
    select: { id: true, _count: { select: { usuarios: true } } },
  });
  if (!perfil) throw new AppError('Perfil nao encontrado.', 404);
  if (perfil._count.usuarios > 0) {
    throw new AppError(
      `Este perfil esta em uso por ${perfil._count.usuarios} usuario(s). Mova-os para outro perfil antes de excluir.`,
      409
    );
  }
  await prisma.perfil.delete({ where: { id: perfilId } });
}

module.exports = { listar, criar, atualizar, remover };
