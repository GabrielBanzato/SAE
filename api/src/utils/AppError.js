/**
 * Erro de negocio com status HTTP associado. O setErrorHandler global do
 * Fastify (src/app.js) usa `err.statusCode` para decidir a resposta -
 * services devem lancar isto em vez de retornar null/false silenciosamente.
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
