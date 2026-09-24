const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

/**
 * Chat de Suporte (2026-09-23) - conversa bidirecional lojista <-> Supra
 * Admin dentro de um ChamadoSuporte (tabela `mensagens_chamado`, ver
 * schema.prisma#MensagemChamado), com mensagens de TEXTO e de AUDIO.
 *
 * UM service so pras duas pontas - o que muda entre lojista e admin e so o
 * ESCOPO (`tenantId`): o lojista passa `request.tenantId` (so enxerga
 * chamados da propria empresa, mesma regra de tenant isolation do resto da
 * API); o Supra Admin passa `null` (enxerga qualquer chamado - a rota dele
 * ja e protegida pelo hook de SUPERADMIN em superadmin.routes.js). O
 * `remetente` de cada mensagem tambem vem da rota (nunca do corpo da
 * requisicao) - um lojista nao consegue mandar mensagem "como ADMIN".
 *
 * Audio: recebido em base64 dentro de um JSON (sem dependencia de
 * multipart), validado (tipo + tamanho), salvo em DISCO em
 * `UPLOADS_DIR/chamados/<id>/<arquivo>` - o banco guarda so o caminho
 * relativo (`conteudo`). Em producao `UPLOADS_DIR` e um volume Docker
 * persistente (`sae_uploads`, ver docker-compose.yml) - sem ele, todo
 * recreate do container apagaria os audios.
 */

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'));

// Formatos que o MediaRecorder dos navegadores gera (Chrome/Firefox: webm/
// ogg com opus; Safari: mp4/aac) + mp3/wav por garantia. A extensao do
// arquivo salvo vem DAQUI (nunca de um nome de arquivo do cliente).
const MIMES_AUDIO = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};
const MIME_POR_EXTENSAO = Object.fromEntries(Object.entries(MIMES_AUDIO).map(([mime, ext]) => [ext, mime]));

const TAMANHO_MAX_AUDIO = 5 * 1024 * 1024; // 5 MB (~20 min de opus; o frontend corta em 3 min)
const TAMANHO_MAX_TEXTO = 4000;

/** Limite de corpo da rota de envio - base64 infla ~33%, mais folga pro JSON. */
const BODY_LIMIT_MENSAGEM = 8 * 1024 * 1024;

/** Formato publico de uma mensagem - o caminho do arquivo de audio NUNCA sai da API (o cliente usa a rota de audio). */
function serializarMensagem(mensagem) {
  return {
    id: mensagem.id,
    chamadoId: mensagem.chamadoId,
    remetente: mensagem.remetente,
    tipoMensagem: mensagem.tipoMensagem,
    conteudo: mensagem.tipoMensagem === 'TEXTO' ? mensagem.conteudo : null,
    criadoEm: mensagem.criadoEm,
  };
}

function whereChamado(chamadoId, tenantId) {
  return { id: chamadoId, ...(tenantId != null ? { empresaId: tenantId } : {}) };
}

/**
 * Chamado + mensagens. `aposId` (polling incremental do chat): quando
 * informado, devolve so as mensagens com id MAIOR que ele - o frontend
 * consulta a cada poucos segundos sem rebaixar a conversa inteira de novo.
 * O cabecalho do chamado (status/atualizadoEm) vem sempre, pra tela
 * refletir uma troca de status feita do outro lado.
 */
async function obterChamado(prisma, chamadoId, tenantId, { aposId } = {}) {
  const chamado = await prisma.chamadoSuporte.findFirst({
    where: whereChamado(chamadoId, tenantId),
    include: {
      empresa: { select: { id: true, razaoSocial: true, nomeLoja: true } },
      usuario: { select: { nome: true, codigoUsuario: true } },
      mensagens: {
        where: aposId ? { id: { gt: aposId } } : undefined,
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!chamado) {
    throw new AppError('Chamado nao encontrado.', 404);
  }
  return { ...chamado, mensagens: chamado.mensagens.map(serializarMensagem) };
}

/** Aceita base64 puro ou data URL ("data:audio/webm;codecs=opus;base64,...") - devolve { mime, buffer }. */
function decodificarAudio(audioBase64, mimeInformado) {
  if (typeof audioBase64 !== 'string' || !audioBase64) {
    throw new AppError('audio_base64 e obrigatorio para mensagens de audio.', 400);
  }

  let base64 = audioBase64;
  let mime = mimeInformado;
  const dataUrl = /^data:([^;,]+)[^,]*;base64,/.exec(audioBase64);
  if (dataUrl) {
    mime = mime || dataUrl[1];
    base64 = audioBase64.slice(dataUrl[0].length);
  }

  // "audio/webm;codecs=opus" -> "audio/webm"
  const mimeBase = String(mime || '').split(';')[0].trim().toLowerCase();
  if (!MIMES_AUDIO[mimeBase]) {
    throw new AppError(`Formato de audio nao suportado (${mimeBase || 'desconhecido'}).`, 415);
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw new AppError('Audio vazio.', 400);
  }
  if (buffer.length > TAMANHO_MAX_AUDIO) {
    throw new AppError('Audio muito grande (maximo 5 MB).', 413);
  }
  return { mime: mimeBase, buffer };
}

/**
 * Nova mensagem no chat. `remetente` ('LOJISTA'/'ADMIN') vem da ROTA, nunca
 * do corpo. Grava a mensagem e "toca" `chamado.atualizadoEm` na mesma
 * transacao (data da ultima alteracao do cabecalho do chat). Se o banco
 * falhar depois do arquivo de audio ja gravado, o arquivo e apagado - nao
 * sobra audio orfao em disco.
 */
async function enviarMensagem(prisma, chamadoId, tenantId, remetente, { tipo, conteudo, audioBase64, mime }) {
  const tipoMensagem = String(tipo || 'TEXTO').toUpperCase();
  if (!['TEXTO', 'AUDIO'].includes(tipoMensagem)) {
    throw new AppError("tipo deve ser 'TEXTO' ou 'AUDIO'.", 400);
  }

  const chamado = await prisma.chamadoSuporte.findFirst({ where: whereChamado(chamadoId, tenantId), select: { id: true } });
  if (!chamado) {
    throw new AppError('Chamado nao encontrado.', 404);
  }

  let valorConteudo;
  let arquivoGravado = null;

  if (tipoMensagem === 'TEXTO') {
    valorConteudo = typeof conteudo === 'string' ? conteudo.trim() : '';
    if (!valorConteudo) {
      throw new AppError('conteudo e obrigatorio para mensagens de texto.', 400);
    }
    if (valorConteudo.length > TAMANHO_MAX_TEXTO) {
      throw new AppError(`Mensagem muito longa (maximo ${TAMANHO_MAX_TEXTO} caracteres).`, 400);
    }
  } else {
    const { mime: mimeBase, buffer } = decodificarAudio(audioBase64, mime);
    const nomeArquivo = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${MIMES_AUDIO[mimeBase]}`;
    const relativo = path.posix.join('chamados', String(chamadoId), nomeArquivo);
    arquivoGravado = path.join(UPLOADS_DIR, relativo);
    await fs.mkdir(path.dirname(arquivoGravado), { recursive: true });
    await fs.writeFile(arquivoGravado, buffer);
    valorConteudo = relativo;
  }

  try {
    const [mensagem] = await prisma.$transaction([
      prisma.mensagemChamado.create({
        data: { chamadoId, remetente, tipoMensagem, conteudo: valorConteudo },
      }),
      prisma.chamadoSuporte.update({ where: { id: chamadoId }, data: { atualizadoEm: new Date() } }),
    ]);
    return serializarMensagem(mensagem);
  } catch (err) {
    if (arquivoGravado) await fs.unlink(arquivoGravado).catch(() => {});
    throw err;
  }
}

/**
 * Arquivo de audio de uma mensagem - { buffer, mime }. Checa o escopo pelo
 * CHAMADO (lojista so le audio de chamado da propria empresa) e garante que
 * o caminho resolvido continua dentro de UPLOADS_DIR (defesa contra path
 * traversal, mesmo o caminho sendo gerado pela propria API).
 */
async function lerAudio(prisma, chamadoId, mensagemId, tenantId) {
  const mensagem = await prisma.mensagemChamado.findFirst({
    where: { id: mensagemId, chamadoId, tipoMensagem: 'AUDIO', chamado: whereChamado(chamadoId, tenantId) },
    select: { conteudo: true },
  });
  if (!mensagem) {
    throw new AppError('Audio nao encontrado.', 404);
  }

  const absoluto = path.resolve(UPLOADS_DIR, mensagem.conteudo);
  if (!absoluto.startsWith(UPLOADS_DIR + path.sep)) {
    throw new AppError('Audio nao encontrado.', 404);
  }

  try {
    const buffer = await fs.readFile(absoluto);
    const extensao = path.extname(absoluto).slice(1).toLowerCase();
    return { buffer, mime: MIME_POR_EXTENSAO[extensao] || 'application/octet-stream' };
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Registro existe mas o arquivo nao - tipicamente container recriado
      // sem o volume `sae_uploads` montado (ver docker-compose.yml).
      throw new AppError('Arquivo de audio indisponivel no servidor.', 410);
    }
    throw err;
  }
}

module.exports = {
  obterChamado,
  enviarMensagem,
  lerAudio,
  BODY_LIMIT_MENSAGEM,
  TAMANHO_MAX_AUDIO,
  TAMANHO_MAX_TEXTO,
  UPLOADS_DIR,
};
