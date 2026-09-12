/**
 * Camada de dados de clientes. Mesma convencao das outras services:
 * `tenantId` explicito em todo `where`, nunca confia num id vindo do body.
 */

async function list(prisma, tenantId) {
  return prisma.cliente.findMany({
    where: { empresaId: tenantId },
    orderBy: { nome: 'asc' },
  });
}

async function findById(prisma, tenantId, id) {
  return prisma.cliente.findFirst({ where: { id, empresaId: tenantId } });
}

async function create(prisma, tenantId, dados) {
  const { nome, telefone, email } = dados;

  return prisma.cliente.create({
    data: {
      empresaId: tenantId, // sempre do token, nunca do body
      nome,
      telefone: telefone || null,
      email: email || null,
    },
  });
}

module.exports = { list, findById, create };
