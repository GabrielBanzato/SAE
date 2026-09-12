import { Store } from 'lucide-react';

/**
 * Casca visual compartilhada por Login.jsx e Cadastro.jsx: painel de marca
 * com gradiente (some em telas pequenas) + coluna do formulario centralizada.
 * Extraida pra nao duplicar esse bloco (que nao e trivial) nas duas paginas.
 */
export default function AuthLayout({ titulo, subtitulo, children }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Store size={26} aria-hidden="true" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">SAE</span>
        </div>

        <div className="relative space-y-4">
          <h2 className="text-4xl font-extrabold leading-tight">Gerencie seu negócio com clareza e confiança.</h2>
          <p className="text-lg text-blue-100">
            Preços certos, vendas no controle e sua equipe organizada — tudo em um só lugar.
          </p>
        </div>

        <p className="relative text-sm text-blue-200">
          © {new Date().getFullYear()} Sistema de Apoio Empresarial
        </p>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Store size={22} aria-hidden="true" />
            </div>
            <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">SAE</span>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">{subtitulo}</p>}

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
