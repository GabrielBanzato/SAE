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
      empresa: { select: { id: true, razaoSocial: true, nomeLoja: true, codigoLoja: true } },
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
 * Status considerados "finalizados" - uma mensagem nova (de qualquer lado)
 * num chamado assim o REABRE automaticamente (regra de 2026-09-24). Lista
 * (nao comparacao fixa com 'RESOLVIDO') pra um futuro status final, ex.
 * FECHADO/CANCELADO, entrar na regra so adicionando aqui.
 */
const STATUS_FINALIZADOS = ['RESOLVIDO'];
const STATUS_REABERTO = 'ABERTO';

/**
 * Re-executa a transacao se o banco a abortar por deadlock/conflito de
 * escrita (Prisma P2034) - segunda linha de defesa: a ordem de locks em
 * `enviarMensagem` ja evita o deadlock conhecido, mas outra escrita
 * concorrente no mesmo chamado (ex.: troca de status pelo admin) nao deve
 * virar 500 pro usuario. A transacao e reexecutada INTEIRA (o banco ja
 * desfez a anterior), com um pequeno atraso crescente.
 */
async function comRetryDeDeadlock(executar, tentativas = 3) {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await executar();
    } catch (err) {
      if (err?.code !== 'P2034' || tentativa >= tentativas) throw err;
      await new Promise((resolve) => setTimeout(resolve, 25 * tentativa));
    }
  }
}

/**
 * Nova mensagem no chat. `remetente` ('LOJISTA'/'ADMIN') vem da ROTA, nunca
 * do corpo.
 *
 * Numa UNICA transacao interativa (`prisma.$transaction(async (tx) => ...)`):
 *   1. cria a mensagem;
 *   2. REABRE o chamado se ele estava finalizado (RESOLVIDO -> ABERTO);
 *   3. "toca" `atualizadoEm` (data da ultima alteracao do cabecalho do chat)
 *      e le o status final pra devolver ao cliente.
 * Se qualquer passo falhar, nada fica gravado (nem mensagem sem reabertura,
 * nem reabertura sem mensagem).
 *
 * Por que a reabertura e um `updateMany` CONDICIONAL (`where status IN
 * finalizados`) e nao "ler o status e depois atualizar": no MySQL
 * (REPEATABLE READ) um SELECT comum dentro da transacao e uma leitura de
 * snapshot SEM lock - se o Supra Admin trocasse o status entre a leitura e a
 * escrita, o valor dele seria sobrescrito com base num dado velho. O
 * UPDATE com a condicao no WHERE e verificado e aplicado pelo proprio banco
 * numa instrucao atomica (com lock de linha); `count` diz se reabriu.
 *
 * Se o banco falhar depois do arquivo de audio ja gravado, o arquivo e
 * apagado - nao sobra audio orfao em disco (o arquivo e gravado ANTES da
 * transacao de proposito: I/O de disco dentro dela seguraria o lock da
 * linha do chamado a toa).
 *
 * Retorno: a mensagem serializada + `chamado: { id, status, atualizadoEm,
 * reaberto }` - o frontend atualiza o cabecalho (badge de status) na hora,
 * sem esperar o proximo polling.
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
    const { mensagem, chamado: chamadoAtualizado } = await comRetryDeDeadlock(() =>
      prisma.$transaction(async (tx) => {
        const agora = new Date();

        // ORDEM IMPORTA (deadlock real encontrado em teste com envios
        // simultaneos): o chamado e atualizado ANTES de inserir a mensagem.
        // O INSERT em `mensagens_chamado` pega um lock COMPARTILHADO na
        // linha do chamado (checagem da FK); se o UPDATE do chamado viesse
        // depois, duas transacoes segurariam o lock S e esperariam o X uma
        // da outra -> deadlock (P2034). Atualizando primeiro, a 1a
        // instrucao ja pega o lock EXCLUSIVO da linha e as concorrentes
        // simplesmente esperam na fila.
        //
        // 1) Reabertura atomica - so altera se o status AINDA for
        //    finalizado no momento do UPDATE (ver comentario da funcao).
        const reabertura = await tx.chamadoSuporte.updateMany({
          where: { id: chamadoId, status: { in: STATUS_FINALIZADOS } },
          data: { status: STATUS_REABERTO },
        });

        // 2) "Toca" a ultima alteracao e le o status final.
        const chamado = await tx.chamadoSuporte.update({
          where: { id: chamadoId },
          data: { atualizadoEm: agora },
          select: { id: true, status: true, atualizadoEm: true },
        });

        // 3) Mensagem por ultimo (linha do chamado ja travada por esta transacao).
        const mensagem = await tx.mensagemChamado.create({
          data: { chamadoId, remetente, tipoMensagem, conteudo: valorConteudo, criadoEm: agora },
        });

        return { mensagem, chamado: { ...chamado, reaberto: reabertura.count > 0 } };
      })
    );

    return { ...serializarMensagem(mensagem), chamado: chamadoAtualizado };
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
  STATUS_FINALIZADOS,
};
