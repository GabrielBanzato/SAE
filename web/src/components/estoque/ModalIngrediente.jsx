import { useEffect, useState } from 'react';
import { X, Wheat, Boxes } from 'lucide-react';
import CampoTexto from '../CampoTexto';

/** Mesmas 5 chaves aceitas pelo backend - ver UNIDADES_MEDIDA_VALIDAS em api/src/controllers/ingredientes.controller.js. */
const UNIDADES_MEDIDA = [
  { valor: 'kg', rotulo: 'Quilograma (kg)' },
  { valor: 'g', rotulo: 'Grama (g)' },
  { valor: 'l', rotulo: 'Litro (l)' },
  { valor: 'ml', rotulo: 'Mililitro (ml)' },
  { valor: 'un', rotulo: 'Unidade (un)' },
];

function SimboloReal({ className }) {
  return <span className={`text-base font-bold ${className}`}>R$</span>;
}

function valoresIniciais(ingrediente) {
  return {
    nome: ingrediente?.nome ?? '',
    unidadeMedida: ingrediente?.unidadeMedida ?? 'kg',
    custoUnitario: ingrediente?.custoUnitario ?? '',
    estoqueAtual: ingrediente?.estoqueAtual ?? '',
  };
}

/**
 * Modal de cadastro/edicao de ingrediente (correcao de bug, 2026-09-23 -
 * "Estoque > Ingredientes" nao tinha NENHUM jeito de cadastrar um
 * ingrediente pelo frontend, mesmo o backend ja tendo o CRUD completo
 * desde a tarefa original - ver api/src/services/ingredientes.service.js).
 * Mesmo padrao estrutural de `ModalProduto.jsx` (modal unico atende
 * "Novo"/"Editar", centralizado sobre overlay).
 */
export default function ModalIngrediente({ ingrediente, onFechar, onSalvar }) {
  const [campos, setCampos] = useState(() => valoresIniciais(ingrediente));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const editando = Boolean(ingrediente);

  useEffect(() => {
    setCampos(valoresIniciais(ingrediente));
    setErro('');
  }, [ingrediente]);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar]);

  function atualizarCampo(campo, valor) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    if (!campos.nome.trim()) {
      setErro('Informe o nome do ingrediente.');
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        nome: campos.nome.trim(),
        unidade_medida: campos.unidadeMedida,
        custo_unitario: Number(campos.custoUnitario) || 0,
        estoque_atual: Number(campos.estoqueAtual) || 0,
      });
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o ingrediente.');
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-ingrediente"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-ingrediente" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {editando ? 'Editar Ingrediente' : 'Novo Ingrediente'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <CampoTexto
            label="Nome do ingrediente"
            icon={Wheat}
            type="text"
            placeholder="Ex: Farinha de Trigo"
            value={campos.nome}
            onChange={(event) => atualizarCampo('nome', event.target.value)}
            autoFocus
            required
          />

          <label className="block">
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Unidade de Medida</span>
            <select
              value={campos.unidadeMedida}
              onChange={(event) => atualizarCampo('unidadeMedida', event.target.value)}
              className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
            >
              {UNIDADES_MEDIDA.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <CampoTexto
              label="Custo Unitário (R$)"
              icon={SimboloReal}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={campos.custoUnitario}
              onChange={(event) => atualizarCampo('custoUnitario', event.target.value)}
            />
            <CampoTexto
              label="Estoque Atual"
              icon={Boxes}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              placeholder="0"
              value={campos.estoqueAtual}
              onChange={(event) => atualizarCampo('estoqueAtual', event.target.value)}
            />
          </div>

          {erro && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-2xl px-5 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Adicionar Ingrediente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
