const AppError = require('../../utils/AppError');
const configuracoesService = require('../configuracoes.service');

/**
 * Preco de assinatura de um modulo - calculado SEMPRE no backend
 * (2026-09-24). Antes o desconto de Apoiador so existia no frontend
 * (Modulos.jsx) - com cobranca real, confiar num valor vindo do navegador
 * deixaria qualquer um pagar o que quisesse.
 *
 * Regra (decidida pelo dono do produto em 2026-09-24, substituiu os 50% de
 * antes): Apoiador (`Empresa.isDoador`) tem 15% de desconto, arredondado
 * PRA BAIXO no centavo (a favor do cliente): R$ 5,90 -> R$ 5,01.
 * Conta em CENTAVOS INTEIROS - `5.9 * 0.85` em ponto flutuante da
 * 5.0149999..., e arredondar isso da resultado diferente conforme a ordem
 * das operacoes. Espelhada em web/src/pages/Modulos.jsx (so pra EXIBIR).
 */
const DESCONTO_APOIADOR_PERCENTUAL = 15;

/**
 * Valor minimo por cobranca aceito pelo Asaas (R$ 5,00, configuravel caso
 * o contrato da conta seja diferente). Validado ANTES de chamar o gateway
 * pra dar uma mensagem clara em vez do erro generico dele.
 */
function valorMinimoCobranca() {
  const valor = Number(process.env.ASAAS_VALOR_MINIMO);
  return Number.isFinite(valor) && valor > 0 ? valor : 5;
}

function aplicarDescontoApoiador(preco) {
  const centavos = Math.round(Number(preco) * 100);
  return Math.floor((centavos * (100 - DESCONTO_APOIADOR_PERCENTUAL)) / 100) / 100;
}

/** Preco de tabela (Painel Master) do modulo/plano - { precoCheio } ou erro 422. */
async function precoDeTabela(prisma, modulo, planoIa) {
  const precos = await configuracoesService.obterPrecos(prisma);
  const preco = modulo === 'ia_whatsapp' ? precos.ia_whatsapp?.[planoIa] : precos[modulo];
  if (!Number.isFinite(Number(preco)) || Number(preco) <= 0) {
    throw new AppError('Este modulo nao tem preco configurado.', 422);
  }
  return Number(preco);
}

/**
 * Valor final que sera cobrado desta empresa por este modulo.
 * Retorna { precoCheio, valor, descontoAplicado }.
 */
async function calcularValorAssinatura(prisma, { isDoador, modulo, planoIa }) {
  const precoCheio = await precoDeTabela(prisma, modulo, planoIa);
  const valor = isDoador ? aplicarDescontoApoiador(precoCheio) : precoCheio;

  const minimo = valorMinimoCobranca();
  if (valor < minimo) {
    throw new AppError(
      `O valor deste modulo (R$ ${valor.toFixed(2).replace('.', ',')}) esta abaixo do minimo aceito pelo gateway de pagamento (R$ ${minimo
        .toFixed(2)
        .replace('.', ',')}). Fale com o suporte.`,
      422
    );
  }
  return { precoCheio, valor, descontoAplicado: isDoador ? DESCONTO_APOIADOR_PERCENTUAL : 0 };
}

module.exports = { calcularValorAssinatura, aplicarDescontoApoiador, DESCONTO_APOIADOR_PERCENTUAL, valorMinimoCobranca };
