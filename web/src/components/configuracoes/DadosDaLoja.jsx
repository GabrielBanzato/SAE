import { useEffect, useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import TipoPessoaToggle from '../TipoPessoaToggle';

const SEGMENTOS = [
  { valor: 'alimenticio', rotulo: 'Alimentício' },
  { valor: 'varejo', rotulo: 'Varejo' },
  { valor: 'servicos', rotulo: 'Serviços' },
  { valor: 'outros', rotulo: 'Outros' },
];

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
 * Endereco, Telefone e Segmento sao editaveis localmente. Tipo de pessoa
 * (PF/PJ) e o documento (CPF/CNPJ) nunca sao editaveis aqui - mudar de PF
 * pra PJ (ou o documento em si) depois do cadastro nao e uma operacao de
 * formulario simples.
 *
 * "Salvar Alteracoes" agora e real: `PUT /empresa/dados` (criado nesta
 * tarefa) persiste razaoSocial/endereco/telefone/segmento de verdade.
 * `onEmpresaAtualizada` (igual ao padrao ja usado em Assinatura.jsx)
 * atualiza a copia local em Configuracoes.jsx com a resposta do backend.
 *
 * `refreshEmpresa()` do AuthContext e chamado logo em seguida - mesmo
 * motivo de Assinatura.jsx: a copia de `empresa` cacheada la (usada por
 * Relatorios.jsx, Estoque.jsx/ModalProduto.jsx pro gate de segmento
 * "alimenticio", e agora Vendas.jsx pro gate de forma de pagamento) so
 * atualizaria depois de um novo login/reload sem essa chamada explicita.
 *
 * "Apelido/Fantasia" continua sem equivalente em `Empresa` no schema -
 * unico campo que ainda so atualiza o estado local (nao entra no PUT).
 */
export default function DadosDaLoja({ empresa, onEmpresaAtualizada }) {
  const { refreshEmpresa } = useAuth();

  const [razaoSocial, setRazaoSocial] = useState('');
  const [apelido, setApelido] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [segmento, setSegmento] = useState('outros');

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (empresa) {
      setRazaoSocial(empresa.razaoSocial || '');
      setEndereco(empresa.endereco || '');
      setTelefone(empresa.telefone || '');
      setSegmento(empresa.segmento || 'outros');
    }
  }, [empresa]);

  if (!empresa) {
    return null;
  }

  async function handleSalvar(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      const atualizada = await apiFetch('/empresa/dados', {
        method: 'PUT',
        body: JSON.stringify({ razaoSocial, endereco, telefone, segmento }),
      });
      onEmpresaAtualizada((atual) => ({ ...atual, ...atualizada }));
      refreshEmpresa();
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar as alterações agora.');
    } finally {
      setSalvando(false);
    }
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
          dica="Opcional - usado em recibos e mensagens, se preenchido. Ainda não é salvo (sem campo correspondente no cadastro)."
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

        <label className="block">
          <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Segmento da Empresa</span>
          <select
            value={segmento}
            onChange={(event) => {
              setSegmento(event.target.value);
              setSalvo(false);
            }}
            required
            className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-xl font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
          >
            {SEGMENTOS.map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-sm text-slate-400 dark:text-slate-500">
            Empresas do segmento Alimentício ganham opções extras na tela de Vendas (Consumo Interno, Doação) e podem
            usar Ficha Técnica de ingredientes.
          </span>
        </label>
      </div>

      {erro && (
        <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Salvar Alterações'}
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
