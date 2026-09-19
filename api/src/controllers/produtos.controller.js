const produtosService = require('../services/produtos.service');
const precificacaoService = require('../services/precificacao.service');

const CAMPOS_ATUALIZAVEIS = [
  'nome',
  'custo',
  'preco_venda',
  'estoque_atual',
  'estoque_minimo',
  'sob_demanda',
  'ingredientes',
];

function parseId(request, reply) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id deve ser um numero inteiro positivo.' });
    return null;
  }
  return id;
}

/**
 * Valida so o FORMATO de `ingredientes` (array de
 * `{ ingrediente_id, quantidade_usada }`, ambos numeros positivos) - se o
 * ingrediente de fato existe/pertence a este tenant, e se a empresa e do
 * segmento "varejo_alimentacao", so a service sabe verificar (precisa do banco).
 */
function erroFormatoIngredientes(ingredientes) {
  if (!Array.isArray(ingredientes)) {
    return 'ingredientes deve ser um array de { ingrediente_id, quantidade_usada }.';
  }

  const invalido = ingredientes.some((item) => {
    const id = Number(item?.ingrediente_id);
    const quantidade = Number(item?.quantidade_usada);
    return !Number.isInteger(id) || id <= 0 || !Number.isFinite(quantidade) || quantidade <= 0;
  });

  if (invalido) {
    return 'Cada item de ingredientes precisa de ingrediente_id (inteiro positivo) e quantidade_usada (numero maior que 0).';
  }

  return null;
}

async function list(request, reply) {
  const produtos = await produtosService.list(request.server.prisma, request.tenantId);
  return reply.send(produtos);
}

async function create(request, reply) {
  const { nome, ingredientes } = request.body || {};

  if (!nome) {
    return reply.code(400).send({ error: 'nome e obrigatorio.' });
  }

  if (ingredientes !== undefined) {
    const erro = erroFormatoIngredientes(ingredientes);
    if (erro) return reply.code(400).send({ error: erro });
  }

  const produto = await produtosService.create(request.server.prisma, request.tenantId, request.body);
  return reply.code(201).send(produto);
}

async function update(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const body = request.body || {};
  const temCampoValido = CAMPOS_ATUALIZAVEIS.some((campo) => body[campo] !== undefined);
  if (!temCampoValido) {
    return reply
      .code(400)
      .send({ error: `Informe ao menos um campo para atualizar: ${CAMPOS_ATUALIZAVEIS.join(', ')}.` });
  }

  if (body.ingredientes !== undefined) {
    const erro = erroFormatoIngredientes(body.ingredientes);
    if (erro) return reply.code(400).send({ error: erro });
  }

  const produto = await produtosService.update(request.server.prisma, request.tenantId, id, body);
  return reply.send(produto);
}

/**
 * PATCH /produtos/:id/estoque - ajuste rapido de quantidade, so aceita
 * `estoque_atual` no body (diferente do `update` completo, que aceita
 * qualquer campo do cadastro). Pensado pra uma tela de Estoque com um
 * stepper/input de quantidade, sem precisar montar o payload do produto
 * inteiro so pra mudar um numero.
 */
async function atualizarEstoque(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  const { estoque_atual: estoqueAtual } = request.body || {};
  const estoqueNumero = Number(estoqueAtual);

  if (estoqueAtual === undefined || estoqueAtual === null || !Number.isInteger(estoqueNumero) || estoqueNumero < 0) {
    return reply.code(400).send({ error: 'estoque_atual e obrigatorio e deve ser um numero inteiro maior ou igual a 0.' });
  }

  const produto = await produtosService.atualizarEstoque(request.server.prisma, request.tenantId, id, estoqueNumero);
  return reply.send(produto);
}

async function remove(request, reply) {
  const id = parseId(request, reply);
  if (id === null) return;

  await produtosService.remove(request.server.prisma, request.tenantId, id);
  return reply.code(204).send();
}

async function calcularPreco(request, reply) {
  const { custo, taxaMaquininha, tipoLucro, lucroDesejado, precoVendaForcado } = request.body || {};

  const resultado = precificacaoService.calcularPrecoVendaAvancado({
    custo: Number(custo),
    taxaMaquininha: Number(taxaMaquininha),
    tipoLucro,
    lucroDesejado: lucroDesejado === undefined || lucroDesejado === null || lucroDesejado === '' ? undefined : Number(lucroDesejado),
    precoVendaForcado:
      precoVendaForcado === undefined || precoVendaForcado === null || precoVendaForcado === ''
        ? undefined
        : Number(precoVendaForcado),
  });

  return reply.send(resultado);
}

module.exports = { list, create, update, atualizarEstoque, remove, calcularPreco };
