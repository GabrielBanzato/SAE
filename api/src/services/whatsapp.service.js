const AppError = require('../utils/AppError');
const { getWhatsAppProvider } = require('./whatsapp/index');
const { generateResponse } = require('./ai');

/**
 * Camada de dados do Inbox Unificado de WhatsApp (handoff IA <-> Humano).
 * Mesma convencao das outras services: `tenantId` explicito em todo `where`.
 *
 * Diferenca importante: `processarMensagemRecebida` (chamada pelo webhook
 * publico, sem JWT) recebe o tenant a partir da URL, nao de
 * `request.tenantId` - documentado na propria funcao.
 */

const REMETENTE = { CLIENTE: 'CLIENTE', BOT: 'BOT', HUMANO: 'HUMANO' };

// Persona padrao usada pelo AiProvider ao responder automaticamente - sem
// campo de customizacao por empresa ainda (fora do escopo desta tarefa).
const SYSTEM_PROMPT_PADRAO =
  'Voce e um assistente de atendimento via WhatsApp de uma pequena empresa. Responda de forma breve, cordial e objetiva, em portugues do Brasil.';

async function encontrarAtendimentoDoTenant(prisma, tenantId, id) {
  const atendimento = await prisma.atendimento.findFirst({ where: { id, empresaId: tenantId } });
  if (!atendimento) {
    throw new AppError('Atendimento nao encontrado.', 404);
  }
  return atendimento;
}

async function encontrarOuCriarCliente(prisma, empresaId, telefone) {
  const cliente = await prisma.cliente.findFirst({ where: { empresaId, telefone } });
  if (cliente) return cliente;

  // Cliente novo, identificado so pelo numero (sem nome ainda) - a equipe
  // pode renomear depois em Clientes.jsx, mesmo padrao ja usado pro
  // cadastro rapido do PDV.
  return prisma.cliente.create({ data: { empresaId, nome: telefone, telefone } });
}

async function encontrarOuCriarAtendimentoAberto(prisma, empresaId, clienteId) {
  const atendimento = await prisma.atendimento.findFirst({
    where: { empresaId, clienteId, status: 'ABERTO' },
  });
  if (atendimento) return atendimento;

  return prisma.atendimento.create({ data: { empresaId, clienteId, status: 'ABERTO', iaAtiva: true } });
}

function registrarMensagem(prisma, atendimentoId, remetente, conteudo) {
  return prisma.mensagem.create({ data: { atendimentoId, remetente, conteudo } });
}

/**
 * Ponto de entrada do webhook de recebimento (whatsapp.routes.js#POST
 * /webhook/:empresaId, rota publica - sem JWT, chamada pelo provedor de
 * WhatsApp, nao por um usuario logado). `empresaId` por isso vem da URL, nao
 * de `request.tenantId`.
 *
 * Fluxo: acha (ou cria) o Cliente pelo telefone, acha (ou abre) o
 * Atendimento ABERTO dele, grava a mensagem recebida como CLIENTE. Se
 * `ia_ativa` estiver ligada nesse atendimento, gera uma resposta via
 * AiProvider, grava como BOT e envia de volta pelo WhatsAppProvider - senao
 * so guarda a mensagem, esperando a equipe responder manualmente.
 */
async function processarMensagemRecebida(prisma, empresaId, { from, text }) {
  if (!from || !text) {
    throw new AppError('from e text sao obrigatorios.', 400);
  }

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const cliente = await encontrarOuCriarCliente(prisma, empresaId, from);
  const atendimento = await encontrarOuCriarAtendimentoAberto(prisma, empresaId, cliente.id);

  await registrarMensagem(prisma, atendimento.id, REMETENTE.CLIENTE, text);

  if (!atendimento.iaAtiva) {
    return { atendimento, respondidoPelaIa: false };
  }

  const resposta = await generateResponse(SYSTEM_PROMPT_PADRAO, text);
  await registrarMensagem(prisma, atendimento.id, REMETENTE.BOT, resposta);

  const provider = getWhatsAppProvider();
  await provider.sendMessage(from, resposta);

  return { atendimento, respondidoPelaIa: true };
}

/**
 * Atendimentos ABERTOS da empresa, com a ultima mensagem de cada um -
 * ordenados pela mensagem mais recente primeiro (mesmo comportamento da
 * lista de conversas do WhatsApp Web/Chatwoot). Atendimento sem nenhuma
 * mensagem ainda (caso raro - so aconteceria se criado fora do webhook)
 * ordena pela `dataCriacao`.
 */
async function listarAtendimentosAbertos(prisma, tenantId) {
  const atendimentos = await prisma.atendimento.findMany({
    where: { empresaId: tenantId, status: 'ABERTO' },
    include: {
      cliente: { select: { id: true, nome: true, telefone: true } },
      mensagens: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
  });

  return atendimentos
    .map(({ mensagens, ...atendimento }) => ({ ...atendimento, ultimaMensagem: mensagens[0] ?? null }))
    .sort((a, b) => {
      const dataA = a.ultimaMensagem?.timestamp ?? a.dataCriacao;
      const dataB = b.ultimaMensagem?.timestamp ?? b.dataCriacao;
      return new Date(dataB) - new Date(dataA);
    });
}

async function listarMensagens(prisma, tenantId, atendimentoId) {
  const atendimento = await encontrarAtendimentoDoTenant(prisma, tenantId, atendimentoId);
  return prisma.mensagem.findMany({ where: { atendimentoId: atendimento.id }, orderBy: { timestamp: 'asc' } });
}

/** Mensagem manual digitada pela equipe no Inbox - guarda como HUMANO e dispara de verdade no WhatsApp do cliente. */
async function enviarMensagemManual(prisma, tenantId, atendimentoId, texto) {
  const atendimento = await encontrarAtendimentoDoTenant(prisma, tenantId, atendimentoId);
  const cliente = await prisma.cliente.findFirst({ where: { id: atendimento.clienteId, empresaId: tenantId } });

  const mensagem = await registrarMensagem(prisma, atendimento.id, REMETENTE.HUMANO, texto);

  const provider = getWhatsAppProvider();
  await provider.sendMessage(cliente.telefone, texto);

  return mensagem;
}

/** Liga/desliga o handoff pra este atendimento - `false` tira a IA do caminho, so a equipe responde a partir dai. */
async function alternarIaAtiva(prisma, tenantId, atendimentoId, iaAtiva) {
  const atendimento = await encontrarAtendimentoDoTenant(prisma, tenantId, atendimentoId);
  return prisma.atendimento.update({ where: { id: atendimento.id }, data: { iaAtiva } });
}

module.exports = {
  processarMensagemRecebida,
  listarAtendimentosAbertos,
  listarMensagens,
  enviarMensagemManual,
  alternarIaAtiva,
};
