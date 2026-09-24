import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Carimbo do build (2026-09-23) - data/hora em que `npm run build` rodou,
    // embutida no bundle. Aparece no rodape da tela de Suporte e no console
    // do navegador: se depois de um deploy o carimbo nao mudou, o deploy
    // NAO pegou (imagem/HTML antigo em cache), sem precisar adivinhar.
    __BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },
})
