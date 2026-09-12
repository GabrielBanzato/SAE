import { Lock } from 'lucide-react';

/**
 * Modulo Fiscal (emissao de NFe/NFCe) ainda nao existe - em vez do
 * `Placeholder` generico ("Em construção") usado por outras telas ainda
 * nao implementadas, esta pagina e uma "Pagina Bloqueada" dedicada: emissao
 * fiscal e uma funcionalidade sensivel (exige integracao com a SEFAZ,
 * certificado digital, validacao de layout do XML etc.), entao o tom aqui
 * e "bloqueado de proposito, chegando com cuidado" em vez de "esqueleto de
 * navegacao vazio". `pointer-events-none` + `aria-disabled` no cartao
 * garantem que nada nesta tela responde a clique, mesmo que algo
 * interativo seja adicionado aqui por engano no futuro.
 */
export default function Notas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
          <Lock size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Notas
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">Emissão e histórico de notas fiscais.</p>
      </div>

      <div
        aria-disabled="true"
        className="pointer-events-none flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
      >
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900/60 dark:text-slate-500">
          <Lock size={40} aria-hidden="true" />
        </span>

        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Módulo Fiscal em Desenvolvimento
        </h2>

        <p className="max-w-md text-lg text-slate-500 dark:text-slate-400">
          A emissão de notas fiscais (NFe/NFCe) ainda não está disponível, mas já está sendo construída com todo o
          cuidado. Em breve você poderá emitir suas notas direto por aqui, com total conformidade com a legislação
          fiscal.
        </p>
      </div>
    </div>
  );
}
