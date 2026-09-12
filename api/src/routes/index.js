module.exports = async function routes(fastify) {
  fastify.get('/health', { config: { public: true } }, async () => ({ status: 'ok' }));

  fastify.register(require('./auth.routes'), { prefix: '/auth' });
  fastify.register(require('./produtos.routes'), { prefix: '/produtos' });
  fastify.register(require('./precificacao.routes'), { prefix: '/precificacao' });
  fastify.register(require('./vendas.routes'), { prefix: '/vendas' });
  fastify.register(require('./empresa.routes'), { prefix: '/empresa' });
  fastify.register(require('./agenda.routes'), { prefix: '/agenda' });
  fastify.register(require('./clientes.routes'), { prefix: '/clientes' });
  fastify.register(require('./lancamentos.routes'), { prefix: '/lancamentos' });
  fastify.register(require('./relatorios.routes'), { prefix: '/relatorios' });
  fastify.register(require('./dashboard.routes'), { prefix: '/dashboard' });
  fastify.register(require('./ingredientes.routes'), { prefix: '/ingredientes' });
};
