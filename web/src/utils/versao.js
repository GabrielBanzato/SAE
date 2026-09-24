/**
 * Versao do build do frontend (2026-09-23) - `__BUILD_ID__` e substituido
 * pelo Vite no momento do `npm run build` (ver `define` em vite.config.js).
 * Serve pra confirmar, na propria tela, se um deploy realmente chegou no
 * navegador: se o carimbo nao mudou depois de um redeploy, a imagem `web`
 * nao foi rebuildada ou o index.html antigo esta em cache.
 */
// eslint-disable-next-line no-undef
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

export function formatarVersao(buildId = BUILD_ID) {
  const data = new Date(buildId);
  if (Number.isNaN(data.getTime())) return buildId;
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
