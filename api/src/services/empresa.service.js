const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
// SEGMENTOS_VALIDOS/modulosDoSegmento/MODULOS_BASE/MODULOS_VALIDOS moram em
// auth.service.js, ao lado de MAPA_MODULOS (a fonte da verdade do catalogo
// de modulos). Reexportados abaixo por compatibilidade - nenhum outro
// arquivo alem deste precisa saber que a definicao mora la.
const { SEGMENTOS_VALIDOS, MODULOS_BASE, MODULOS_VALIDOS, modulosDoSegmento } = require('./auth.service');

const SALT_ROUNDS = 10;

const PLANOS_VALIDOS = ['gratuito', 'apoiador'];
const ROLES_VALIDOS = ['admin', 'gerente', 'vendedor'];

// Quantos usuarios cada plano pode ter vinculados ao mesmo tenant_id.
const LIMITE_USUARIOS_POR_PLANO = { gratuito: 2, apoiador: 5 };

// Contribuicao minima mensal pra virar Apoiador (a "mensalidade caridosa").
const VALOR_MINIMO_CONTRIBUICAO = 10;

/**
 * Dados da propria empresa (tenant). `tenantId` sempre vem do token
 * (request.tenantId), nunca de parametro de rota/query - do contrario um
 * usuario poderia consultar dados de outra empresa trocando um id na URL.
 */
async function obterDados(prisma, tenantId) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      razaoSocial: true,
      nomeLoja: true,
      tipoPessoa: true,
      documento: true,
      endereco: true,
      telefone: true,
      plano: true,
      segmento: true,
      modulosAtivos: true,
      valorContribuicao: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });

  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  // `modulos` (exposto ao frontend, ver App.jsx/Sidebar.jsx) vem direto do
  // campo persistido `modulosAtivos` - deixou de ser recalculado do
  // segmento a cada leitura (arquitetura modular de 2026-09-22, ver
  // auth.service.js). O AuthContext do frontend chama esta rota a cada
  // reidratacao de sessao e sobrescreve o `empresa` local com a resposta,
  // entao um `modulos` ausente aqui apagaria (silenciosamente) o que o
  // login/Modulos.jsx tinham acabado de definir - por isso o `select`
  // acima sempre inclui `modulosAtivos`, e o fallback abaixo (so pra linhas
  // antigas sem o campo preenchido) nunca deixa `modulos` sair `null`.
  const { modulosAtivos, ...dadosPublicos } = empresa;
  return { ...dadosPublicos, modulos: modulosAtivos ?? modulosDoSegmento(empresa.segmento) };
}

/**
 * Atualizacao parcial dos dados cadastrais - so aplica os campos presentes
 * no body (mesmo padrao de lancamentos.service.js#update/
 * produtos.service.js#update). `segmento`, quando presente, precisa ser um
 * dos valores aceitos - os demais campos (razaoSocial/endereco/telefone)
 * sao texto livre, sem validacao alem de "nao vazio" pra razaoSocial.
 *
 * Documento e tipoPessoa NUNCA sao editaveis por aqui (mesma regra ja
 * aplicada no frontend, DadosDaLoja.jsx - mudar de PF pra PJ ou o proprio
 * documento depois do cadastro nao e uma operacao de formulario simples) -
 * mesmo que venham no body, sao ignorados silenciosamente (nao inclusos no
 * `data` do update).
 */
async function atualizarDados(prisma, tenantId, { razaoSocial, nomeLoja, endereco, telefone, segmento }) {
  if (razaoSocial !== undefined && !razaoSocial.trim()) {
    throw new AppError('razaoSocial nao pode ficar vazio.', 422);
  }
  // segmento agora e obrigatorio no cadastro (schema.prisma), mas aqui na
  // ATUALIZACAO continua podendo ficar de fora do body (so nao pode vir um
  // valor invalido se vier) - trocar de segmento depois do cadastro e uma
  // decisao consciente da loja, nao precisa ser repetida em toda edicao.
  if (segmento !== undefined && !SEGMENTOS_VALIDOS.includes(segmento)) {
    throw new AppError(`segmento deve ser um dos seguintes: ${SEGMENTOS_VALIDOS.join(', ')}.`, 422);
  }

  const data = {};
  if (razaoSocial !== undefined) data.razaoSocial = razaoSocial.trim();
  if (nomeLoja !== undefined) data.nomeLoja = nomeLoja.trim() || null;
  if (endereco !== undefined) data.endereco = endereco;
  if (telefone !== undefined) data.telefone = telefone;
  if (segmento !== undefined) data.segmento = segmento;

  const empresa = await prisma.empresa.update({
    where: { id: tenantId },
    data,
    select: {
      id: true,
      razaoSocial: true,
      nomeLoja: true,
      tipoPessoa: true,
      documento: true,
      endereco: true,
      telefone: true,
      plano: true,
      segmento: true,
      modulosAtivos: true,
      valorContribuicao: true,
      atualizadoEm: true,
    },
  });

  // Trocar de segmento AQUI NAO mexe mais em `modulosAtivos` (arquitetura
  // modular de 2026-09-22, ver auth.service.js) - segmento agora so gateia
  // regras de negocio pontuais (Ficha Tecnica, Consumo Interno/Doacao).
  // `modulos` ainda vai na resposta (mesmo padrao de sempre, pro
  // DadosDaLoja.jsx repassar pro AuthContext via `refreshEmpresa`) - so que
  // agora e o valor persistido, nao mais recalculado do novo segmento.
  const { modulosAtivos, ...dadosPublicos } = empresa;
  return { ...dadosPublicos, modulos: modulosAtivos ?? modulosDoSegmento(empresa.segmento) };
}

/**
 * Liga/desliga modulos de negocio (Modulos.jsx, a "App Store" do SaaS) -
 * substitui o array inteiro pelo recebido (nao um merge parcial: o
 * frontend sempre manda o conjunto completo desejado, ja calculado a
 * partir do estado atual + o toggle que acabou de mudar).
 *
 * `MODULOS_BASE` (Vendas/Financeiro/Produtos) e forcado a sempre estar
 * presente, mesmo que o body nao mande ou mande sem eles - reforca no
 * backend o que a UI (Modulos.jsx) ja nao oferece como toggle, protege
 * contra uma chamada direta a API tentando desligar o essencial.
 */
async function atualizarModulos(prisma, tenantId, modulos) {
  if (!Array.isArray(modulos)) {
    throw new AppError('modulos deve ser uma lista de chaves de modulo.', 422);
  }

  const invalidos = modulos.filter((chave) => !MODULOS_VALIDOS.includes(chave));
  if (invalidos.length > 0) {
    throw new AppError(`modulos contem chaves invalidas: ${invalidos.join(', ')}.`, 422);
  }

  // Set (nao array) so pra deduplicar antes de persistir - o body pode
  // repetir uma chave sem intencao (ex.: MODULOS_BASE mandado + ja presente).
  const modulosFinais = [...new Set([...MODULOS_BASE, ...modulos])];

  const empresa = await prisma.empresa.update({
    where: { id: tenantId },
    data: { modulosAtivos: modulosFinais },
    select: { id: true, modulosAtivos: true },
  });

  return { modulos: empresa.modulosAtivos };
}

/**
 * Usuarios vinculados a empresa. `senhaHash` e deliberadamente excluido do
 * `select` - nunca deve sair da API, nem pra tela de configuracoes.
 */
async function listarUsuarios(prisma, tenantId) {
  return prisma.usuario.findMany({
    where: { empresaId: tenantId },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      criadoEm: true,
    },
    orderBy: { nome: 'asc' },
  });
}

/**
 * Adiciona um novo usuario a equipe da empresa, respeitando o limite de
 * usuarios do plano atual (gratuito: 2, apoiador: 5). O limite conta TODOS
 * os usuarios ja vinculados a esse tenant_id, incluindo o admin criado no
 * registro - ou seja, no plano gratuito so cabe mais 1 pessoa alem do
 * admin.
 */
async function adicionarUsuario(prisma, tenantId, { nome, email, senha, role }) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: { plano: true },
  });

  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const limite = LIMITE_USUARIOS_POR_PLANO[empresa.plano];
  const totalUsuarios = await prisma.usuario.count({ where: { empresaId: tenantId } });

  if (totalUsuarios >= limite) {
    throw new AppError(
      `Limite de usuarios do plano '${empresa.plano}' atingido (maximo ${limite}). Vire Apoiador para adicionar mais pessoas a equipe.`,
      403
    );
  }

  const roleFinal = role || 'vendedor';
  if (!ROLES_VALIDOS.includes(roleFinal)) {
    throw new AppError(`role deve ser um dos seguintes: ${ROLES_VALIDOS.join(', ')}.`, 422);
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  try {
    return await prisma.usuario.create({
      data: { empresaId: tenantId, nome, email, senhaHash, role: roleFinal },
      select: { id: true, nome: true, email: true, role: true, criadoEm: true },
    });
  } catch (err) {
    // P2002 = violacao de unique constraint - aqui, @@unique([empresaId, email]).
    if (err.code === 'P2002') {
      throw new AppError('Ja existe um usuario com este e-mail nesta empresa.', 409);
    }
    throw err;
  }
}

/**
 * Atualiza o plano da empresa. "Simulada" porque nao ha integracao real de
 * pagamento aqui - so grava a mudanca de plano direto, como se o pagamento
 * ja tivesse sido confirmado em algum outro lugar.
 *
 * `valorContribuicao` (a mensalidade caridosa) so e exigido/validado
 * quando o plano e 'apoiador' - voltar pro 'gratuito' zera a contribuicao
 * (nao faz sentido guardar um valor de contribuicao pra quem nao esta mais
 * contribuindo).
 */
async function atualizarAssinatura(prisma, tenantId, { plano, valorContribuicao }) {
  if (!PLANOS_VALIDOS.includes(plano)) {
    throw new AppError(`plano deve ser um dos seguintes: ${PLANOS_VALIDOS.join(', ')}.`, 422);
  }

  let valor = 0;
  if (plano === 'apoiador') {
    valor = Number(valorContribuicao);
    if (!Number.isFinite(valor) || valor < VALOR_MINIMO_CONTRIBUICAO) {
      throw new AppError(
        `valor_contribuicao deve ser um numero de pelo menos R$ ${VALOR_MINIMO_CONTRIBUICAO.toFixed(2)} para o plano apoiador.`,
        422
      );
    }
  }

  return prisma.empresa.update({
    where: { id: tenantId },
    data: { plano, valorContribuicao: valor },
    select: {
      id: true,
      razaoSocial: true,
      documento: true,
      plano: true,
      valorContribuicao: true,
      atualizadoEm: true,
    },
  });
}

module.exports = {
  obterDados,
  atualizarDados,
  atualizarModulos,
  listarUsuarios,
  adicionarUsuario,
  atualizarAssinatura,
  PLANOS_VALIDOS,
  ROLES_VALIDOS,
  SEGMENTOS_VALIDOS,
  LIMITE_USUARIOS_POR_PLANO,
  VALOR_MINIMO_CONTRIBUICAO,
};
