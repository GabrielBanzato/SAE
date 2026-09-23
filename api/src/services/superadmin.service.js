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
 * `isDoador` vem direto da coluna persistida `Empresa.isDoador` (nao mais
 * recalculada de `plano` aqui - ver comentario dela em schema.prisma).
 * `totalUsuarios` e que continua calculado nesta funcao pra a tabela da aba
 * "Empresas/Clientes" nao precisar de N chamadas extras.
 *
 * `codigoUsuarioAdmin` (achado de 2026-09-23, correcao de bug - a tabela
 * nao tinha NENHUMA coluna de ID visivel) - o codigo de 5 digitos (ver
 * Usuario.codigoUsuario em schema.prisma) do usuario ADMIN da empresa, nao
 * um "ID da empresa" (esse codigo e um atributo de Usuario, nao de
 * Empresa - uma empresa pode ter varios usuarios, cada um com seu proprio
 * codigo). `role: 'admin'` + mais antigo (`criadoEm: 'asc'`) pega
 * consistentemente o usuario criado no cadastro (`register()` sempre cria
 * o primeiro usuario como admin) - `take: 1` porque so precisamos de 1
 * pra exibir na tabela, nao a equipe toda.
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
      isDoador: true,
      ativo: true,
      modulosAtivos: true,
      pagamentosAtivos: true,
      criadoEm: true,
      _count: { select: { usuarios: true } },
      usuarios: {
        where: { role: 'admin' },
        orderBy: { criadoEm: 'asc' },
        take: 1,
        select: { codigoUsuario: true },
      },
    },
    orderBy: { criadoEm: 'desc' },
  });

  return empresas.map(({ _count, usuarios, ...empresa }) => ({
    ...empresa,
    totalUsuarios: _count.usuarios,
    codigoUsuarioAdmin: usuarios[0]?.codigoUsuario ?? null,
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
 * "Modal de Gestao de Doadores" (Painel Master - Etapa 3, 2026-09-23) -
 * torna/remove uma empresa como doadora, gravando `plano`/`isDoador`/
 * `valorContribuicao`/`doadorDesde`/`doadorProximoVencimento` na MESMA
 * escrita (mesmo padrao de `empresaService.atualizarAssinatura`, unico
 * outro lugar que muda esses campos - `calcularCiclosDoador` reaproveitada
 * dali, nao duplicada) - nunca um campo sem os outros, pra nunca
 * divergirem. Diferente de `atualizarAssinatura` (self-service): aqui e
 * uma concessao administrativa - mas, desde a correcao de 2026-09-23,
 * exige o MESMO minimo de R$10,00 (`VALOR_MINIMO_DOACAO`) da "mensalidade
 * caridosa" self-service (antes aceitava qualquer valor `> 0`, o que
 * permitia um doador de R$0,01 - reportado como bug). Validado aqui
 * (fonte de verdade) E no controller/ModalDoador.jsx (feedback rapido).
 */
const VALOR_MINIMO_DOACAO = 10;

async function definirDoador(prisma, empresaId, { isDoador, valorContribuicao }) {
  if (typeof isDoador !== 'boolean') {
    throw new AppError('isDoador deve ser um booleano.', 422);
  }

  let valor = 0;
  if (isDoador) {
    valor = Number(valorContribuicao);
    if (!Number.isFinite(valor) || valor < VALOR_MINIMO_DOACAO) {
      throw new AppError('O valor mínimo da doação é R$ 10,00.', 422);
    }
  }

  const empresaAntes = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { isDoador: true, doadorDesde: true } });
  if (!empresaAntes) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const ciclos = empresaService.calcularCiclosDoador({
    isDoadorAntes: empresaAntes.isDoador,
    isDoadorNovo: isDoador,
    doadorDesdeAtual: empresaAntes.doadorDesde,
  });

  return prisma.empresa.update({
    where: { id: empresaId },
    data: { plano: isDoador ? 'apoiador' : 'gratuito', isDoador, valorContribuicao: valor, ...ciclos },
    select: {
      id: true,
      plano: true,
      isDoador: true,
      valorContribuicao: true,
      doadorDesde: true,
      doadorProximoVencimento: true,
    },
  });
}

/**
 * Dados de doacao de UMA empresa, pro modal decidir entre Estado A (nao e
 * doadora) e Estado B (ja e). Delegado pra `empresaService.obterDadosDoador`,
 * mesmo padrao de reaproveitamento das outras funcoes acima.
 */
async function obterDadosDoador(prisma, empresaId) {
  return empresaService.obterDadosDoador(prisma, empresaId);
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

/**
 * "Restringir" (Painel Master - Etapa 2, 2026-09-23) - mesmo padrao de
 * `forcarPagamento` acima: delega pra `empresaService.restringirModulo`
 * (nenhuma logica de negocio duplicada), so decide o `empresaId` alvo.
 */
async function restringirModulo(prisma, empresaId, dados) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  return empresaService.restringirModulo(prisma, empresaId, dados);
}

/**
 * "Gestao Detalhada de Assinaturas" (Painel Master - Etapa 2, 2026-09-23) -
 * breakdown por modulo (ativo/inativo + status de cobranca) de UMA
 * empresa - delegado pra `empresaService.obterAssinaturas`, mesmo padrao
 * de reaproveitamento das outras funcoes acima.
 */
async function obterAssinaturas(prisma, empresaId) {
  return empresaService.obterAssinaturas(prisma, empresaId);
}

/**
 * Todos os chamados de suporte, de qualquer empresa, com o nome dela junto
 * - aba "Chamados de Suporte". `usuario` (nome/codigoUsuario de quem abriu,
 * Ajuste no Formulario de Suporte, 2026-09-23) incluido pra chamado nao
 * ficar "orfao" - quem for atender sabe exatamente a quem se referir, sem
 * precisar confiar so no nome/email de texto livre que o formulario tambem
 * manda.
 */
async function listarChamados(prisma) {
  return prisma.chamadoSuporte.findMany({
    include: {
      empresa: { select: { id: true, razaoSocial: true, nomeLoja: true } },
      usuario: { select: { nome: true, codigoUsuario: true } },
    },
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
  obterDadosDoador,
  forcarPagamento,
  restringirModulo,
  obterAssinaturas,
  listarChamados,
  atualizarStatusChamado,
  STATUS_CHAMADO_VALIDOS,
  VALOR_MINIMO_DOACAO,
};
