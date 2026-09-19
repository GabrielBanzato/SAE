const AppError = require('../utils/AppError');

/**
 * Camada de dados de produtos.
 *
 * Toda funcao aqui exige `tenantId` explicitamente e o usa em TODO where -
 * este e o padrao a seguir em qualquer novo service do sistema para manter
 * o isolamento entre empresas.
 */

// Sempre inclui a Ficha Tecnica (com o Ingrediente de cada linha) em toda
// resposta de produto - pra empresas fora do segmento "varejo_alimentacao"
// isso so sai como um array vazio (nunca populado, ver
// `validarSegmentoAlimenticio` abaixo), custo praticamente zero de incluir
// sempre em vez de condicionar a resposta ao segmento da empresa.
const INCLUDE_FICHA_TECNICA = { fichaTecnica: { include: { ingrediente: true } } };

async function list(prisma, tenantId) {
  return prisma.produto.findMany({
    where: { empresaId: tenantId },
    orderBy: { nome: 'asc' },
    include: INCLUDE_FICHA_TECNICA,
  });
}

async function findById(prisma, tenantId, id) {
  return prisma.produto.findFirst({ where: { id, empresaId: tenantId }, include: INCLUDE_FICHA_TECNICA });
}

/**
 * So empresas do segmento "varejo_alimentacao" (Empresa.segmento) podem
 * vincular ingredientes a um produto - lanca 403 se o campo `ingredientes`
 * vier no body de uma empresa de outro segmento.
 */
async function validarSegmentoAlimenticio(prisma, tenantId) {
  const empresa = await prisma.empresa.findUnique({ where: { id: tenantId }, select: { segmento: true } });

  if (!empresa || empresa.segmento !== 'varejo_alimentacao') {
    throw new AppError(
      'Vincular ingredientes a um produto so e permitido para empresas do segmento varejo_alimentacao.',
      403
    );
  }
}

/**
 * Substitui a Ficha Tecnica inteira do produto pela lista recebida (apaga
 * as linhas antigas e insere as novas, em vez de tentar um diff) - mais
 * simples que reconciliar adicoes/remocoes/alteracoes de quantidade
 * individualmente, e a lista de ingredientes de uma receita costuma ser
 * pequena o bastante pra isso nao ser um problema de performance.
 *
 * Valida que todo `ingrediente_id` recebido existe e pertence a este
 * tenant ANTES de gravar - nunca confia em ids vindos do body sem checar
 * (mesmo motivo de `clienteId` em vendas.service.js).
 */
async function sincronizarFichaTecnica(tx, tenantId, produtoId, ingredientes) {
  await tx.fichaTecnica.deleteMany({ where: { produtoId } });

  if (ingredientes.length === 0) return;

  const ids = ingredientes.map((item) => Number(item.ingrediente_id));
  const encontrados = await tx.ingrediente.findMany({
    where: { id: { in: ids }, empresaId: tenantId },
    select: { id: true },
  });

  if (encontrados.length !== new Set(ids).size) {
    throw new AppError('Um ou mais ingredientes informados nao existem ou nao pertencem a esta empresa.', 404);
  }

  await tx.fichaTecnica.createMany({
    data: ingredientes.map((item) => ({
      produtoId,
      ingredienteId: Number(item.ingrediente_id),
      quantidadeUsada: item.quantidade_usada,
    })),
  });
}

async function create(prisma, tenantId, dados) {
  const {
    nome,
    custo = 0,
    preco_venda: precoVenda = 0,
    estoque_atual: estoqueAtual = 0,
    estoque_minimo: estoqueMinimo = 0,
    sob_demanda: sobDemanda = false,
    ingredientes,
  } = dados;

  if (ingredientes !== undefined) {
    await validarSegmentoAlimenticio(prisma, tenantId);
  }

  return prisma.$transaction(async (tx) => {
    const produto = await tx.produto.create({
      data: {
        empresaId: tenantId, // sempre do token (request.tenantId), nunca do body
        nome,
        custo,
        precoVenda,
        // estoqueAtual/estoqueMinimo sao Int no Prisma - Number() evita um 500
        // generico se vierem como string (ex.: "10") de algum client futuro.
        // custo/precoVenda sao Decimal e aceitam string ou number sem problema.
        estoqueAtual: Number(estoqueAtual),
        estoqueMinimo: Number(estoqueMinimo),
        sobDemanda: Boolean(sobDemanda),
      },
    });

    if (ingredientes !== undefined) {
      await sincronizarFichaTecnica(tx, tenantId, produto.id, ingredientes);
    }

    return tx.produto.findFirst({ where: { id: produto.id }, include: INCLUDE_FICHA_TECNICA });
  });
}

/**
 * Atualizacao parcial: so aplica os campos que vierem no body (PUT aqui se
 * comporta mais como um PATCH na pratica) - permite, por exemplo, ajustar
 * so o estoque sem reenviar nome/custo/preco. `updateMany` com `id` +
 * `empresaId` no WHERE (em vez de `update({ where: { id } })`) garante o
 * isolamento de tenant de forma atomica: um id de outra empresa da
 * `count: 0`, nunca atualiza a linha errada.
 */
async function update(prisma, tenantId, id, dados) {
  const {
    nome,
    custo,
    preco_venda: precoVenda,
    estoque_atual: estoqueAtual,
    estoque_minimo: estoqueMinimo,
    sob_demanda: sobDemanda,
    ingredientes,
  } = dados;

  if (ingredientes !== undefined) {
    await validarSegmentoAlimenticio(prisma, tenantId);
  }

  const data = {};
  if (nome !== undefined) data.nome = nome;
  if (custo !== undefined) data.custo = custo;
  if (precoVenda !== undefined) data.precoVenda = precoVenda;
  if (estoqueAtual !== undefined) data.estoqueAtual = Number(estoqueAtual);
  if (estoqueMinimo !== undefined) data.estoqueMinimo = Number(estoqueMinimo);
  if (sobDemanda !== undefined) data.sobDemanda = Boolean(sobDemanda);

  return prisma.$transaction(async (tx) => {
    // Confere existencia/posse ANTES de tentar o update - um body que so
    // manda `ingredientes` (sem nenhum campo do cadastro em si) deixaria
    // `data` vazio, e `updateMany({ data: {} })` NAO e um "no-op
    // inofensivo": o Prisma nao gera nenhum SET, entao o `count` retornado
    // fica 0 mesmo o produto existindo - virava um 404 falso (achado
    // testando este cenario especifico). Separar a checagem de existencia
    // do update em si evita o problema.
    const produtoExistente = await tx.produto.findFirst({
      where: { id, empresaId: tenantId },
      select: { id: true },
    });

    if (!produtoExistente) {
      throw new AppError('Produto nao encontrado.', 404);
    }

    if (Object.keys(data).length > 0) {
      await tx.produto.updateMany({ where: { id, empresaId: tenantId }, data });
    }

    if (ingredientes !== undefined) {
      await sincronizarFichaTecnica(tx, tenantId, id, ingredientes);
    }

    return tx.produto.findFirst({ where: { id, empresaId: tenantId }, include: INCLUDE_FICHA_TECNICA });
  });
}

/**
 * Atualizacao rapida de estoque (PATCH /produtos/:id/estoque) - versao
 * enxuta de `update` acima, feita pra uma tela de "Estoque" que so precisa
 * ajustar a quantidade rapidamente, sem montar/reenviar o cadastro inteiro
 * do produto (nome, custo, preco_venda etc.). Mesma convencao de
 * isolamento de tenant (`updateMany` com `id` + `empresaId` no WHERE).
 */
async function atualizarEstoque(prisma, tenantId, id, estoqueAtual) {
  const resultado = await prisma.produto.updateMany({
    where: { id, empresaId: tenantId },
    data: { estoqueAtual },
  });

  if (resultado.count === 0) {
    throw new AppError('Produto nao encontrado.', 404);
  }

  return findById(prisma, tenantId, id);
}

/**
 * `deleteMany` (nao `delete({ where: { id } })`) pelo mesmo motivo de
 * `update` acima - isolamento de tenant atomico no proprio WHERE.
 *
 * `Venda.produtoId` tem `onDelete: Restrict` no schema (preserva
 * historico financeiro - ver schema.prisma) - excluir um produto que ja
 * tem vendas registradas falha no MySQL com uma violacao de FK (Prisma
 * `P2003`), traduzida aqui pra um erro de negocio legivel em vez de
 * vazar o erro cru do banco pro cliente da API. `FichaTecnica.produtoId`
 * e `onDelete: Cascade` (nao Restrict) - excluir o produto ja leva a
 * receita dele junto, sem erro.
 */
async function remove(prisma, tenantId, id) {
  try {
    const resultado = await prisma.produto.deleteMany({ where: { id, empresaId: tenantId } });

    if (resultado.count === 0) {
      throw new AppError('Produto nao encontrado.', 404);
    }
  } catch (err) {
    if (err.code === 'P2003') {
      throw new AppError('Nao e possivel excluir um produto que ja tem vendas registradas.', 409);
    }
    throw err;
  }
}

module.exports = { list, findById, create, update, atualizarEstoque, remove };
