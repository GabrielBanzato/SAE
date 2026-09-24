const empresaController = require('../controllers/empresa.controller');

module.exports = async function empresaRoutes(fastify) {
  // Nenhuma rota aqui declara config.public -> todas passam pelo hook
  // global de autenticacao (src/plugins/auth.js), exigindo JWT valido.
  //
  // RBAC (2026-09-24): tudo que ALTERA a empresa (dados, modulos,
  // pagamentos, assinatura, equipe) e so do admin. `GET /dados` fica livre
  // (o AuthContext de TODO usuario le a empresa/modulos no boot).
  const soAdmin = { preHandler: fastify.requireAdmin() };

  fastify.get('/dados', empresaController.obterDados);
  fastify.put('/dados', soAdmin, empresaController.atualizarDados);
  fastify.put('/modulos', soAdmin, empresaController.atualizarModulos);
  fastify.put('/pagamentos', soAdmin, empresaController.confirmarPagamento);
  fastify.put('/assinatura', soAdmin, empresaController.atualizarAssinatura);

  // Lista da equipe: admin (tela Equipe) + telas que escolhem uma pessoa
  // (Tarefas: responsavel; Vendas: funcionario no consumo interno). Admin
  // passa sempre (requirePermission libera admin).
  fastify.get('/usuarios', { preHandler: fastify.requirePermission('VER_TAREFAS', 'VER_VENDAS') }, empresaController.listarUsuarios);
  fastify.post('/usuarios', soAdmin, empresaController.adicionarUsuario);
  fastify.put('/usuarios/:id/perfil', soAdmin, empresaController.atualizarPerfilUsuario);
  fastify.post('/usuarios/:id/redefinir-senha', soAdmin, empresaController.redefinirSenhaUsuario);
  fastify.delete('/usuarios/:id', soAdmin, empresaController.removerUsuario);
};
