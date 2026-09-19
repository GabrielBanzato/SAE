import { useEffect, useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import TipoPessoaToggle from '../TipoPessoaToggle';

// Chaves precisam bater com MAPA_MODULOS em api/src/services/auth.service.js
// (decide os modulos de negocio liberados - ver App.jsx/Sidebar.jsx) e com a
// mesma lista em pages/Cadastro.jsx (segmento tambem e escolhido no cadastro
// inicial, obrigatorio desde essa tarefa).
const SEGMENTOS = [
  { valor: 'varejo_alimentacao', rotulo: 'Varejo Alimentício' },
  { valor: 'moda_vestuario', rotulo: 'Moda e Vestuário' },
  { valor: 'saude_fitness', rotulo: 'Saúde e Fitness' },
  { valor: 'servicos_automotivos', rotulo: 'Serviços Automotivos' },
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
 * "Salvar Alteracoes" agora e real: `PUT /empresa/dados` persiste
 * razaoSocial/nomeLoja/endereco/telefone/segmento de verdade.
 * `onEmpresaAtualizada` (igual ao padrao ja usado em Assinatura.jsx)
 * atualiza a copia local em Configuracoes.jsx com a resposta do backend.
 *
 * `refreshEmpresa()` do AuthContext e chamado logo em seguida - mesmo
 * motivo de Assinatura.jsx: a copia de `empresa` cacheada la (usada por
 * Relatorios.jsx, Estoque.jsx/ModalProduto.jsx pro gate de segmento
 * "varejo_alimentacao", Vendas.jsx pro gate de forma de pagamento, e agora
 * tambem App.jsx/Sidebar.jsx pro roteamento/menu modular por `modulos`) so
 * atualizaria depois de um novo login/reload sem essa chamada explicita -
 * trocar de segmento aqui muda o array `modulos` na mesma resposta do PUT
 * (ver empresa.service.js#atualizarDados), entao rotas/menus se atualizam
 * sem precisar de um novo login.
 *
 * "Apelido/Fantasia" agora tem equivalente real no schema (`Empresa.nomeLoja`,
 * campo novo) - persiste de verdade junto com o resto do formulario.
 */
export default function DadosDaLoja({ empresa, onEmpresaAtualizada }) {
  const { refreshEmpresa } = useAuth();

  const [razaoSocial, setRazaoSocial] = useState('');
  const [apelido, setApelido] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [segmento, setSegmento] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (empresa) {
      setRazaoSocial(empresa.razaoSocial || '');
      setApelido(empresa.nomeLoja || '');
      setEndereco(empresa.endereco || '');
      setTelefone(empresa.telefone || '');
      setSegmento(empresa.segmento || '');
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
        body: JSON.stringify({ razaoSocial, nomeLoja: apelido, endereco, telefone, segmento }),
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
            Decide quais telas do sistema ficam disponíveis pra sua loja. Empresas do segmento Varejo Alimentício
            ganham opções extras na tela de Vendas (Consumo Interno, Doação) e podem usar Ficha Técnica de
            ingredientes.
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
