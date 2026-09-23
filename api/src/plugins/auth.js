const fp = require('fastify-plugin');
const jwt = require('@fastify/jwt');

/**
 * Middleware global de autenticacao + isolamento multi-tenant.
 *
 * Registra o @fastify/jwt e adiciona um hook "onRequest" que roda para
 * TODA rota por padrao. O hook:
 *
 *   1. Verifica e decodifica o JWT do header Authorization.
 *   2. Extrai `empresa_id` (o tenant_id) do payload do token.
 *   3. Injeta `request.tenantId`, `request.userId`, `request.userRole` e
 *      `request.userNivelAcesso` no request, para que controllers/services
 *      usem esse valor - nunca um empresa_id vindo do body/query, que o
 *      cliente poderia forjar para acessar dados de outro tenant.
 *      `userNivelAcesso` (LOJISTA/SUPERADMIN) e o unico ponto de confianca
 *      do middleware de `superadmin.routes.js`.
 *
 * Rotas publicas (login, health check, etc.) devem declarar
 * `config: { public: true }` para pular a verificacao:
 *
 *   fastify.post('/login', { config: { public: true } }, handler);
 */
module.exports = fp(async function authPlugin(fastify) {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
  });

  fastify.decorateRequest('tenantId', null);
  fastify.decorateRequest('userId', null);
  fastify.decorateRequest('userRole', null);
  fastify.decorateRequest('userNivelAcesso', null);

  fastify.addHook('onRequest', async (request, reply) => {
    const isPublic = request.routeOptions?.config?.public === true;
    if (isPublic) {
      return;
    }

    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Token ausente, invalido ou expirado.' });
      return reply;
    }

    const { sub, empresa_id: empresaId, role, nivel_acesso: nivelAcesso } = request.user;

    if (!empresaId) {
      reply.code(401).send({ error: 'Token nao contem um tenant valido.' });
      return reply;
    }

    // A partir daqui, qualquer service chamado neste request DEVE filtrar
    // por request.tenantId - esse e o unico ponto de confianca do tenant_id.
    request.tenantId = empresaId;
    request.userId = sub;
    request.userRole = role;
    request.userNivelAcesso = nivelAcesso;
  });
});
