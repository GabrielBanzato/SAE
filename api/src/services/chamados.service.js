/**
 * Chamados de suporte abertos pela PROPRIA empresa (pages/Suporte.jsx) -
 * mesma convencao de tenant isolation do resto da API (`tenantId` explicito
 * em todo `where`). Visao "de cima" de todas as empresas fica em
 * superadmin.service.js#listarChamados, nao aqui.
 */

/** `usuario` (nome/codigoUsuario de quem abriu) incluido pra quem for atender saber a quem se referir - mesmo campo que o Supra Admin ve em `superadmin.service.js#listarChamados`. */
async function listarPorEmpresa(prisma, tenantId) {
  return prisma.chamadoSuporte.findMany({
    where: { empresaId: tenantId },
    include: { usuario: { select: { nome: true, codigoUsuario: true } } },
    orderBy: { criadoEm: 'desc' },
  });
}

/**
 * `usuarioId` (Ajuste no Formulario de Suporte, 2026-09-23) - QUEM abriu o
 * chamado, sempre `request.userId` (o token JWT de quem esta logado, ja
 * validado pelo hook global de auth) - NUNCA um valor vindo do corpo da
 * requisicao, mesmo principio ja aplicado a `tenantId`/`empresaId` acima
 * (o campo "Seu ID" em Suporte.jsx e so-leitura NA TELA, mas isso e so
 * uma cortesia de UX, nao uma fronteira de seguranca real).
 */
async function criar(prisma, tenantId, usuarioId, { titulo, descricao }) {
  return prisma.chamadoSuporte.create({
    data: {
      empresaId: tenantId, // sempre do token, nunca do body
      usuarioId, // idem - sempre do token
      titulo,
      descricao: descricao || null,
    },
  });
}

module.exports = { listarPorEmpresa, criar };
