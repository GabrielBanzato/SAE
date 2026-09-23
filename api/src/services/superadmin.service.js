const AppError = require('../utils/AppError');
const empresaService = require('./empresa.service');

/**
 * Camada de dados do Painel Supra Admin (2026-09-22, nivel mais alto do
 * sistema) - o UNICO lugar da API que le/escreve dados de QUALQUER empresa,
 * de proposito: quem chama estas funcoes ja passou pelo hook de
 * `nivelAcesso === 'SUPERADMIN'` (ver superadmin.routes.js), nao pelo
 * isolamento normal de tenant (`request.tenantId`) usado no resto da API.
 * Nenhuma funcao aqui aceita `tenantId` implicito - o `empresaId` alvo
 * sempre vem explicito do parametro da rota.
 */

const STATUS_CHAMADO_VALIDOS = ['ABERTO', 'RESOLVIDO'];

/**
 * Todas as empresas cadastradas - visao "de cima", sem filtro de tenant.
 * `isDoador` (derivado de `plano === 'apoiador'`, mesmo criterio de
 * empresa.service.js#obterDados) e `totalUsuarios` sao calculados aqui pra
 * a tabela da aba "Empresas/Clientes" nao precisar de N chamadas extras.
 */
async function listarEmpresas(prisma) {
  const empresas = await prisma.empresa.findMany({
    select: {
      id: true,
      razaoSocial: true,
      nomeLoja: true,
      documento: true,
      segmento: true,
      plano: true,
      ativo: true,
      modulosAtivos: true,
      pagamentosAtivos: true,
      criadoEm: true,
      _count: { select: { usuarios: true } },
    },
    orderBy: { criadoEm: 'desc' },
  });

  return empresas.map(({ _count, plano, ...empresa }) => ({
    ...empresa,
    plano,
    isDoador: plano === 'apoiador',
    totalUsuarios: _count.usuarios,
  }));
}

/** "Suspender Acesso"/reativar (SupraAdmin.jsx) - bloqueia login de toda a equipe dessa empresa a partir de agora (ver auth.service.js#login). */
async function atualizarStatusEmpresa(prisma, empresaId, ativo) {
  if (typeof ativo !== 'boolean') {
    throw new AppError('ativo deve ser um booleano.', 422);
  }

  const resultado = await prisma.empresa.updateMany({ where: { id: empresaId }, data: { ativo } });
  if (resultado.count === 0) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  return prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, ativo: true } });
}

/**
 * "Tornar Doador" manual (SupraAdmin.jsx) - reaproveita o MESMO campo
 * `plano` ja usado por Assinatura.jsx/`atualizarAssinatura`, nao inventa um
 * campo `isDoador` a parte (evita os dois saírem de sincronia, mesma
 * decisao ja tomada na tarefa de pricing). Diferente de
 * `atualizarAssinatura`: aqui e uma concessao administrativa (o Supra
 * Admin decide dar/tirar o status), entao NAO exige `valorContribuicao`
 * minima - vira Apoiador sem precisar informar um valor de contribuicao.
 */
async function definirDoador(prisma, empresaId, isDoador) {
  if (typeof isDoador !== 'boolean') {
    throw new AppError('isDoador deve ser um booleano.', 422);
  }

  const resultado = await prisma.empresa.updateMany({
    where: { id: empresaId },
    data: { plano: isDoador ? 'apoiador' : 'gratuito' },
  });
  if (resultado.count === 0) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  return prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, plano: true } });
}

/**
 * "Gerenciar Assinaturas" (SupraAdmin.jsx) - forca a ativacao de um modulo
 * pago pra qualquer empresa, sem ela precisar passar pelo checkout
 * simulado. Delegado direto pra `empresaService.confirmarPagamento` (a
 * mesma funcao que `PUT /empresa/pagamentos` usa) - a unica diferenca e
 * QUEM decide o `empresaId` alvo (aqui, o parametro da rota; la,
 * `request.tenantId`) - nenhuma logica de negocio duplicada.
 */
async function forcarPagamento(prisma, empresaId, dados) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  return empresaService.confirmarPagamento(prisma, empresaId, dados);
}

/** Todos os chamados de suporte, de qualquer empresa, com o nome dela junto - aba "Chamados de Suporte". */
async function listarChamados(prisma) {
  return prisma.chamadoSuporte.findMany({
    include: { empresa: { select: { id: true, razaoSocial: true, nomeLoja: true } } },
    orderBy: { criadoEm: 'desc' },
  });
}

async function atualizarStatusChamado(prisma, chamadoId, status) {
  if (!STATUS_CHAMADO_VALIDOS.includes(status)) {
    throw new AppError(`status deve ser um dos seguintes: ${STATUS_CHAMADO_VALIDOS.join(', ')}.`, 422);
  }

  const resultado = await prisma.chamadoSuporte.updateMany({ where: { id: chamadoId }, data: { status } });
  if (resultado.count === 0) {
    throw new AppError('Chamado nao encontrado.', 404);
  }

  return prisma.chamadoSuporte.findUnique({ where: { id: chamadoId } });
}

module.exports = {
  listarEmpresas,
  atualizarStatusEmpresa,
  definirDoador,
  forcarPagamento,
  listarChamados,
  atualizarStatusChamado,
  STATUS_CHAMADO_VALIDOS,
};
