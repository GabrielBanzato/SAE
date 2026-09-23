/**
 * Chamados de suporte abertos pela PROPRIA empresa (pages/Suporte.jsx) -
 * mesma convencao de tenant isolation do resto da API (`tenantId` explicito
 * em todo `where`). Visao "de cima" de todas as empresas fica em
 * superadmin.service.js#listarChamados, nao aqui.
 */

async function listarPorEmpresa(prisma, tenantId) {
  return prisma.chamadoSuporte.findMany({
    where: { empresaId: tenantId },
    orderBy: { criadoEm: 'desc' },
  });
}

async function criar(prisma, tenantId, { titulo, descricao }) {
  return prisma.chamadoSuporte.create({
    data: {
      empresaId: tenantId, // sempre do token, nunca do body
      titulo,
      descricao: descricao || null,
    },
  });
}

module.exports = { listarPorEmpresa, criar };
