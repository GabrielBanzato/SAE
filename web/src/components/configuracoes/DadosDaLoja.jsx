import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import TipoPessoaToggle from '../TipoPessoaToggle';

function formatarDocumento(documento, tipoPessoa) {
  if (!documento) return '';
  if (tipoPessoa === 'PF' && documento.length === 11) {
    return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (documento.length === 14) {
    return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return documento;
}

function Campo({ label, value, onChange, placeholder, disabled = false, dica }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
        {label}
        {disabled && <Lock size={16} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-xl font-medium text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-blue-400 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
      />
      {dica && <span className="mt-1 block text-sm text-slate-400 dark:text-slate-500">{dica}</span>}
    </label>
  );
}

/**
 * Formulario com os dados cadastrais da loja, prefiltrado a partir de
 * GET /empresa/dados. Razao Social/Nome Completo, Endereco e Telefone sao
 * editaveis localmente, mas o botao de salvar ainda esta desabilitado -
 * nao existe (ainda) uma rota PUT /empresa/dados no backend para
 * persistir isso. Tipo de pessoa (PF/PJ) e o documento (CPF/CNPJ) nunca
 * sao editaveis aqui - mudar de PF pra PJ (ou o documento em si) depois do
 * cadastro nao e uma operacao de formulario simples.
 */
export default function DadosDaLoja({ empresa }) {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');

  useEffect(() => {
    if (empresa) {
      setRazaoSocial(empresa.razaoSocial || '');
      setEndereco(empresa.endereco || '');
      setTelefone(empresa.telefone || '');
    }
  }, [empresa]);

  if (!empresa) {
    return null;
  }

  return (
    <div className="max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="space-y-5">
        <TipoPessoaToggle value={empresa.tipoPessoa} disabled />
        <Campo
          label={empresa.tipoPessoa === 'PF' ? 'Nome Completo' : 'Razão Social'}
          value={razaoSocial}
          onChange={setRazaoSocial}
          placeholder={empresa.tipoPessoa === 'PF' ? 'Seu nome completo' : 'Nome da empresa'}
        />
        <Campo
          label={empresa.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
          value={formatarDocumento(empresa.documento, empresa.tipoPessoa)}
          disabled
          dica="O documento não pode ser alterado por aqui."
        />
        <Campo label="Telefone" value={telefone} onChange={setTelefone} placeholder="(11) 98765-4321" />
        <Campo
          label="Endereço"
          value={endereco}
          onChange={setEndereco}
          placeholder="Rua, número, bairro, cidade - UF"
        />
      </div>

      <div className="mt-6">
        <button
          type="button"
          disabled
          title="Em breve"
          className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Salvar Alterações
        </button>
        <span className="ml-3 text-sm text-slate-400 dark:text-slate-500">
          Em breve — por enquanto esta tela só exibe os dados.
        </span>
      </div>
    </div>
  );
}
