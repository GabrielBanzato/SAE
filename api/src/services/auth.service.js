const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { resolverAcesso } = require('./permissoes');

const SALT_ROUNDS = 10;

// Tamanho esperado do documento (so digitos) por tipo de pessoa - CPF tem
// 11 digitos, CNPJ tem 14.
const TAMANHO_DOCUMENTO = { PF: 11, PJ: 14 };

/**
 * Arquitetura Modular SaaS (2026-09-22, ultimo passo do roadmap) - quem
 * decide quais MODULOS/telas de negocio ficam disponiveis pra uma empresa
 * e o campo `Empresa.modulosAtivos` (Json, ver schema.prisma), editavel
 * pela propria empresa em Modulos.jsx ("App Store", `PUT /empresa/modulos`
 * -> `empresaService.atualizarModulos`) - NAO MAIS o `segmento` sozinho.
 *
 * `MAPA_MODULOS` abaixo sobrevive com um papel mais estreito: e usado
 * SOMENTE em `register()`, pra calcular o conjunto INICIAL de
 * `modulosAtivos` a partir do segmento escolhido no cadastro (um ponto de
 * partida sensato pro tipo de negocio) - depois do cadastro, os dois
 * campos evoluem independentes (trocar de segmento em Configuracoes nao
 * mexe mais em `modulosAtivos`, ver empresa.service.js#atualizarDados).
 * `SEGMENTOS_VALIDOS` (valida o `segmento` recebido no cadastro/
 * atualizacao) continua derivado das chaves deste mapa.
 *
 * Chaves de modulo (precisam bater com `ROTAS_POR_MODULO` em
 * web/src/App.jsx e com os campos `modulo` de web/src/components/Sidebar.jsx):
 * - Base (`MODULOS_BASE` abaixo) - sempre presentes em `modulosAtivos` de
 *   toda empresa, nunca aparecem como toggle na App Store, nem podem ser
 *   removidos via `atualizarModulos` (reforcado no service): 'vendas',
 *   'financeiro', 'produtos'.
 * - Opcionais PAGOS, com toggle + preco na App Store (Modulos.jsx,
 *   `MODULOS_PAGOS` em empresa.service.js): 'pdv_touch' (PDV Rapido/Frente
 *   de Loja em tela cheia), 'clientes' (CRM/Perfil 360), 'ia_whatsapp'
 *   (Inbox Unificado de WhatsApp), 'tarefas' (Quadro de Tarefas Kanban).
 *   **NAO entram em nenhum array abaixo** (motor de pricing, 2026-09-22) -
 *   ate a tarefa anterior eram opcionais gratuitos, liberados de graca no
 *   cadastro conforme o segmento; agora exigem pagamento simulado
 *   (`PUT /empresa/pagamentos`) antes de poderem ser ligados
 *   (`empresaService.atualizarModulos` rejeita com 402 quem tentar ligar
 *   sem pagar) - deixa-los no MAPA_MODULOS continuaria concedendo-os de
 *   graca a toda empresa nova, furando o bloqueio de pagamento por
 *   completo.
 * - Opcionais legados/gratuitos (ainda liberados via `modulosDoSegmento`
 *   no cadastro, sem preco nem card proprio na App Store): 'precificacao',
 *   'estoque_avancado', 'agenda', 'relatorios'.
 * Dashboard, Configuracoes, Modulos e Suporte ficam de fora deste mapa de
 * proposito - sao paginas sempre acessiveis, independentes de modulo.
 */
const MAPA_MODULOS = {
  // Ex.: padarias, mercados, restaurantes - precisa do catalogo completo
  // gratuito, inclusive controle de estoque fino (perecivel) e Ficha
  // Tecnica de ingredientes (gate a parte, ver Empresa.segmento no
  // schema.prisma). PDV Touch/CRM/Kanban (pagos) NAO entram aqui - ver
  // comentario acima.
  varejo_alimentacao: ['vendas', 'produtos', 'precificacao', 'estoque_avancado', 'financeiro', 'agenda', 'relatorios'],
  // Ex.: lojas de roupa/calcados/acessorios - varejo com estoque por
  // grade (tamanho/cor), mas sem a rotina de agendamento de um prestador
  // de servico.
  moda_vestuario: ['vendas', 'produtos', 'precificacao', 'estoque_avancado', 'financeiro', 'relatorios'],
  // Ex.: personal trainers, estudios, clinicas pequenas - ainda vende
  // produtos (suplementos, planos) mas sem o peso de um controle de
  // estoque avancado.
  saude_fitness: ['vendas', 'produtos', 'agenda', 'financeiro', 'relatorios'],
  // Ex.: oficinas mecanicas - servico agendado (ordem de servico) +
  // pecas/produtos vendidos junto, sem necessidade de um modulo de
  // precificacao/estoque tao fino quanto o varejo.
  servicos_automotivos: ['vendas', 'produtos', 'agenda', 'financeiro', 'relatorios'],
};

const SEGMENTOS_VALIDOS = Object.keys(MAPA_MODULOS);

// Sempre presentes em `modulosAtivos`, pra toda empresa - o menu principal
// "extremamente limpo" pedido nesta tarefa parte do princípio de que essas
// 3 telas nunca somem, entao nem valia a pena virar um toggle removivel.
// Reforcado em empresa.service.js#atualizarModulos (nunca aceita um
// array sem os 3).
const MODULOS_BASE = ['vendas', 'financeiro', 'produtos'];

// Catalogo completo de chaves aceitas por `atualizarModulos` - inclui os
// modulos com toggle na App Store E os legados (ainda vinculados so ao
// segmento no cadastro, ver comentario de MAPA_MODULOS acima) - um valor
// fora desta lista e rejeitado (422), protege contra a empresa "inventar"
// uma chave que nao corresponde a nenhuma rota/menu real.
const MODULOS_VALIDOS = [
  ...MODULOS_BASE,
  'pdv_touch',
  'clientes',
  'ia_whatsapp',
  'tarefas',
  'precificacao',
  'estoque_avancado',
  'agenda',
  'relatorios',
];

/** Lista de modulos liberados para um segmento - `[]` (nao erro) para um segmento desconhecido, defensivo. */
function modulosDoSegmento(segmento) {
  return MAPA_MODULOS[segmento] || [];
}

/**
 * Codigo curto de identificacao do usuario (Painel Master - etapa 1,
 * 2026-09-23) - 5 digitos, zero-padded ("00042", nunca "42"), unico
 * GLOBALMENTE (ver comentario de `Usuario.codigoUsuario` em schema.prisma).
 * Verifica unicidade ANTES do insert (nao reage a um erro de constraint
 * depois) - mais simples de acompanhar que distinguir, no catch de
 * `register`/`adicionarUsuario`, se um P2002 veio do email ou do codigo.
 * `prisma` aqui pode ser o client normal OU um `tx` de transacao (mesma
 * interface) - `register` abaixo passa o `tx` pra checagem valer dentro da
 * mesma transacao que vai criar o usuario.
 */
async function gerarCodigoUsuario(prisma) {
  let codigo;
  let jaExiste;
  do {
    codigo = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    jaExiste = await prisma.usuario.findUnique({ where: { codigoUsuario: codigo } });
  } while (jaExiste);
  return codigo;
}

function gerarToken(fastify, usuario) {
  return fastify.jwt.sign(
    {
      sub: usuario.id,
      empresa_id: usuario.empresaId,
      role: usuario.role,
      // Nivel de acesso na PLATAFORMA (LOJISTA/SUPERADMIN, ver comentario
      // de Usuario.nivelAcesso no schema.prisma) - decodificado pelo
      // plugin de auth em `request.userNivelAcesso`, unico ponto de
      // confianca pro middleware de superadmin.routes.js.
      nivel_acesso: usuario.nivelAcesso,
    },
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/**
 * Cadastra uma nova empresa (tenant) e seu primeiro usuario (admin) numa
 * unica transacao: se a criacao do usuario falhar por qualquer motivo, a
 * empresa recem-criada tambem e desfeita - nunca deve sobrar um tenant
 * "orfao" sem nenhum usuario capaz de acessa-lo.
 */
async function register(
  fastify,
  { nome_empresa, tipo_pessoa, documento, nome_usuario, email, senha, segmento, nome_loja }
) {
  const { prisma } = fastify;

  const tamanhoEsperado = TAMANHO_DOCUMENTO[tipo_pessoa];
  if (documento.length !== tamanhoEsperado) {
    throw new AppError(
      `documento deve ter ${tamanhoEsperado} digitos (somente numeros) para tipo_pessoa '${tipo_pessoa}'.`,
      422
    );
  }

  const empresaExistente = await prisma.empresa.findUnique({ where: { documento } });
  if (empresaExistente) {
    throw new AppError('Ja existe uma empresa cadastrada com este documento.', 409);
  }

  // E-mail unico entre usuarios ATIVOS do SAE inteiro (pendencia do RBAC,
  // 2026-09-24): `login()` procura so por e-mail, sem empresa - um e-mail
  // repetido em outra empresa deixaria uma das contas sem conseguir entrar.
  // Mesma regra ja aplicada no convite (empresa.service.js#adicionarUsuario).
  const emailEmUso = await prisma.usuario.findFirst({ where: { email, ativo: true }, select: { id: true } });
  if (emailEmUso) {
    throw new AppError('Este e-mail ja esta cadastrado no SAE. Use outro e-mail ou entre com a conta existente.', 409);
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  // Ponto de partida dos modulos desta empresa - calculado UMA VEZ aqui, a
  // partir do segmento escolhido no cadastro, e persistido de verdade em
  // `modulosAtivos` (nao mais recalculado a cada leitura, ver
  // empresa.service.js#obterDados). Dali em diante e a propria empresa quem
  // decide, via Modulos.jsx.
  const modulosIniciais = modulosDoSegmento(segmento);

  const { empresa, usuario } = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      // `segmento` agora e obrigatorio (schema.prisma nao tem mais
      // @default) - o controller ja garante que sempre chega preenchido
      // aqui. `nomeLoja` continua opcional de verdade (schema `String?`).
      data: {
        razaoSocial: nome_empresa,
        tipoPessoa: tipo_pessoa,
        documento,
        segmento,
        nomeLoja: nome_loja || null,
        modulosAtivos: modulosIniciais,
      },
    });

    // Primeiro usuario da empresa e sempre admin - nao ha ninguem mais para
    // convida-lo, entao ele precisa de acesso total desde o inicio.
    const usuario = await tx.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: nome_usuario,
        email,
        senhaHash,
        role: 'admin',
        codigoUsuario: await gerarCodigoUsuario(tx),
      },
    });

    return { empresa, usuario };
  });

  const token = gerarToken(fastify, usuario);

  return {
    token,
    empresa: {
      id: empresa.id,
      razaoSocial: empresa.razaoSocial,
      nomeLoja: empresa.nomeLoja,
      tipoPessoa: empresa.tipoPessoa,
      documento: empresa.documento,
      segmento: empresa.segmento,
      // Modulos de negocio liberados pra essa empresa - o valor persistido
      // em `modulosAtivos` (nao mais recalculado do segmento a cada
      // resposta). Nunca guardados no JWT (payload do token continua so
      // com sub/empresa_id/role, ver `gerarToken` acima), so no corpo desta
      // resposta. O frontend (AuthContext#persistirSessao) guarda este
      // array em `empresa.modulos` pra decidir quais rotas/itens de menu
      // montar (ver App.jsx/Sidebar.jsx).
      modulos: modulosIniciais,
    },
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      nivelAcesso: usuario.nivelAcesso,
      // Ajuste no Formulario de Suporte (2026-09-23) - AuthContext precisa
      // disso disponivel desde o login/registro, sem uma chamada extra, pra
      // preencher o campo "Seu ID" (so-leitura) em Suporte.jsx.
      codigoUsuario: usuario.codigoUsuario,
      // RBAC (2026-09-24) - ver comentario em `me()`.
      ...(await acessoParaResposta(prisma, usuario.id, usuario.empresaId)),
    },
  };
}

/**
 * Autentica um usuario apenas por email + senha.
 *
 * Atencao: `Usuario.email` e unico apenas POR empresa
 * (@@unique([empresaId, email]) no schema.prisma), nao globalmente. Como o
 * fluxo de cadastro (register acima) e self-service - cada empresa nova
 * cria seu proprio usuario admin -, colisao de e-mail entre tenants
 * diferentes e possivel na teoria; usamos `findFirst` e ficamos com a
 * primeira ocorrencia. Se isso virar um problema real, a solucao correta e
 * tornar `email` unico globalmente no schema.
 */
async function login(fastify, { email, senha }) {
  const { prisma } = fastify;

  // `include: { empresa: ... }` so pra ler `modulosAtivos`/`segmento`/`ativo`
  // dela - precisamos montar a resposta abaixo (nao seria possivel so com o
  // `usuario`). `segmento` continua selecionado so pro fallback defensivo
  // de `modulosAtivos` nulo (ver comentario abaixo).
  const usuario = await prisma.usuario.findFirst({
    // So contas ATIVAS - quem foi removido da equipe cai em "credenciais
    // invalidas" (mensagem generica de proposito, nao revela que a conta existe).
    where: { email, ativo: true },
    include: { empresa: { select: { segmento: true, modulosAtivos: true, ativo: true } } },
  });
  if (!usuario) {
    return null;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    return null;
  }

  // Empresa suspensa pelo Supra Admin (Painel Master, 2026-09-22) - bloqueia
  // login de QUALQUER usuario dela, mesmo com senha certa. Verificado DEPOIS
  // da senha (nao antes) de proposito - nao vaza pra quem esta tentando
  // adivinhar senha se o e-mail pertence a uma empresa suspensa ou nao.
  if (!usuario.empresa.ativo) {
    throw new AppError('Esta empresa esta com o acesso suspenso. Entre em contato com o suporte.', 403);
  }

  const token = gerarToken(fastify, usuario);

  return {
    token,
    // So `modulos` aqui (nao o objeto `empresa` inteiro) - o resto dos
    // dados cadastrais da empresa (razaoSocial, plano etc.) o frontend ja
    // busca em seguida via GET /empresa/dados (AuthContext#refreshEmpresa,
    // disparado automaticamente a cada login/reidratacao). Essa rota
    // tambem devolve `modulos` (ver empresa.service.js#obterDados) - login
    // so adianta esse dado pra nao esperar essa segunda chamada terminar
    // antes de decidir quais rotas/menus montar.
    //
    // Fallback pra `modulosDoSegmento` so protege linhas antigas sem
    // `modulosAtivos` preenchido (nunca deveria acontecer pra uma empresa
    // criada depois desta tarefa, ja que `register` sempre popula o
    // campo) - nao e o caminho normal.
    empresa: {
      modulos: usuario.empresa.modulosAtivos ?? modulosDoSegmento(usuario.empresa.segmento),
    },
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      nivelAcesso: usuario.nivelAcesso,
      // Ajuste no Formulario de Suporte (2026-09-23) - ver comentario
      // equivalente em `register` acima.
      codigoUsuario: usuario.codigoUsuario,
      // RBAC (2026-09-24) - ver comentario em `me()`.
      ...(await acessoParaResposta(prisma, usuario.id, usuario.empresaId)),
    },
  };
}

/**
 * GET /auth/me (correcao de bug, 2026-09-23) - devolve o usuario logado
 * direto do banco, no mesmo formato de `usuario` de login/register. Motivo:
 * o frontend so gravava o objeto `usuario` no localStorage NO LOGIN - quem
 * ja estava logado antes de `codigoUsuario` existir (Painel Master - Etapa
 * 1) continuava com um objeto antigo, sem esse campo, e "Seu ID" em
 * Suporte.jsx mostrava "-----" ate um novo login. AuthContext chama esta
 * rota a cada boot pra reidratar o usuario com o schema atual.
 */
async function me(prisma, usuarioId, tenantId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nome: true, email: true, role: true, nivelAcesso: true, codigoUsuario: true },
  });
  if (!usuario) {
    throw new AppError('Usuario nao encontrado.', 404);
  }
  // RBAC (2026-09-24) - permissoes EFETIVAS junto do usuario: o frontend
  // usa pra esconder menu/rotas (so UX - quem barra de verdade e o
  // requirePermission de cada rota da API). Como /auth/me roda a cada boot,
  // uma troca de perfil pelo admin chega na tela no proximo F5.
  return { ...usuario, ...(await acessoParaResposta(prisma, usuarioId, tenantId)) };
}

/** { ehAdmin, perfil, permissoes } no formato que o frontend guarda em `usuario`. */
async function acessoParaResposta(prisma, usuarioId, tenantId) {
  const acesso = await resolverAcesso(prisma, usuarioId, tenantId);
  return {
    ehAdmin: acesso?.ehAdmin ?? false,
    perfil: acesso?.perfil ?? null,
    permissoes: acesso?.permissoes ?? [],
    // Senha temporaria pendente - o frontend mostra so a tela de troca (ver PUT /auth/senha).
    deveTrocarSenha: acesso?.deveTrocarSenha ?? false,
  };
}

const TAMANHO_MIN_SENHA = 8;

/**
 * PUT /auth/senha - a propria pessoa troca a senha (pendencia do RBAC,
 * 2026-09-24): obrigatoria depois de uma senha temporaria (convite ou
 * "Redefinir senha" pelo admin) e disponivel pra qualquer um em "Alterar
 * senha". Exige a senha ATUAL (inclusive a temporaria) - um token roubado
 * sozinho nao basta pra trocar a senha e sequestrar a conta. Zera
 * `deveTrocarSenha`.
 */
async function alterarSenha(prisma, usuarioId, tenantId, { senhaAtual, novaSenha }) {
  if (typeof novaSenha !== 'string' || novaSenha.length < TAMANHO_MIN_SENHA) {
    throw new AppError(`A nova senha precisa ter pelo menos ${TAMANHO_MIN_SENHA} caracteres.`, 400);
  }
  if (novaSenha.length > 72) {
    // bcrypt ignora tudo depois de 72 bytes - melhor recusar que truncar em silencio.
    throw new AppError('A nova senha pode ter no maximo 72 caracteres.', 400);
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, empresaId: tenantId, ativo: true },
    select: { senhaHash: true },
  });
  if (!usuario) throw new AppError('Usuario nao encontrado.', 404);

  if (typeof senhaAtual !== 'string' || !(await bcrypt.compare(senhaAtual, usuario.senhaHash))) {
    throw new AppError('A senha atual esta incorreta.', 400);
  }
  if (await bcrypt.compare(novaSenha, usuario.senhaHash)) {
    throw new AppError('A nova senha precisa ser diferente da atual.', 400);
  }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senhaHash: await bcrypt.hash(novaSenha, SALT_ROUNDS), deveTrocarSenha: false },
  });
}

module.exports = {
  register,
  login,
  me,
  alterarSenha,
  TAMANHO_MIN_SENHA,
  MAPA_MODULOS,
  SEGMENTOS_VALIDOS,
  MODULOS_BASE,
  MODULOS_VALIDOS,
  modulosDoSegmento,
  gerarCodigoUsuario,
};
