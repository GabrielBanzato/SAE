const precificacaoService = require('../services/precificacao.service');

async function simular(request, reply) {
  const { custo, taxa_maquininha: taxaMaquininha, margem_lucro: margemLucro } = request.body || {};

  const resultado = precificacaoService.calcularPrecoVenda({
    custo: Number(custo),
    taxaMaquininha: Number(taxaMaquininha),
    margemLucro: Number(margemLucro),
  });

  return reply.send(resultado);
}

module.exports = { simular };
