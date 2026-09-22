import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Store, FileText, User, Mail, Lock, Eye, EyeOff, UserPlus, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import CampoTexto from '../components/CampoTexto';
import TipoPessoaToggle from '../components/TipoPessoaToggle';

const TAMANHO_DOCUMENTO = { PF: 11, PJ: 14 };

// Chaves precisam bater com SEGMENTOS_VALIDOS/MAPA_MODULOS em
// api/src/services/auth.service.js (MAPA_MODULOS agora so decide o
// conjunto INICIAL de modulos no cadastro - depois disso a empresa liga/
// desliga cada um na pagina Modulos, ver arquitetura modular de
// 2026-09-22). Rotulos aqui sao so exibicao - a mesma lista de chaves e
// reaproveitada em components/configuracoes/DadosDaLoja.jsx (segmento
// tambem e editavel la).
const SEGMENTOS = [
  { valor: 'varejo_alimentacao', rotulo: 'Varejo Alimentício (padaria, mercado, restaurante)' },
  { valor: 'moda_vestuario', rotulo: 'Moda e Vestuário' },
  { valor: 'saude_fitness', rotulo: 'Saúde e Fitness' },
  { valor: 'servicos_automotivos', rotulo: 'Serviços Automotivos' },
];

function formatarDocumento(digitos, tipoPessoa) {
  if (tipoPessoa === 'PF') {
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digitos
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function Cadastro() {
  const { register, carregando, estaAutenticado } = useAuth();
  const navigate = useNavigate();

  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [nomeLoja, setNomeLoja] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState('PJ');
  const [documentoDigitos, setDocumentoDigitos] = useState('');
  const [segmento, setSegmento] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');

  if (estaAutenticado) {
    return <Navigate to="/" replace />;
  }

  function handleTipoPessoaChange(novoTipo) {
    if (novoTipo === tipoPessoa) return;
    setTipoPessoa(novoTipo);
    // CPF e CNPJ tem tamanhos diferentes - troca de tipo com digitos ja
    // preenchidos ficaria confuso (um CPF nao vira CNPJ so completando 3 digitos).
    setDocumentoDigitos('');
  }

  function handleDocumentoChange(valor) {
    setDocumentoDigitos(valor.replace(/\D/g, '').slice(0, TAMANHO_DOCUMENTO[tipoPessoa]));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    const tamanhoEsperado = TAMANHO_DOCUMENTO[tipoPessoa];
    if (documentoDigitos.length !== tamanhoEsperado) {
      setErro(
        tipoPessoa === 'PF'
          ? 'Informe um CPF válido (11 dígitos).'
          : 'Informe um CNPJ válido (14 dígitos).'
      );
      return;
    }

    // Segmento decide o conjunto INICIAL de modulos liberados pra essa
    // empresa (MAPA_MODULOS no backend, so usado no cadastro - ver
    // auth.service.js) - obrigatorio, sem fallback implicito. O <select>
    // abaixo ja tem `required`, mas essa checagem cobre o caso de alguem
    // burlar o atributo HTML (ex.: devtools).
    if (!segmento) {
      setErro('Selecione o segmento de atuação da sua loja.');
      return;
    }

    try {
      await register({
        nome_empresa: nomeEmpresa.trim(),
        nome_loja: nomeLoja.trim() || undefined,
        tipo_pessoa: tipoPessoa,
        documento: documentoDigitos,
        segmento,
        nome_usuario: nomeUsuario.trim(),
        email: email.trim(),
        senha,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setErro(err.message || 'Não foi possível concluir o cadastro.');
    }
  }

  return (
    <AuthLayout
      titulo="Crie a conta da sua loja"
      subtitulo="Leva menos de um minuto — depois é só entrar e organizar tudo."
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-5">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Store size={20} aria-hidden="true" />
            <h2 className="text-base font-bold uppercase tracking-wide">Dados da Loja</h2>
          </div>

          <TipoPessoaToggle value={tipoPessoa} onChange={handleTipoPessoaChange} />

          <CampoTexto
            label={tipoPessoa === 'PF' ? 'Nome Completo' : 'Razão Social'}
            icon={Store}
            type="text"
            placeholder={tipoPessoa === 'PF' ? 'Seu nome completo' : 'Ex: Padaria Pão Quente Ltda'}
            value={nomeEmpresa}
            onChange={(event) => setNomeEmpresa(event.target.value)}
            required
          />

          <CampoTexto
            label={tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
            icon={FileText}
            type="text"
            inputMode="numeric"
            placeholder={tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
            value={formatarDocumento(documentoDigitos, tipoPessoa)}
            onChange={(event) => handleDocumentoChange(event.target.value)}
            required
          />

          <CampoTexto
            label="Nome da Loja (opcional)"
            icon={Store}
            type="text"
            placeholder="Como sua loja é conhecida no dia a dia"
            value={nomeLoja}
            onChange={(event) => setNomeLoja(event.target.value)}
          />

          <label className="block">
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Segmento de Atuação</span>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-400">
              <Tag size={22} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <select
                value={segmento}
                onChange={(event) => setSegmento(event.target.value)}
                required
                className="w-full bg-transparent text-lg font-medium text-slate-900 outline-none dark:text-slate-100"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {SEGMENTOS.map(({ valor, rotulo }) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
            <span className="mt-1 block text-sm text-slate-400 dark:text-slate-500">
              Decide o conjunto inicial de módulos liberado pra sua loja — dá pra ligar/desligar cada um depois na
              página Módulos.
            </span>
          </label>
        </section>

        <div className="border-t border-slate-200 dark:border-slate-700" />

        <section className="space-y-5">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <User size={20} aria-hidden="true" />
            <h2 className="text-base font-bold uppercase tracking-wide">Dados do Administrador</h2>
          </div>

          <CampoTexto
            label="Nome completo"
            icon={User}
            type="text"
            autoComplete="name"
            placeholder="Seu nome"
            value={nomeUsuario}
            onChange={(event) => setNomeUsuario(event.target.value)}
            required
          />

          <CampoTexto
            label="E-mail"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="voce@sualoja.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <CampoTexto
            label="Senha"
            icon={Lock}
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            endAdornment={
              <button
                type="button"
                onClick={() => setMostrarSenha((atual) => !atual)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                {mostrarSenha ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            }
          />
        </section>

        {erro && (
          <p className="rounded-2xl bg-red-50 p-4 text-base font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-xl font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus size={22} aria-hidden="true" />
          {carregando ? 'Criando conta...' : 'Criar minha conta'}
        </button>
      </form>

      <p className="mt-8 text-center text-lg text-slate-500 dark:text-slate-400">
        Já tem uma conta?{' '}
        <Link to="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
