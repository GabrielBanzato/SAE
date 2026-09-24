const fastify = require('fastify');
const cors = require('@fastify/cors');

const prismaPlugin = require('./plugins/prisma');
const authPlugin = require('./plugins/auth');
const permissoesPlugin = require('./plugins/permissoes');
const routes = require('./routes');

function buildApp(opts = {}) {
  const app = fastify({
    logger: opts.logger ?? true,
  });

  // Sobrescreve o parser padrao de "application/json": por padrao o
  // Fastify rejeita (400 "Body cannot be empty...") uma requisicao com
  // esse Content-Type mas corpo vazio - erro real encontrado testando
  // DELETE /produtos/:id, que nao manda body. O motivo: a instancia do
  // Axios do frontend (web/src/services/api.js) define
  // "Content-Type: application/json" como header padrao em TODAS as
  // chamadas, inclusive DELETE sem corpo - entao esse cenario e comum, nao
  // um caso de borda. Corpo vazio agora vira `undefined` em vez de erro.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (body === '') {
      done(null, undefined);
      return;
    }

    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Permite o painel web (origem diferente - ex.: localhost:5173 no Vite)
  // chamar esta API (ex.: localhost:3000). Sem isso o navegador bloqueia
  // a requisicao antes mesmo dela chegar nas rotas.
  //
  // origin: '*' libera QUALQUER origem - de proposito, so pra
  // desenvolvimento (evita ficar reconfigurando toda vez que o front sobe
  // numa porta diferente). Antes de qualquer deploy real, trocar por uma
  // lista fechada de origens confiaveis (ex.: via CORS_ORIGIN no .env).
  app.register(cors, {
    origin: '*',
    // Default do @fastify/cors so libera GET/HEAD/POST - faltava PUT (usado
    // em /empresa/assinatura) e os outros verbos que a API usa.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Ordem importa: prisma primeiro (services dependem dele), depois auth
  // (middleware global de JWT + tenant), depois as rotas.
  app.register(prismaPlugin);
  app.register(authPlugin);
  // Autorizacao (RBAC) - depois do auth (precisa de request.userId/tenantId)
  // e antes das rotas (elas usam fastify.requirePermission/requireAdmin).
  app.register(permissoesPlugin);
  app.register(routes);

  app.setErrorHandler((err, request, reply) => {
    const statusCode = err.statusCode || 500;

    // Erros de negocio (4xx) sao esperados no fluxo normal - "warn" evita
    // poluir os logs como se fossem falhas reais do servidor (5xx).
    if (statusCode >= 500) {
      request.log.error(err);
    } else {
      request.log.warn({ err }, err.message);
    }

    reply.code(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor.' : err.message,
    });
  });

  return app;
}

module.exports = buildApp;
