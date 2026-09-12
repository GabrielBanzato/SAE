import { useEffect, useState } from 'react';
import { Mail, Phone, User, X } from 'lucide-react';
import CampoTexto from '../CampoTexto';

/**
 * Modal de cadastro rapido de cliente - reaproveitado em mais de uma tela
 * (PDV em Vendas.jsx, e a lista em Clientes.jsx), por isso mora aqui em vez
 * de dentro de `components/vendas/` (onde nasceu originalmente). So os 3
 * campos pedidos (Nome, Telefone, E-mail) - mesmo layout centralizado do
 * ModalProduto.jsx, pra manter consistencia visual entre os modais do app.
 */
export default function ModalClienteRapido({ onFechar, onSalvar }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onFechar]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    if (!nome.trim()) {
      setErro('Informe o nome do cliente.');
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
      });
    } catch (err) {
      setErro(err.message || 'Não foi possível cadastrar o cliente.');
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
        aria-labelledby="titulo-modal-cliente-rapido"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-modal-cliente-rapido" className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Novo Cliente
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
            label="Nome"
            icon={User}
            type="text"
            placeholder="Nome do cliente"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            autoFocus
            required
          />

          <CampoTexto
            label="Telefone"
            icon={Phone}
            type="tel"
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
          />

          <CampoTexto
            label="E-mail"
            icon={Mail}
            type="email"
            placeholder="cliente@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

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
              {salvando ? 'Salvando...' : 'Adicionar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
