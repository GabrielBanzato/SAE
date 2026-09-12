const AppError = require('../utils/AppError');

/**
 * Arredonda para 2 casas decimais evitando erros classicos de ponto
 * flutuante (ex.: 0.1 + 0.2).
 */
function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula o Preco de Venda ideal a partir do Custo, da Taxa da Maquininha (%)
 * e da Margem de Lucro Desejada (%).
 *
 * Ponto central: taxa e margem sao percentuais do PRECO DE VENDA (valor
 * final que passa na maquininha), nao do custo. Por isso NAO se pode fazer
 * `custo * (1 + taxa% + margem%)` - isso calcularia os percentuais em cima
 * do custo e o lojista receberia menos lucro/cobertura de taxa do que
 * pretendia.
 *
 * A equacao correta ("markup divisor"):
 *
 *   precoVenda - (taxa% * precoVenda) - (margem% * precoVenda) = custo
 *   precoVenda * (1 - taxa% - margem%) = custo
 *   precoVenda = custo / (1 - taxa% - margem%)
 *
 * Exemplo: custo = 10, taxa = 5%, margem = 30%
 *   precoVenda = 10 / (1 - 0.05 - 0.30) = 10 / 0.65 = 15.38
 *   Confirmando: 15.38 - 5%(15.38) - 30%(15.38) = 15.38 - 0.77 - 4.61 = 10.00 (custo) ✓
 */
function calcularPrecoVenda({ custo, taxaMaquininha, margemLucro }) {
  if (!Number.isFinite(custo) || custo < 0) {
    throw new AppError('custo deve ser um numero maior ou igual a zero.', 422);
  }
  if (!Number.isFinite(taxaMaquininha) || taxaMaquininha < 0) {
    throw new AppError('taxaMaquininha deve ser um numero (%) maior ou igual a zero.', 422);
  }
  if (!Number.isFinite(margemLucro) || margemLucro < 0) {
    throw new AppError('margemLucro deve ser um numero (%) maior ou igual a zero.', 422);
  }

  if (taxaMaquininha / 100 + margemLucro / 100 >= 1) {
    throw new AppError(
      'A soma da taxa da maquininha com a margem de lucro deve ser menor que 100%, senao o preco de venda tende ao infinito.',
      422
    );
  }

  // Formula exata: precoVenda = custo / (1 - (taxaMaquininha/100) - (margemLucro/100))
  const precoVenda = custo / (1 - taxaMaquininha / 100 - margemLucro / 100);

  return {
    custo: arredondar(custo),
    taxaMaquininha,
    margemLucro,
    precoVenda: arredondar(precoVenda),
    valorTaxaMaquininha: arredondar(precoVenda * (taxaMaquininha / 100)),
    valorMargemLucro: arredondar(precoVenda * (margemLucro / 100)),
  };
}

/**
 * Versao avancada do calculo, usada por POST /produtos/calcular-preco.
 * Suporta 3 modos (checados nesta ordem):
 *
 * 1) Calculo reverso (se `precoVendaForcado` vier preenchido): o lojista ja
 *    fixou o preco de venda (ex.: pra bater com a concorrencia) e quer
 *    saber quanto de lucro em R$ sobra depois de cobrir custo + taxa da
 *    maquininha:
 *
 *      lucroCalculado = precoVendaForcado - custo - (precoVendaForcado * taxa%)
 *
 * 2) `tipoLucro: 'percentual'` - mesma formula ja usada em
 *    `calcularPrecoVenda` (markup divisor), so que "lucroDesejado" no lugar
 *    de "margemLucro":
 *
 *      precoVenda = custo / (1 - taxa% - lucroDesejado%)
 *
 * 3) `tipoLucro: 'fixo'` - o lojista quer um valor de lucro fixo em R$ (nao
 *    um percentual). A taxa da maquininha ainda incide sobre o preco de
 *    venda final, entao nao da pra so somar `custo + lucroDesejado` - isso
 *    deixaria a taxa "comendo" parte do lucro fixo pretendido:
 *
 *      precoVenda - (taxa% * precoVenda) = custo + lucroDesejado
 *      precoVenda * (1 - taxa%) = custo + lucroDesejado
 *      precoVenda = (custo + lucroDesejado) / (1 - taxa%)
 */
function calcularPrecoVendaAvancado({ custo, taxaMaquininha, tipoLucro, lucroDesejado, precoVendaForcado }) {
  if (!Number.isFinite(custo) || custo < 0) {
    throw new AppError('custo deve ser um numero maior ou igual a zero.', 422);
  }
  if (!Number.isFinite(taxaMaquininha) || taxaMaquininha < 0) {
    throw new AppError('taxaMaquininha deve ser um numero (%) maior ou igual a zero.', 422);
  }
  if (taxaMaquininha / 100 >= 1) {
    throw new AppError('taxaMaquininha deve ser menor que 100%.', 422);
  }

  // Modo 1: calculo reverso - tem prioridade sobre tipoLucro/lucroDesejado.
  if (precoVendaForcado !== undefined && precoVendaForcado !== null && precoVendaForcado !== '') {
    if (!Number.isFinite(precoVendaForcado) || precoVendaForcado < 0) {
      throw new AppError('precoVendaForcado deve ser um numero maior ou igual a zero.', 422);
    }

    const valorTaxaMaquininha = arredondar(precoVendaForcado * (taxaMaquininha / 100));
    const lucroCalculado = arredondar(precoVendaForcado - custo - valorTaxaMaquininha);

    return {
      modo: 'reverso',
      custo: arredondar(custo),
      taxaMaquininha,
      precoVenda: arredondar(precoVendaForcado),
      valorTaxaMaquininha,
      lucroCalculado,
    };
  }

  if (tipoLucro !== 'percentual' && tipoLucro !== 'fixo') {
    throw new AppError("tipoLucro deve ser 'percentual' ou 'fixo' (ou informe precoVendaForcado para o calculo reverso).", 422);
  }
  if (!Number.isFinite(lucroDesejado) || lucroDesejado < 0) {
    throw new AppError('lucroDesejado deve ser um numero maior ou igual a zero.', 422);
  }

  let precoVenda;

  if (tipoLucro === 'percentual') {
    // Modo 2: lucro como percentual do preco de venda (markup divisor).
    if (taxaMaquininha / 100 + lucroDesejado / 100 >= 1) {
      throw new AppError(
        'A soma da taxa da maquininha com o lucro desejado (%) deve ser menor que 100%.',
        422
      );
    }
    precoVenda = custo / (1 - taxaMaquininha / 100 - lucroDesejado / 100);
  } else {
    // Modo 3: lucro como valor fixo em R$.
    precoVenda = (custo + lucroDesejado) / (1 - taxaMaquininha / 100);
  }

  const valorTaxaMaquininha = arredondar(precoVenda * (taxaMaquininha / 100));
  const valorLucro = tipoLucro === 'percentual' ? arredondar(precoVenda * (lucroDesejado / 100)) : arredondar(lucroDesejado);

  return {
    modo: tipoLucro,
    custo: arredondar(custo),
    taxaMaquininha,
    lucroDesejado,
    precoVenda: arredondar(precoVenda),
    valorTaxaMaquininha,
    valorLucro,
  };
}

module.exports = { calcularPrecoVenda, calcularPrecoVendaAvancado };
