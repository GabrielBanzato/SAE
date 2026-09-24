const fp = require('fastify-plugin');
const { resolverAcesso, PERMISSOES_VALIDAS } = require('../services/permissoes');

/**
 * Middleware de AUTORIZACAO (RBAC, 2026-09-24) - roda DEPOIS do hook global
 * de autenticacao (plugins/auth.js, que ja validou o JWT e populou
 * `request.userId`/`request.tenantId`). Expoe dois decorators pra usar como
 * `preHandler` de rota (ou de um plugin de rotas inteiro):
 *
 *   fastify.get('/', { preHandler: fastify.requirePermission('VER_VENDAS') }, handler)
 *   fastify.addHook('preHandler', fastify.requirePermission('VER_FINANCEIRO'))
 *
 *   requirePermission('A', 'B') -> passa se tiver A OU B (qualquer uma) -
 *     necessario pra endpoints usados por mais de uma tela (ex.: a tela de
 *     Vendas precisa LISTAR produtos sem ter acesso ao Modulo de Producao).
 *   requireAdmin() -> so `role: 'admin'` (gestao de perfis/equipe/assinatura).
 *
 * O acesso e resolvido do BANCO uma vez por requisicao e guardado em
 * `request.acesso` (varios preHandlers na mesma rota nao repetem a query) -
 * ver services/permissoes.js#resolverAcesso pras regras.
 */
module.exports = fp(async function permissoesPlugin(fastify) {
  fastify.decorateRequest('acesso', null);

  async function carregarAcesso(request) {
    if (!request.acesso) {
      request.acesso = await resolverAcesso(fastify.prisma, request.userId, request.tenantId);
    }
    return request.acesso;
  }
  fastify.decorate('carregarAcesso', carregarAcesso);

  /**
   * Hook GLOBAL (toda rota autenticada - o plugin e `fp`, entao vale pra
   * arvore inteira registrada depois dele), roda antes dos preHandlers de
   * rota (requirePermission/requireAdmin reaproveitam o `request.acesso`
   * carregado aqui, sem 2a query):
   *
   *  1) Sessao ainda vale? Usuario removido da equipe (ativo = false),
   *     apagado, ou empresa suspensa -> 401. O JWT continua "valido" pela
   *     assinatura, mas deixa de servir na hora - o frontend recebe o 401 e
   *     desloga (interceptor em web/src/services/api.js).
   *  2) Senha temporaria pendente (`deveTrocarSenha`) -> 403
   *     TROCA_SENHA_OBRIGATORIA em tudo, exceto rotas marcadas com
   *     `config: { permitidoComSenhaTemporaria: true }` (GET /auth/me e
   *     PUT /auth/senha). A tela de troca no frontend e UX; quem obriga de
   *     verdade e isto aqui.
   */
  fastify.addHook('preHandler', async (request, reply) => {
    const config = request.routeOptions?.config ?? {};
    if (config.public === true || !request.userId) return;

    const acesso = await carregarAcesso(request);
    if (!acesso) {
      reply.code(401).send({ error: 'Sua sessao foi encerrada. Entre novamente.' });
      return reply;
    }
    if (acesso.deveTrocarSenha && config.permitidoComSenhaTemporaria !== true) {
      reply.code(403).send({
        error: 'Defina uma nova senha para continuar usando o sistema.',
        codigo: 'TROCA_SENHA_OBRIGATORIA',
      });
      return reply;
    }
  });

  fastify.decorate('requirePermission', (...permissoesAceitas) => {
    // Falha no BOOT (nao em runtime) se alguma rota usar uma chave que nao
    // existe no catalogo - typo aqui bloquearia a rota pra todo nao-admin.
    const desconhecidas = permissoesAceitas.filter((p) => !PERMISSOES_VALIDAS.includes(p));
    if (!permissoesAceitas.length || desconhecidas.length) {
      throw new Error(`requirePermission: permissao invalida (${desconhecidas.join(', ') || 'nenhuma informada'}).`);
    }

    return async function verificarPermissao(request, reply) {
      const acesso = await carregarAcesso(request);
      if (!acesso) {
        reply.code(401).send({ error: 'Usuario nao encontrado.' });
        return reply;
      }
      if (acesso.ehAdmin || permissoesAceitas.some((p) => acesso.permissoes.includes(p))) return;

      reply.code(403).send({
        error: 'Voce nao tem permissao para acessar este recurso. Fale com o administrador da loja.',
        permissaoNecessaria: permissoesAceitas,
      });
      return reply;
    };
  });

  fastify.decorate('requireAdmin', () => async function verificarAdmin(request, reply) {
    const acesso = await carregarAcesso(request);
    if (!acesso) {
      reply.code(401).send({ error: 'Usuario nao encontrado.' });
      return reply;
    }
    if (acesso.ehAdmin) return;
    reply.code(403).send({ error: 'Apenas o administrador da loja pode fazer isso.' });
    return reply;
  });
});
