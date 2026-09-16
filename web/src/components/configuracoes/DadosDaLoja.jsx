import { useEffect, useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
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
 * GET /empresa/dados. Razao Social/Nome Completo, Apelido/Fantasia,
 * Endereco e Telefone sao editaveis localmente. Tipo de pessoa (PF/PJ) e o
 * documento (CPF/CNPJ) nunca sao editaveis aqui - mudar de PF pra PJ (ou o
 * documento em si) depois do cadastro nao e uma operacao de formulario
 * simples.
 *
 * "Salvar Alteracoes": nao existe (ainda) uma rota PUT /empresa/dados no
 * backend pra persistir isso de verdade - o clique so faz um
 * `console.log` do payload e mostra "Salvo com sucesso" por alguns
 * segundos (pedido explicito: mock por enquanto, com feedback visual).
 * Quando essa rota existir, e so trocar o `console.log` por um
 * `apiFetch('/empresa/dados', { method: 'PUT', body: ... })` de verdade.
 *
 * "Apelido/Fantasia" e um campo novo, sem equivalente em `Empresa` no
 * schema.prisma ainda - por isso nao vem prefiltrado do backend (comeca
 * sempre vazio). Se um dia esse campo virar persistente de verdade, junto
 * com o PUT acima, tambem precisa de uma coluna nova
 * (`nome_fantasia String?`) na tabela `empresas`.
 */
export default function DadosDaLoja({ empresa }) {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [apelido, setApelido] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvo, setSalvo] = useState(false);

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

  function handleSalvar(event) {
    event.preventDefault();

    // Mock: sem rota de backend pra isso ainda (ver comentario acima).
    console.log('[DadosDaLoja] Salvar Alterações (mock):', {
      razaoSocial,
      apelido,
      endereco,
      telefone,
    });

    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <form onSubmit={handleSalvar} className="max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="space-y-5">
        <TipoPessoaToggle value={empresa.tipoPessoa} disabled />
        <Campo
          label={empresa.tipoPessoa === 'PF' ? 'Nome Completo' : 'Nome da Loja'}
          value={razaoSocial}
          onChange={(valor) => {
            setRazaoSocial(valor);
            setSalvo(false);
          }}
          placeholder={empresa.tipoPessoa === 'PF' ? 'Seu nome completo' : 'Nome da loja'}
        />
        <Campo
          label="Apelido / Nome Fantasia"
          value={apelido}
          onChange={(valor) => {
            setApelido(valor);
            setSalvo(false);
          }}
          placeholder="Como sua loja é conhecida no dia a dia"
          dica="Opcional - usado em recibos e mensagens, se preenchido."
        />
        <Campo
          label={empresa.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
          value={formatarDocumento(empresa.documento, empresa.tipoPessoa)}
          disabled
          dica="O documento não pode ser alterado por aqui."
        />
        <Campo
          label="Telefone / WhatsApp"
          value={telefone}
          onChange={(valor) => {
            setTelefone(valor);
            setSalvo(false);
          }}
          placeholder="(11) 98765-4321"
        />
        <Campo
          label="Endereço Completo"
          value={endereco}
          onChange={(valor) => {
            setEndereco(valor);
            setSalvo(false);
          }}
          placeholder="Rua, número, bairro, cidade - UF"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Salvar Alterações
        </button>

        {salvo && (
          <span className="flex items-center gap-2 text-base font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={20} aria-hidden="true" />
            Salvo com sucesso!
          </span>
        )}
      </div>
    </form>
  );
}
