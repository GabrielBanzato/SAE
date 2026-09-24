import { Loader2, Search, Wrench, CheckCircle2 } from 'lucide-react';

// Os 3 status que o Supra Admin controla manualmente - ABERTO e so o
// estado inicial de todo chamado recem-criado (nao tem botao proprio).
const OPCOES = [
  { valor: 'EM_ANALISE', rotulo: 'Em Análise', icon: Search, ativo: 'bg-blue-600 text-white border-blue-600' },
  { valor: 'SENDO_SOLUCIONADO', rotulo: 'Sendo Solucionado', icon: Wrench, ativo: 'bg-purple-600 text-white border-purple-600' },
  { valor: 'RESOLVIDO', rotulo: 'Resolvido', icon: CheckCircle2, ativo: 'bg-emerald-600 text-white border-emerald-600' },
];

/**
 * Controle de status do chamado (Supra Admin, Chat de Suporte 2026-09-23) -
 * grupo de 3 botoes, o do status atual fica "aceso". Usado na miniatura
 * (ChamadosSuporte.jsx, `compacto`) e no topo do chat (ChamadoDetalhe.jsx).
 * `processando` = valor do status sendo gravado agora (mostra spinner so nele).
 */
export default function ControleStatusChamado({ status, onAlterar, processando = null, compacto = false }) {
  return (
    <div className={`flex flex-wrap ${compacto ? 'gap-1.5' : 'gap-2'}`} role="group" aria-label="Status do chamado">
      {OPCOES.map(({ valor, rotulo, icon: Icon, ativo }) => {
        const selecionado = status === valor;
        return (
          <button
            key={valor}
            type="button"
            onClick={() => !selecionado && onAlterar(valor)}
            disabled={Boolean(processando)}
            aria-pressed={selecionado}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 font-bold transition-colors disabled:cursor-not-allowed ${
              // Nao-compacto so a partir do `sm` - no celular fica compacto sempre (3 botoes numa linha so).
              compacto ? 'px-3 py-1.5 text-xs' : 'px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm'
            } ${
              selecionado
                ? ativo
                : 'border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {processando === valor ? (
              <Loader2 size={compacto ? 14 : 16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Icon size={compacto ? 14 : 16} aria-hidden="true" />
            )}
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}
