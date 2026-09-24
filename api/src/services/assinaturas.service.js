const AppError = require('../utils/AppError');
const asaas = require('./asaas/asaasClient');
const { calcularValorAssinatura } = require('./assinaturas/precos');
const empresaService = require('./empresa.service');

/**
 * Assinaturas reais de modulos via Asaas (2026-09-24) - substitui o
 * checkout SIMULADO (`PUT /empresa/pagamentos`) da App Store.
 *
 * Fluxo:
 *  1) `iniciarCheckout` (admin clica "Pagar com Pix"/"Pagar com Cartao"):
 *     calcula o valor no backend, garante o customer no Asaas, cria a
 *     assinatura MENSAL e devolve os dados da 1a cobranca:
 *       - PIX:    QR Code (PNG base64) + copia-e-cola;
 *       - CARTAO: `invoiceUrl` - pagina de pagamento HOSPEDADA pelo Asaas.
 *                 Os dados do cartao sao digitados LA, nunca passam pelo
 *                 SAE (fora do escopo PCI-DSS; nada de numero de cartao no
 *                 nosso backend, log ou banco).
 *  2) O frontend faz polling em `obterStatus` enquanto o modal esta aberto.
 *  3) O Asaas chama o webhook (`processarWebhook`) quando o pagamento e
 *     recebido/confirmado -> assinatura ATIVA + modulo liberado (mesmo
 *     `empresaService.confirmarPagamento` do checkout simulado, entao o
 *     resto do sistema - menu, gate de rotas, Painel Master - nao muda).
 */

const FORMAS = { PIX: 'PIX', CARTAO: 'CREDIT_CARD' };

const EVENTOS_PAGO = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];
const EVENTO_ATRASO = 'PAYMENT_OVERDUE';

/** Garante o customer do Asaas desta empresa (cria no 1o checkout e guarda o id). */
async function garantirClienteAsaas(prisma, empresa, emailContato) {
  if (empresa.asaasCustomerId) return empresa.asaasCustomerId;

  const cliente = await asaas.criarCliente({
    nome: empresa.razaoSocial,
    cpfCnpj: empresa.documento,
    email: emailContato,
    empresaId: empresa.id,
  });
  // updateMany com `asaasCustomerId: null` no where: se dois checkouts
  // simultaneos criarem 2 customers, so o primeiro e gravado (o outro fica
  // orfao no Asaas, inofensivo) e os dois seguem com o id que ficou.
  await prisma.empresa.updateMany({ where: { id: empresa.id, asaasCustomerId: null }, data: { asaasCustomerId: cliente.id } });
  const atual = await prisma.empresa.findUnique({ where: { id: empresa.id }, select: { asaasCustomerId: true } });
  return atual.asaasCustomerId;
}

/** 1a cobranca da assinatura - gerada pelo Asaas junto com ela; tenta de novo rapidinho se ainda nao apareceu. */
async function primeiraCobranca(subscriptionId) {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const { data } = await asaas.listarCobrancasDaAssinatura(subscriptionId);
    const pendente = (data || []).find((p) => p.status === 'PENDING') || (data || [])[0];
    if (pendente) return pendente;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new AppError('O gateway ainda nao gerou a cobranca desta assinatura. Tente de novo em instantes.', 502);
}

/** Monta a resposta do checkout conforme a forma (Pix: QR; cartao: link da pagina do Asaas). */
async function respostaDoCheckout(assinatura, cobranca) {
  const base = {
    assinaturaId: assinatura.id,
    status: assinatura.status,
    forma: assinatura.formaPagamento === FORMAS.PIX ? 'PIX' : 'CARTAO',
    valor: Number(assinatura.valor),
  };
  if (assinatura.formaPagamento === FORMAS.PIX) {
    const qr = await asaas.obterQrCodePix(cobranca.id);
    return { ...base, pix: { qrCodeBase64: qr.encodedImage, copiaECola: qr.payload, expiraEm: qr.expirationDate } };
  }
  return { ...base, invoiceUrl: cobranca.invoiceUrl };
}

/**
 * POST /assinaturas/checkout - { modulo, plano_ia?, forma: 'PIX'|'CARTAO' }.
 * Reabrir o modal/clicar de novo com os MESMOS parametros reaproveita a
 * assinatura pendente (nao cria cobranca duplicada no Asaas); trocar forma,
 * plano ou valor cancela a pendente la e cria outra.
 */
async function iniciarCheckout(prisma, tenantId, usuarioId, { modulo, planoIa, forma }) {
  if (!empresaService.MODULOS_PAGOS.includes(modulo)) {
    throw new AppError(`modulo deve ser um dos seguintes: ${empresaService.MODULOS_PAGOS.join(', ')}.`, 422);
  }
  if (modulo === 'ia_whatsapp' && !empresaService.PLANOS_IA_WHATSAPP.includes(planoIa)) {
    throw new AppError(`plano_ia deve ser um dos seguintes: ${empresaService.PLANOS_IA_WHATSAPP.join(', ')}.`, 422);
  }
  const billingType = FORMAS[forma];
  if (!billingType) throw new AppError("forma deve ser 'PIX' ou 'CARTAO'.", 422);
  const planoFinal = modulo === 'ia_whatsapp' ? planoIa : null;

  const empresa = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: { id: true, razaoSocial: true, documento: true, isDoador: true, asaasCustomerId: true, pagamentosAtivos: true },
  });
  if (!empresa) throw new AppError('Empresa nao encontrada.', 404);

  const existente = await prisma.assinaturaModulo.findUnique({ where: { empresaId_modulo: { empresaId: tenantId, modulo } } });
  if (existente?.status === 'ATIVA' && existente.planoIa === planoFinal) {
    throw new AppError('Este modulo ja tem uma assinatura ativa.', 409);
  }

  const { valor } = await calcularValorAssinatura(prisma, { isDoador: empresa.isDoador, modulo, planoIa: planoFinal });

  // Mesma assinatura pendente (mesma forma/plano/valor) -> reaproveita.
  if (
    existente?.status === 'PENDENTE' &&
    existente.formaPagamento === billingType &&
    existente.planoIa === planoFinal &&
    Number(existente.valor) === valor
  ) {
    const cobranca = await primeiraCobranca(existente.asaasSubscriptionId);
    return respostaDoCheckout(existente, cobranca);
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { email: true } });
  const customerId = await garantirClienteAsaas(prisma, empresa, usuario?.email);

  // Pendente/atrasada/cancelada com parametros diferentes: cancela a antiga no Asaas antes de criar outra.
  if (existente && existente.status !== 'CANCELADA') {
    await asaas.cancelarAssinatura(existente.asaasSubscriptionId).catch(() => {});
  }

  const assinaturaAsaas = await asaas.criarAssinatura({
    customerId,
    billingType,
    valor,
    descricao: `SAE - modulo ${modulo}${planoFinal ? ` (${planoFinal})` : ''}`,
    externalReference: `empresa:${tenantId}:modulo:${modulo}`,
  });
  const cobranca = await primeiraCobranca(assinaturaAsaas.id);

  const dados = {
    planoIa: planoFinal,
    valor,
    formaPagamento: billingType,
    status: 'PENDENTE',
    asaasSubscriptionId: assinaturaAsaas.id,
    asaasPaymentId: cobranca.id,
    invoiceUrl: cobranca.invoiceUrl ?? null,
    pagoEm: null,
  };
  const assinatura = await prisma.assinaturaModulo.upsert({
    where: { empresaId_modulo: { empresaId: tenantId, modulo } },
    create: { empresaId: tenantId, modulo, ...dados },
    update: dados,
  });

  return respostaDoCheckout(assinatura, cobranca);
}

/** GET /assinaturas/:id/status - usado pelo polling do modal. Tenant-scoped. */
async function obterStatus(prisma, tenantId, assinaturaId) {
  const assinatura = await prisma.assinaturaModulo.findFirst({
    where: { id: assinaturaId, empresaId: tenantId },
    select: { id: true, modulo: true, status: true, pagoEm: true },
  });
  if (!assinatura) throw new AppError('Assinatura nao encontrada.', 404);
  return assinatura;
}

/** GET /assinaturas - assinaturas da empresa (a App Store usa pra saber quais switches cancelam cobranca). */
function listar(prisma, tenantId) {
  return prisma.assinaturaModulo.findMany({
    where: { empresaId: tenantId },
    select: {
      id: true,
      modulo: true,
      planoIa: true,
      valor: true,
      formaPagamento: true,
      status: true,
      pagoEm: true,
      canceladoEm: true,
      atualizadoEm: true,
    },
    orderBy: { modulo: 'asc' },
  });
}

// Status em que ainda existe cobranca recorrente viva no Asaas.
const STATUS_COM_COBRANCA = ['PENDENTE', 'ATIVA', 'ATRASADA'];

/**
 * DELETE /assinaturas/:modulo - o lojista (admin) desliga um modulo pago na
 * App Store = CANCELA a assinatura (2026-09-24).
 *
 * Seguranca/escopo: a assinatura e buscada por (empresa DO TOKEN, modulo) -
 * nunca por um id vindo do cliente; nao ha como cancelar a de outra empresa.
 *
 * Ordem das operacoes (de proposito):
 *  1) cancela NO ASAAS primeiro. Se falhar -> erro e NADA muda localmente:
 *     tirar o acesso de quem continuaria sendo cobrado seria o pior cenario.
 *     404 do Asaas (assinatura ja removida pelo painel) = ja cancelada, segue.
 *  2) so entao, numa transacao: status CANCELADA + `canceladoEm` e revoga o
 *     acesso (remove de `pagamentosAtivos` E de `modulosAtivos`) pelo mesmo
 *     `empresaService.restringirModulo` que o "Restringir" do Painel Master usa.
 *
 * Efeitos no Asaas (doc oficial): param as cobrancas futuras e as
 * pendentes/vencidas sao excluidas; as ja pagas continuam registradas - SEM
 * estorno/proporcional automatico (acesso removido na hora, como a tela avisa).
 *
 * Modulo pago SEM assinatura no Asaas (checkout simulado antigo ou liberado
 * pelo Supra Admin) nao tem o que cancelar -> 404; a App Store usa o toggle
 * comum pra esses (so esconde, sem cobranca envolvida).
 */
async function cancelarAssinaturaModulo(prisma, tenantId, modulo) {
  if (!empresaService.MODULOS_PAGOS.includes(modulo)) {
    throw new AppError(`modulo deve ser um dos seguintes: ${empresaService.MODULOS_PAGOS.join(', ')}.`, 422);
  }

  const assinatura = await prisma.assinaturaModulo.findUnique({
    where: { empresaId_modulo: { empresaId: tenantId, modulo } },
  });
  if (!assinatura || !STATUS_COM_COBRANCA.includes(assinatura.status)) {
    throw new AppError('Este modulo nao tem uma assinatura ativa para cancelar.', 404);
  }

  try {
    await asaas.cancelarAssinatura(assinatura.asaasSubscriptionId);
  } catch (err) {
    if (err.statusAsaas !== 404) throw err;
  }

  return prisma.$transaction(async (tx) => {
    // Condicional no status: dois cliques/abas simultaneos nao "cancelam duas vezes".
    const alterou = await tx.assinaturaModulo.updateMany({
      where: { id: assinatura.id, status: { in: STATUS_COM_COBRANCA } },
      data: { status: 'CANCELADA', canceladoEm: new Date() },
    });
    const acesso = await empresaService.restringirModulo(tx, tenantId, { modulo });
    return { modulo, status: 'CANCELADA', jaEstavaCancelada: alterou.count === 0, ...acesso };
  });
}

/**
 * Processa um evento de webhook do Asaas. Idempotente: o `id` do evento e
 * gravado em `webhook_eventos_asaas` NA MESMA TRANSACAO que aplica o efeito -
 * evento repetido (o Asaas reenvia ate receber 200) vira no-op; se a
 * aplicacao falhar, o registro tambem nao fica e o reenvio tenta de novo.
 *
 * Retorna { processado: boolean, motivo } - o controller responde 200 em
 * TODOS os casos "normais" (inclusive eventos que nao nos interessam): o
 * Asaas interrompe a fila de webhooks depois de 15 falhas seguidas.
 */
async function processarWebhook(prisma, evento) {
  const eventoId = evento?.id;
  const tipo = evento?.event;
  const pagamento = evento?.payment;
  if (!eventoId || !tipo) throw new AppError('Evento de webhook invalido.', 400);

  if (!pagamento?.subscription || (!EVENTOS_PAGO.includes(tipo) && tipo !== EVENTO_ATRASO)) {
    return { processado: false, motivo: 'evento ignorado' };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Idempotencia: PK duplicada (P2002) = ja processado.
      await tx.webhookEventoAsaas.create({ data: { id: eventoId, evento: tipo, paymentId: pagamento.id ?? null } });

      const assinatura = await tx.assinaturaModulo.findUnique({ where: { asaasSubscriptionId: pagamento.subscription } });
      if (!assinatura) return { processado: false, motivo: 'assinatura desconhecida' };

      // Assinatura CANCELADA pelo lojista: pagamento que chegue depois (ex.:
      // cartao confirmado segundos antes do DELETE) NAO reativa o modulo -
      // o cliente pediu pra cancelar. Fica no log pro suporte avaliar estorno.
      if (assinatura.status === 'CANCELADA') {
        return { processado: false, motivo: 'pagamento de assinatura CANCELADA - avaliar estorno no painel do Asaas' };
      }

      if (tipo === EVENTO_ATRASO) {
        await tx.assinaturaModulo.update({ where: { id: assinatura.id }, data: { status: 'ATRASADA' } });
        return { processado: true, motivo: 'assinatura marcada como atrasada' };
      }

      await tx.assinaturaModulo.update({
        where: { id: assinatura.id },
        data: { status: 'ATIVA', asaasPaymentId: pagamento.id ?? assinatura.asaasPaymentId, pagoEm: new Date() },
      });
      // Libera o modulo pelo MESMO caminho do checkout simulado (pagamentosAtivos + modulosAtivos).
      await empresaService.confirmarPagamento(tx, assinatura.empresaId, {
        modulo: assinatura.modulo,
        planoIa: assinatura.planoIa ?? undefined,
      });
      return { processado: true, motivo: 'assinatura ativada' };
    });
  } catch (err) {
    if (err.code === 'P2002') return { processado: false, motivo: 'evento repetido' };
    throw err;
  }
}

module.exports = { iniciarCheckout, obterStatus, listar, cancelarAssinaturaModulo, processarWebhook, FORMAS };
