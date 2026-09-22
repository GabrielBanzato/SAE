const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');

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
 * - Opcionais com toggle real na App Store (Modulos.jsx): 'pdv_touch' (PDV
 *   Rapido/Frente de Loja em tela cheia - ANTES chamado soh de 'pdv', que
 *   cobria Vendas+PDV Touch juntos; separado nesta tarefa pra Vendas virar
 *   base e PDV Touch virar opcional de verdade), 'clientes' (CRM/Perfil
 *   360), 'ia_whatsapp' (Inbox Unificado de WhatsApp), 'tarefas' (Quadro
 *   de Tarefas Kanban - ANTES compartilhava a chave 'agenda' com a Agenda,
 *   desacoplado nesta tarefa pra virar um toggle independente).
 * - Opcionais legados (ainda liberados via `modulosDoSegmento` no
 *   cadastro, mas sem card proprio na App Store ainda - fora do escopo
 *   desta tarefa, ver NOTAS_IMPORTANTES.md): 'precificacao',
 *   'estoque_avancado', 'agenda', 'relatorios'.
 * Dashboard, Configuracoes, Modulos e Suporte ficam de fora deste mapa de
 * proposito - sao paginas sempre acessiveis, independentes de modulo.
 */
const MAPA_MODULOS = {
  // Ex.: padarias, mercados, restaurantes - precisa do catalogo completo,
  // inclusive controle de estoque fino (perecivel) e Ficha Tecnica de
  // ingredientes (gate a parte, ver Empresa.segmento no schema.prisma).
  varejo_alimentacao: [
    'vendas',
    'pdv_touch',
    'produtos',
    'precificacao',
    'estoque_avancado',
    'clientes',
    'financeiro',
    'agenda',
    'tarefas',
    'relatorios',
  ],
  // Ex.: lojas de roupa/calcados/acessorios - varejo com estoque por
  // grade (tamanho/cor), mas sem a rotina de agendamento de um prestador
  // de servico.
  moda_vestuario: [
    'vendas',
    'pdv_touch',
    'produtos',
    'precificacao',
    'estoque_avancado',
    'clientes',
    'financeiro',
    'relatorios',
  ],
  // Ex.: personal trainers, estudios, clinicas pequenas - foco em
  // clientes/agenda (a rotina e "hora marcada", nao "balcao"); ainda vende
  // produtos (suplementos, planos) mas sem o peso de um controle de
  // estoque avancado.
  saude_fitness: ['vendas', 'pdv_touch', 'produtos', 'clientes', 'agenda', 'tarefas', 'financeiro', 'relatorios'],
  // Ex.: oficinas mecanicas - servico agendado (ordem de servico) +
  // pecas/produtos vendidos junto, sem necessidade de um modulo de
  // precificacao/estoque tao fino quanto o varejo.
  servicos_automotivos: [
    'vendas',
    'pdv_touch',
    'produtos',
    'clientes',
    'agenda',
    'tarefas',
    'financeiro',
    'relatorios',
  ],
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

function gerarToken(fastify, usuario) {
  return fastify.jwt.sign(
    {
      sub: usuario.id,
      empresa_id: usuario.empresaId,
      role: usuario.role,
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

  // `include: { empresa: ... }` so pra ler `modulosAtivos`/`segmento` dela -
  // precisamos montar a resposta abaixo (nao seria possivel so com o
  // `usuario`). `segmento` continua selecionado so pro fallback defensivo
  // de `modulosAtivos` nulo (ver comentario abaixo).
  const usuario = await prisma.usuario.findFirst({
    where: { email },
    include: { empresa: { select: { segmento: true, modulosAtivos: true } } },
  });
  if (!usuario) {
    return null;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    return null;
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
    },
  };
}

module.exports = { register, login, MAPA_MODULOS, SEGMENTOS_VALIDOS, MODULOS_BASE, MODULOS_VALIDOS, modulosDoSegmento };
