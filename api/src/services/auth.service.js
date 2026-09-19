const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;

// Tamanho esperado do documento (so digitos) por tipo de pessoa - CPF tem
// 11 digitos, CNPJ tem 14.
const TAMANHO_DOCUMENTO = { PF: 11, PJ: 14 };

/**
 * SaaS modular: cada chave e um "segmento de atuacao" que a empresa escolhe
 * no cadastro (Cadastro.jsx) ou depois em Configuracoes > Dados da Loja - o
 * valor associado e a lista de MODULOS de negocio liberados pra essa
 * empresa. O frontend (App.jsx/Sidebar.jsx) so monta a rota/o item de menu
 * de um modulo se a chave dele estiver presente no array `modulos` (devolvido
 * dentro de `empresa` no JSON de login/registro e de GET /empresa/dados -
 * ver `modulosDoSegmento` abaixo e empresa.service.js).
 *
 * Este dicionario e a UNICA fonte da verdade da associacao segmento->modulos
 * (nao existe tabela relacional "empresas_modulos" no banco, por decisao de
 * projeto - orquestracao em memoria no backend e suficiente pro tamanho
 * atual do catalogo de modulos). `SEGMENTOS_VALIDOS` (usado pra validar o
 * `segmento` recebido no cadastro/atualizacao) e derivado das chaves deste
 * mapa, nunca mantido como uma segunda lista solta - evita as duas listas
 * saírem de sincronia entre si.
 *
 * Chaves de modulo usadas hoje (precisam bater com `ROTAS_POR_MODULO` em
 * web/src/App.jsx e com os campos `modulo` de web/src/components/Sidebar.jsx):
 * 'pdv', 'produtos', 'precificacao', 'estoque_avancado', 'clientes',
 * 'financeiro', 'agenda', 'relatorios'. Dashboard, Configuracoes, Modulos,
 * Suporte e Notas ficam de fora deste mapa de proposito - sao paginas
 * sempre acessiveis, independentes de segmento.
 */
const MAPA_MODULOS = {
  // Ex.: padarias, mercados, restaurantes - precisa do catalogo completo,
  // inclusive controle de estoque fino (perecivel) e Ficha Tecnica de
  // ingredientes (gate a parte, ver Empresa.segmento no schema.prisma).
  varejo_alimentacao: [
    'pdv',
    'produtos',
    'precificacao',
    'estoque_avancado',
    'clientes',
    'financeiro',
    'agenda',
    'relatorios',
  ],
  // Ex.: lojas de roupa/calcados/acessorios - varejo com estoque por
  // grade (tamanho/cor), mas sem a rotina de agendamento de um prestador
  // de servico.
  moda_vestuario: ['pdv', 'produtos', 'precificacao', 'estoque_avancado', 'clientes', 'financeiro', 'relatorios'],
  // Ex.: personal trainers, estudios, clinicas pequenas - foco em
  // clientes/agenda (a rotina e "hora marcada", nao "balcao"); ainda vende
  // produtos (suplementos, planos) mas sem o peso de um controle de
  // estoque avancado.
  saude_fitness: ['pdv', 'produtos', 'clientes', 'agenda', 'financeiro', 'relatorios'],
  // Ex.: oficinas mecanicas - servico agendado (ordem de servico) +
  // pecas/produtos vendidos junto, sem necessidade de um modulo de
  // precificacao/estoque tao fino quanto o varejo.
  servicos_automotivos: ['pdv', 'produtos', 'clientes', 'agenda', 'financeiro', 'relatorios'],
};

const SEGMENTOS_VALIDOS = Object.keys(MAPA_MODULOS);

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
      // Modulos de negocio liberados pra essa empresa, calculados AGORA a
      // partir do segmento escolhido no cadastro - nunca guardados no JWT
      // (payload do token continua so com sub/empresa_id/role, ver
      // `gerarToken` acima), so no corpo desta resposta. O frontend
      // (AuthContext#persistirSessao) guarda este array em `empresa.modulos`
      // pra decidir quais rotas/itens de menu montar (ver App.jsx/Sidebar.jsx).
      modulos: modulosDoSegmento(empresa.segmento),
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

  // `include: { empresa: ... }` so pra ler o `segmento` dela - precisamos
  // saber quais modulos essa empresa tem liberados pra montar a resposta
  // abaixo (nao seria possivel calcular `modulos` so com o `usuario`).
  const usuario = await prisma.usuario.findFirst({
    where: { email },
    include: { empresa: { select: { segmento: true } } },
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
    // tambem devolve `modulos` (ver empresa.service.js#obterDados) usando
    // o MESMO `modulosDoSegmento` - login so adianta esse dado pra nao
    // esperar essa segunda chamada terminar antes de decidir quais
    // rotas/menus montar.
    empresa: {
      modulos: modulosDoSegmento(usuario.empresa.segmento),
    },
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    },
  };
}

module.exports = { register, login, MAPA_MODULOS, SEGMENTOS_VALIDOS, modulosDoSegmento };
