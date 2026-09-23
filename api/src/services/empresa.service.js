const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
// SEGMENTOS_VALIDOS/modulosDoSegmento/MODULOS_BASE/MODULOS_VALIDOS moram em
// auth.service.js, ao lado de MAPA_MODULOS (a fonte da verdade do catalogo
// de modulos). Reexportados abaixo por compatibilidade - nenhum outro
// arquivo alem deste precisa saber que a definicao mora la.
const { SEGMENTOS_VALIDOS, MODULOS_BASE, MODULOS_VALIDOS, modulosDoSegmento, gerarCodigoUsuario } = require('./auth.service');

const SALT_ROUNDS = 10;

const PLANOS_VALIDOS = ['gratuito', 'apoiador'];
const ROLES_VALIDOS = ['admin', 'gerente', 'vendedor'];

// Modulos opcionais que exigem pagamento antes de poderem ser ligados em
// `modulosAtivos` (ver `atualizarModulos`/`confirmarPagamento` abaixo) -
// subconjunto de MODULOS_VALIDOS (auth.service.js). "Emissao de Notas
// Fiscais" (mostrada com preco na App Store, Modulos.jsx) fica de fora de
// proposito - e uma pagina mock, sem modulo/rota real pra cobrar por algo
// que nao existe ainda.
const MODULOS_PAGOS = ['pdv_touch', 'clientes', 'tarefas', 'ia_whatsapp'];

// Unico modulo pago com mais de uma oferta - `pagamentosAtivos.ia_whatsapp.planoIa`
// guarda qual dessas 2 chaves foi paga (ver formato completo de
// `pagamentosAtivos` no comentario de `confirmarPagamento` abaixo).
const PLANOS_IA_WHATSAPP = ['whatsapp_web', 'meta_api'];

// Duracao do "ciclo de cobranca" simulado (Painel Master - Etapa 2,
// 2026-09-23) - todo modulo pago tem uma data de proximo vencimento
// (`pagamentosAtivos[chave].proximoVencimento`), calculada como "agora +
// N dias" no momento da confirmacao (checkout normal OU liberado pelo
// Supra Admin, mesma funcao `confirmarPagamento` abaixo pras duas). Nao
// existe cobranca real nem job que desliga o modulo quando essa data
// passa (mesmo espirito "simulado" de sempre) - a data so alimenta o
// status EM_DIA/ATRASADO mostrado pro Supra Admin (`obterAssinaturas`),
// uma sinalizacao visual pra ele saber quem esta "devendo", nao um
// mecanismo de bloqueio automatico.
const DURACAO_CICLO_PAGAMENTO_DIAS = 30;

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
      isDoador: true,
      segmento: true,
      modulosAtivos: true,
      pagamentosAtivos: true,
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
  //
  // `isDoador` e uma coluna persistida (`Empresa.isDoador`, pedido explicito
  // de 2026-09-22 - antes era so calculado em runtime a partir de `plano`,
  // ver git blame) - devolvida direto do `select` acima, sem recalcular.
  // Continua sem ser gravavel por aqui: quem escreve o par
  // `plano`/`isDoador` junto e `atualizarAssinatura` (abaixo) e
  // `definirDoador` (superadmin.service.js), nunca esta funcao de leitura.
  // `pagamentos` (o que ja foi pago, ver `MODULOS_PAGOS`/`confirmarPagamento`
  // abaixo) segue o mesmo padrao defensivo de `modulos`: nunca sai `null`.
  const { modulosAtivos, pagamentosAtivos, ...dadosPublicos } = empresa;
  return {
    ...dadosPublicos,
    modulos: modulosAtivos ?? modulosDoSegmento(empresa.segmento),
    pagamentos: pagamentosAtivos ?? {},
  };
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
      isDoador: true,
      segmento: true,
      modulosAtivos: true,
      pagamentosAtivos: true,
      valorContribuicao: true,
      atualizadoEm: true,
    },
  });

  // Trocar de segmento AQUI NAO mexe mais em `modulosAtivos` (arquitetura
  // modular de 2026-09-22, ver auth.service.js) - segmento agora so gateia
  // regras de negocio pontuais (Ficha Tecnica, Consumo Interno/Doacao).
  // `modulos`/`pagamentos`/`isDoador` ainda vao na resposta (mesmo padrao
  // de sempre, pro DadosDaLoja.jsx repassar pro AuthContext via
  // `refreshEmpresa`) - `isDoador` vem direto do `select` acima (coluna
  // persistida, ver comentario de `obterDados`), nao recalculado aqui.
  const { modulosAtivos, pagamentosAtivos, ...dadosPublicos } = empresa;
  return {
    ...dadosPublicos,
    modulos: modulosAtivos ?? modulosDoSegmento(empresa.segmento),
    pagamentos: pagamentosAtivos ?? {},
  };
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
 *
 * Motor de pricing (2026-09-22): qualquer chave de `MODULOS_PAGOS` sendo
 * LIGADA precisa constar (truthy) em `pagamentosAtivos` - reforca no
 * backend a mesma regra que a Sidebar/Modulos.jsx ja aplicam na UI (Switch
 * so clicavel se pago), pra uma chamada direta a API nao conseguir ligar
 * um modulo pago sem passar por `confirmarPagamento` antes. So valida
 * quem esta sendo LIGADO agora - desligar um modulo pago de volta nunca
 * exige pagamento (obvio, mas registrado aqui pra nao confundir com a
 * regra acima).
 */
async function atualizarModulos(prisma, tenantId, modulos) {
  if (!Array.isArray(modulos)) {
    throw new AppError('modulos deve ser uma lista de chaves de modulo.', 422);
  }

  const invalidos = modulos.filter((chave) => !MODULOS_VALIDOS.includes(chave));
  if (invalidos.length > 0) {
    throw new AppError(`modulos contem chaves invalidas: ${invalidos.join(', ')}.`, 422);
  }

  const empresaAtual = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: { modulosAtivos: true, pagamentosAtivos: true },
  });
  if (!empresaAtual) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const modulosAntes = empresaAtual.modulosAtivos ?? [];
  const pagamentos = empresaAtual.pagamentosAtivos ?? {};
  const sendoLigados = modulos.filter((chave) => !modulosAntes.includes(chave));
  const semPagamento = sendoLigados.filter((chave) => MODULOS_PAGOS.includes(chave) && !pagamentos[chave]);
  if (semPagamento.length > 0) {
    throw new AppError(
      `Pagamento pendente pra ligar: ${semPagamento.join(', ')}. Confirme o pagamento antes de ativar.`,
      402
    );
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

/** "Agora + `DURACAO_CICLO_PAGAMENTO_DIAS` dias", como string ISO (formato que `pagamentosAtivos`, um campo Json, guarda datas). */
function calcularProximoVencimento() {
  const data = new Date();
  data.setDate(data.getDate() + DURACAO_CICLO_PAGAMENTO_DIAS);
  return data.toISOString();
}

/**
 * Deriva o status de cobranca de UM modulo a partir do que esta gravado em
 * `pagamentosAtivos[chave]` - NUNCA persistido como campo separado (mesmo
 * motivo de sempre nesta base: 2 campos guardando a mesma informacao podem
 * divergir, ver `Empresa.isDoador` em schema.prisma). 3 saidas possiveis:
 * - `SEM_ACESSO`: nunca foi pago (chave ausente de `pagamentosAtivos`).
 * - `EM_DIA`: pago e `proximoVencimento` ainda nao chegou.
 * - `ATRASADO`: pago, mas `proximoVencimento` ja passou - nao desliga o
 *   modulo sozinho (ver comentario de `DURACAO_CICLO_PAGAMENTO_DIAS`), so
 *   sinaliza pro Supra Admin decidir (cobrar de novo, liberar de novo,
 *   restringir).
 */
function calcularStatusPagamento(pagamentoModulo) {
  if (!pagamentoModulo?.pago) return 'SEM_ACESSO';
  if (!pagamentoModulo.proximoVencimento) return 'EM_DIA';
  return new Date(pagamentoModulo.proximoVencimento) < new Date() ? 'ATRASADO' : 'EM_DIA';
}

/**
 * Checkout simulado (`ModalPagamento`, Modulos.jsx) - mesmo espirito de
 * `atualizarAssinatura` abaixo: nao ha gateway de pagamento real integrado
 * ainda, entao "confirmar pagamento" so grava como se a cobranca ja
 * tivesse sido aprovada. Ativa o modulo em `modulosAtivos` NA HORA (junto
 * com marcar `pagamentosAtivos[modulo]`) - evita um segundo passo confuso
 * ("paguei, por que o modulo continua desligado?"); dali em diante o
 * Switch em Modulos.jsx volta a ligar/desligar livremente, sem pedir
 * pagamento de novo (ja consta em `pagamentosAtivos`).
 *
 * MESMA funcao usada pelo checkout normal (tenant-scoped,
 * `PUT /empresa/pagamentos`) E pelo "Liberar Gratuitamente" do Supra Admin
 * (`superadmin.service.js#forcarPagamento`, que so decide QUAL empresa e o
 * alvo) - nao existe uma logica separada pra "pagamento de verdade" vs.
 * "liberado pelo admin", os dois usam o mesmo ciclo de 30 dias (Painel
 * Master - Etapa 2, 2026-09-23, decisao confirmada com o usuario).
 *
 * `pagamentosAtivos[chave]` agora e um OBJETO (nao mais `true`/uma string
 * solta, formato anterior a esta tarefa) - `{ pago: true, proximoVencimento,
 * planoIa? }`. `planoIa` so existe pro unico modulo com mais de 1 oferta
 * (ver PLANOS_IA_WHATSAPP acima) - exigido apenas quando `modulo ===
 * 'ia_whatsapp'`. Trocar de plano depois (ex.: de `whatsapp_web` pra
 * `meta_api`) passa por aqui de novo - um novo "pagamento" sobrescreve
 * qual plano esta ativo E reinicia o ciclo de vencimento.
 */
async function confirmarPagamento(prisma, tenantId, { modulo, planoIa }) {
  if (!MODULOS_PAGOS.includes(modulo)) {
    throw new AppError(`modulo deve ser um dos seguintes: ${MODULOS_PAGOS.join(', ')}.`, 422);
  }

  const dadosPagamento = { pago: true, proximoVencimento: calcularProximoVencimento() };
  if (modulo === 'ia_whatsapp') {
    if (!PLANOS_IA_WHATSAPP.includes(planoIa)) {
      throw new AppError(`planoIa deve ser um dos seguintes: ${PLANOS_IA_WHATSAPP.join(', ')}.`, 422);
    }
    dadosPagamento.planoIa = planoIa;
  }

  const empresaAtual = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: { modulosAtivos: true, pagamentosAtivos: true },
  });
  if (!empresaAtual) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const pagamentos = { ...(empresaAtual.pagamentosAtivos ?? {}), [modulo]: dadosPagamento };
  const modulosAntes = empresaAtual.modulosAtivos ?? [];
  const modulosFinais = modulosAntes.includes(modulo) ? modulosAntes : [...modulosAntes, modulo];

  const empresa = await prisma.empresa.update({
    where: { id: tenantId },
    data: { pagamentosAtivos: pagamentos, modulosAtivos: modulosFinais },
    select: { pagamentosAtivos: true, modulosAtivos: true },
  });

  return { pagamentos: empresa.pagamentosAtivos, modulos: empresa.modulosAtivos };
}

/**
 * "Restringir" (Painel Master - Etapa 2, exclusivo do Supra Admin, sem
 * rota tenant-scoped equivalente - uma empresa nunca restringe a si
 * mesma, so desliga o Switch em Modulos.jsx, que e outra funcao
 * `atualizarModulos`) - revoga o pagamento E desativa o modulo NA MESMA
 * escrita (decisao confirmada com o usuario: simetrico ao "Liberar
 * Gratuitamente"/`confirmarPagamento` acima, que tambem ativa os dois
 * juntos). Remove a chave de `pagamentosAtivos` por completo (nao so
 * marca `pago: false`) - sem registro nenhum, `calcularStatusPagamento`
 * ja devolve `SEM_ACESSO` naturalmente, sem precisar de um estado
 * "revogado" a parte.
 */
async function restringirModulo(prisma, empresaId, { modulo }) {
  if (!MODULOS_PAGOS.includes(modulo)) {
    throw new AppError(`modulo deve ser um dos seguintes: ${MODULOS_PAGOS.join(', ')}.`, 422);
  }

  const empresaAtual = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { modulosAtivos: true, pagamentosAtivos: true },
  });
  if (!empresaAtual) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const pagamentos = { ...(empresaAtual.pagamentosAtivos ?? {}) };
  delete pagamentos[modulo];
  const modulosFinais = (empresaAtual.modulosAtivos ?? []).filter((chave) => chave !== modulo);

  const empresa = await prisma.empresa.update({
    where: { id: empresaId },
    data: { pagamentosAtivos: pagamentos, modulosAtivos: modulosFinais },
    select: { pagamentosAtivos: true, modulosAtivos: true },
  });

  return { pagamentos: empresa.pagamentosAtivos, modulos: empresa.modulosAtivos };
}

// Modulos opcionais SEM cobranca (nunca precisaram de `pagamentosAtivos`,
// liberados pelo segmento no cadastro - ver MAPA_MODULOS em
// auth.service.js) - o unico papel desta lista aqui e alimentar
// `obterAssinaturas` abaixo com um indicador "ativo/inativo" pra esses
// modulos tambem, sem informacao financeira (nunca tiveram preco).
const MODULOS_LEGADOS_GRATUITOS = MODULOS_VALIDOS.filter(
  (chave) => !MODULOS_BASE.includes(chave) && !MODULOS_PAGOS.includes(chave)
);

/**
 * "Gestao Detalhada de Assinaturas" (Painel Master - Etapa 2, modal
 * `ModalAssinaturas` em EmpresasClientes.jsx) - visao completa de TODOS os
 * modulos do catalogo pra uma empresa, nao so os pagos: base (sempre
 * ativo, sem info financeira), legados gratuitos (ativo/inativo conforme
 * `modulosAtivos`, tambem sem info financeira - nunca tiveram preco) e
 * pagos (ativo/inativo + status de cobranca derivado, ver
 * `calcularStatusPagamento`). So os pagos tem `proximoVencimento`/`status`
 * de verdade - os outros 2 grupos existem aqui so pra dar ao Supra Admin o
 * quadro completo do que a empresa enxerga no menu, num lugar so.
 */
async function obterAssinaturas(prisma, empresaId) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { modulosAtivos: true, pagamentosAtivos: true },
  });
  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const modulosAtivos = empresa.modulosAtivos ?? [];
  const pagamentos = empresa.pagamentosAtivos ?? {};

  const base = MODULOS_BASE.map((chave) => ({ chave, tipo: 'base', ativo: true }));
  const legados = MODULOS_LEGADOS_GRATUITOS.map((chave) => ({
    chave,
    tipo: 'legado',
    ativo: modulosAtivos.includes(chave),
  }));
  const pagos = MODULOS_PAGOS.map((chave) => {
    const pagamento = pagamentos[chave];
    return {
      chave,
      tipo: 'pago',
      ativo: modulosAtivos.includes(chave),
      pago: Boolean(pagamento?.pago),
      proximoVencimento: pagamento?.proximoVencimento ?? null,
      status: calcularStatusPagamento(pagamento),
      planoIa: chave === 'ia_whatsapp' ? (pagamento?.planoIa ?? null) : undefined,
    };
  });

  return [...base, ...legados, ...pagos];
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
      codigoUsuario: true,
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
  const codigoUsuario = await gerarCodigoUsuario(prisma);

  try {
    return await prisma.usuario.create({
      data: { empresaId: tenantId, nome, email, senhaHash, role: roleFinal, codigoUsuario },
      select: { id: true, nome: true, email: true, role: true, codigoUsuario: true, criadoEm: true },
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
 * Calcula o novo par `doadorDesde`/`doadorProximoVencimento` pra uma
 * transicao de status de doador (Painel Master - Etapa 3, 2026-09-23) -
 * usado tanto por `atualizarAssinatura` (self-service, `PUT /empresa/assinatura`)
 * quanto por `superadmin.service.js#definirDoador` (concessao manual) -
 * MESMA regra pros dois caminhos, nao duplicada.
 *
 * - Virando doador AGORA (nao era antes): `doadorProximoVencimento` reinicia
 *   pro ciclo cheio (`DURACAO_CICLO_PAGAMENTO_DIAS`); `doadorDesde` so e
 *   setado se ainda estiver vazio (`null`) - preserva a data ORIGINAL de
 *   quando a empresa virou doadora pela primeira vez, mesmo que o valor da
 *   contribuicao mude depois (nao "reinicia o contador" so por trocar o
 *   valor mensal).
 * - Continua doador (ja era antes, so renovando/trocando valor): so
 *   reinicia `doadorProximoVencimento`, mantem `doadorDesde` como estava.
 * - Deixando de ser doador: os 2 campos voltam a `null` - decisao
 *   deliberada (nao guardar historico) pra que, se a empresa virar doadora
 *   de novo no futuro, o contador de "ha quanto tempo e doador" comece do
 *   zero, refletindo o periodo continuo ATUAL, nao um periodo antigo que ja
 *   foi interrompido.
 */
function calcularCiclosDoador({ isDoadorAntes, isDoadorNovo, doadorDesdeAtual }) {
  if (!isDoadorNovo) {
    return { doadorDesde: null, doadorProximoVencimento: null };
  }

  const data = new Date();
  data.setDate(data.getDate() + DURACAO_CICLO_PAGAMENTO_DIAS);

  return {
    doadorDesde: isDoadorAntes && doadorDesdeAtual ? doadorDesdeAtual : new Date(),
    doadorProximoVencimento: data,
  };
}

/**
 * Deriva o status de pagamento da doacao a partir de `isDoador`/
 * `doadorProximoVencimento` - mesmo principio de `calcularStatusPagamento`
 * (modulos pagos, acima): nunca persistido, sempre calculado na leitura.
 * So 2 estados reais (`PAGO`/`ATRASADO`, decisao confirmada com o usuario -
 * "Pendente" no pedido original virou so um sinonimo visual de "em dia",
 * nao um 3o estado de verdade) + `SEM_DOACAO` pra quem nunca foi doador.
 */
function calcularStatusDoador({ isDoador, doadorProximoVencimento }) {
  if (!isDoador) return 'SEM_DOACAO';
  if (!doadorProximoVencimento) return 'PAGO';
  return new Date(doadorProximoVencimento) < new Date() ? 'ATRASADO' : 'PAGO';
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

  const empresaAntes = await prisma.empresa.findUnique({
    where: { id: tenantId },
    select: { isDoador: true, doadorDesde: true },
  });
  if (!empresaAntes) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  const isDoadorNovo = plano === 'apoiador';
  const ciclos = calcularCiclosDoador({
    isDoadorAntes: empresaAntes.isDoador,
    isDoadorNovo,
    doadorDesdeAtual: empresaAntes.doadorDesde,
  });

  return prisma.empresa.update({
    where: { id: tenantId },
    // `isDoador` gravado na MESMA escrita que `plano` - unico jeito de
    // manter as 2 colunas em sincronia (ver comentario dela em
    // schema.prisma), nao um recalculo derivado em outro lugar.
    data: { plano, isDoador: isDoadorNovo, valorContribuicao: valor, ...ciclos },
    select: {
      id: true,
      razaoSocial: true,
      documento: true,
      plano: true,
      isDoador: true,
      valorContribuicao: true,
      doadorDesde: true,
      doadorProximoVencimento: true,
      atualizadoEm: true,
    },
  });
}

/**
 * "Modal de Gestao de Doadores" (Painel Master - Etapa 3, 2026-09-23) -
 * dados completos de doacao de UMA empresa, pro modal decidir entre
 * Estado A (nao e doador - formulario "Tornar Doador") e Estado B (ja e
 * doador - status/vencimento/ha quanto tempo). `status` derivado igual
 * `calcularStatusDoador` acima; "ha quanto tempo e doador" NAO e calculado
 * aqui - so devolve `doadorDesde` cru (ISO), o frontend formata (mesmo
 * padrao de `formatarData` ja usado em outras telas do Supra Admin).
 */
async function obterDadosDoador(prisma, empresaId) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { isDoador: true, valorContribuicao: true, doadorDesde: true, doadorProximoVencimento: true },
  });
  if (!empresa) {
    throw new AppError('Empresa nao encontrada.', 404);
  }

  return { ...empresa, status: calcularStatusDoador(empresa) };
}

module.exports = {
  obterDados,
  atualizarDados,
  atualizarModulos,
  confirmarPagamento,
  restringirModulo,
  obterAssinaturas,
  listarUsuarios,
  adicionarUsuario,
  atualizarAssinatura,
  calcularCiclosDoador,
  obterDadosDoador,
  PLANOS_VALIDOS,
  ROLES_VALIDOS,
  SEGMENTOS_VALIDOS,
  LIMITE_USUARIOS_POR_PLANO,
  VALOR_MINIMO_CONTRIBUICAO,
  MODULOS_PAGOS,
  PLANOS_IA_WHATSAPP,
};
