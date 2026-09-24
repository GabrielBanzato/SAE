const AppError = require('../utils/AppError');

/**
 * RBAC - catalogo FIXO de permissoes (2026-09-24). Fonte UNICA da verdade:
 *   - o backend valida/normaliza os perfis contra este catalogo;
 *   - o frontend NAO duplica a lista - busca via `GET /perfis/catalogo`
 *     pra montar os checkboxes da tela "Perfis de Acesso".
 *
 * Granularidade = AREA do sistema (o que o usuario ve no menu), nao cada
 * endpoint. Cada chave cobre as paginas listadas em `paginas` (so
 * informativo, mostrado na tela). Adicionar uma permissao nova = uma
 * entrada aqui + usar a chave no `requirePermission` da rota e no campo
 * `permissao` do item de menu (web/src/components/Sidebar.jsx).
 */
const CATALOGO_PERMISSOES = [
  {
    grupo: 'Visão Geral',
    permissoes: [{ chave: 'VER_DASHBOARD', rotulo: 'Dashboard', descricao: 'Indicadores de vendas e financeiro da loja.' }],
  },
  {
    grupo: 'Comercial',
    permissoes: [
      { chave: 'VER_VENDAS', rotulo: 'Módulo de Vendas', descricao: 'Vendas, PDV Rápido e Histórico de Vendas.' },
      { chave: 'VER_CLIENTES', rotulo: 'Clientes (CRM)', descricao: 'Cadastro e Perfil 360 dos clientes.' },
    ],
  },
  {
    grupo: 'Produção e Catálogo',
    permissoes: [
      { chave: 'VER_PRODUTOS', rotulo: 'Módulo de Produção', descricao: 'Produtos, Ficha Técnica e Precificação.' },
      { chave: 'VER_ESTOQUE', rotulo: 'Estoque', descricao: 'Estoque de produtos e de ingredientes/insumos.' },
    ],
  },
  {
    grupo: 'Financeiro',
    permissoes: [
      { chave: 'VER_FINANCEIRO', rotulo: 'Módulo Financeiro', descricao: 'Lançamentos, Controle Financeiro e DRE.' },
      { chave: 'VER_RELATORIOS', rotulo: 'Relatórios', descricao: 'Relatórios de desempenho da loja.' },
    ],
  },
  {
    grupo: 'Gestão',
    permissoes: [
      { chave: 'VER_AGENDA', rotulo: 'Agenda', descricao: 'Calendário de contas, vendas e lembretes.' },
      { chave: 'VER_TAREFAS', rotulo: 'Tarefas', descricao: 'Quadro de tarefas (Kanban) da equipe.' },
      { chave: 'VER_INBOX', rotulo: 'Inbox WhatsApp', descricao: 'Atendimentos de WhatsApp com IA.' },
    ],
  },
];

const PERMISSOES_VALIDAS = CATALOGO_PERMISSOES.flatMap((grupo) => grupo.permissoes.map((p) => p.chave));

/**
 * Normaliza a lista vinda do cliente: so chaves do catalogo, sem
 * duplicata, na ordem do catalogo. Chave desconhecida = 422 (nao ignora
 * em silencio - um typo no frontend deve aparecer, nao "sumir").
 */
function normalizarPermissoes(lista) {
  if (!Array.isArray(lista)) {
    throw new AppError('permissoes deve ser um array de strings.', 422);
  }
  const invalidas = lista.filter((chave) => !PERMISSOES_VALIDAS.includes(chave));
  if (invalidas.length) {
    throw new AppError(`Permissoes desconhecidas: ${invalidas.join(', ')}.`, 422);
  }
  return PERMISSOES_VALIDAS.filter((chave) => lista.includes(chave));
}

/**
 * Acesso EFETIVO de um usuario - lido do BANCO a cada requisicao protegida
 * (nao do JWT): se o admin editar um perfil ou trocar o perfil de alguem,
 * vale na proxima requisicao, sem esperar o token (8h) expirar. Custo: 1
 * SELECT por PK com join no perfil.
 *
 * Regras (ver comentario de Usuario.perfilId em schema.prisma):
 *   - role 'admin'          -> ehAdmin, TODAS as permissoes;
 *   - perfil definido       -> so as permissoes do perfil;
 *   - sem perfil, nao-admin -> TODAS (legado: usuarios de antes do RBAC).
 * Filtra por `empresaId` tambem - um token de um usuario que mudou de
 * tenant (ou forjado com sub de outra empresa) nao resolve acesso.
 */
async function resolverAcesso(prisma, usuarioId, tenantId) {
  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, empresaId: tenantId },
    select: {
      role: true,
      ativo: true,
      deveTrocarSenha: true,
      empresa: { select: { ativo: true } },
      perfil: { select: { id: true, nome: true, permissoes: true } },
    },
  });
  // `null` = sessao nao vale mais (o hook global em plugins/permissoes.js
  // responde 401 e o frontend desloga): usuario apagado, REMOVIDO da equipe
  // (ativo = false) ou empresa SUSPENSA pelo Supra Admin - as duas ultimas
  // passam a derrubar sessoes JA ABERTAS na hora, nao so o proximo login.
  if (!usuario || !usuario.ativo || !usuario.empresa.ativo) return null;

  const ehAdmin = usuario.role === 'admin';
  const perfil = usuario.perfil ? { id: usuario.perfil.id, nome: usuario.perfil.nome } : null;

  let permissoes;
  if (ehAdmin || !usuario.perfil) {
    permissoes = [...PERMISSOES_VALIDAS];
  } else {
    // Filtra contra o catalogo ATUAL - uma permissao removida do catalogo
    // (mas ainda gravada num perfil antigo) deixa de valer sozinha.
    const gravadas = Array.isArray(usuario.perfil.permissoes) ? usuario.perfil.permissoes : [];
    permissoes = PERMISSOES_VALIDAS.filter((chave) => gravadas.includes(chave));
  }

  return { ehAdmin, perfil, permissoes, legado: !ehAdmin && !usuario.perfil, deveTrocarSenha: usuario.deveTrocarSenha };
}

module.exports = { CATALOGO_PERMISSOES, PERMISSOES_VALIDAS, normalizarPermissoes, resolverAcesso };
