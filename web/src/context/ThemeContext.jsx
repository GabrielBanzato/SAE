import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'sae_theme';

const ThemeContext = createContext(null);

function obterPreferenciaInicial() {
  const salvo = localStorage.getItem(STORAGE_KEY);
  if (salvo === 'light' || salvo === 'dark') {
    return salvo;
  }
  // Sem preferencia salva ainda: segue o tema do sistema operacional.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Contexto global de tema (claro/escuro). Aplica a classe `.dark` em
 * <html> - e o que a diretiva `@custom-variant dark` em index.css usa pra
 * decidir quando as classes `dark:*` do Tailwind entram em vigor - e
 * salva a preferencia do usuario em localStorage.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(obterPreferenciaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((atual) => (atual === 'dark' ? 'light' : 'dark'));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const contexto = useContext(ThemeContext);
  if (!contexto) {
    throw new Error('useTheme precisa ser usado dentro de um <ThemeProvider>.');
  }
  return contexto;
}
