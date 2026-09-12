import { useEffect, useState } from 'react';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Save,
  CreditCard,
  Wallet,
  QrCode,
  ArrowLeftRight,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

const ATRASO_DEBOUNCE_MS = 500;

const FORMAS_PAGAMENTO = [
  {
    id: 'credito',
    label: 'Cartão de Crédito',
    icon: CreditCard,
    ativo: 'border-blue-500 bg-blue-50 shadow-lg dark:border-blue-400 dark:bg-blue-950/40',
    icone: 'text-blue-600 dark:text-blue-400',
    texto: 'text-blue-700 dark:text-blue-300',
  },
  {
    id: 'debito',
    label: 'Cartão de Débito',
    icon: Wallet,
    ativo: 'border-purple-500 bg-purple-50 shadow-lg dark:border-purple-400 dark:bg-purple-950/40',
    icone: 'text-purple-600 dark:text-purple-400',
    texto: 'text-purple-700 dark:text-purple-300',
  },
  {
    id: 'pix',
    label: 'Pix',
    icon: QrCode,
    ativo: 'border-emerald-500 bg-emerald-50 shadow-lg dark:border-emerald-400 dark:bg-emerald-950/40',
    icone: 'text-emerald-600 dark:text-emerald-400',
    texto: 'text-emerald-700 dark:text-emerald-300',
  },
];

const PARCELAS = Array.from({ length: 12 }, (_, indice) => indice + 1);

function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Campo({ label, sufixo, value, onChange, placeholder, type = 'number' }) {
  return (
    <label className="block">
      <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">{label}</span>
      <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-400">
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : 'text'}
          min={type === 'number' ? '0' : undefined}
          step={type === 'number' ? '0.01' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
        />
        {sufixo && <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">{sufixo}</span>}
      </div>
    </label>
  );
}

/**
 * Nucleo da Calculadora de Precificacao "Top de Linha" (chama o backend
 * real, `POST /produtos/calcular-preco`, e e bidirecional de verdade -
 * ver detalhe do `modoEdicao` mais abaixo) - extraido de
 * `pages/CalculadoraPrecificacao.jsx` pra ser reaproveitado em 2 lugares:
 * a pagina `/precificacao` (modo completo, cria um produto novo do zero)
 * e o modal "Calculadora de Lucros" dentro do cadastro de Produtos
 * (`modoEmbutido`, so calcula e devolve o preco pro formulario que ja
 * esta aberto - nao cria produto nenhum aqui).
 *
 *   - Editar Custo/Lucro   -> calcula e preenche o Preco Final (modo direto).
 *   - Editar o Preco Final -> calcula reverso e preenche o Lucro (modo reverso).
 *
 * O estado `modoEdicao` decide qual dos dois useEffect abaixo esta "no
 * comando" - cada um exclui DELIBERADAMENTE o campo que ele mesmo escreve
 * do proprio array de dependencias (senao o efeito reagiria a sua propria
 * escrita e cancelaria a si mesmo antes do fetch terminar - mesmo bug ja
 * corrigido em Configuracoes.jsx). O campo "irmao" so entra na dependencia
 * do efeito que NAO o escreve, entao nao ha ping-pong entre os dois.
 */
export default function CalculadoraLucros({ modoEmbutido = false, custoInicial = '', onAplicarPreco }) {
  const [nome, setNome] = useState('');
  const [custo, setCusto] = useState(custoInicial);
  const [formaPagamento, setFormaPagamento] = useState('credito');
  const [parcelas, setParcelas] = useState(1);
  const [taxaMaquininha, setTaxaMaquininha] = useState('');
  const [tipoLucro, setTipoLucro] = useState('percentual');
  const [lucro, setLucro] = useState('');
  const [precoFinal, setPrecoFinal] = useState('');

  const [modoEdicao, setModoEdicao] = useState('lucro'); // 'lucro' | 'precoFinal'
  const [lucroReais, setLucroReais] = useState(null);
  const [taxaReais, setTaxaReais] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [erroCalculo, setErroCalculo] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [mensagemSalvar, setMensagemSalvar] = useState(null);

  const taxaObrigatoria = formaPagamento !== 'pix';
  const taxaEfetiva = formaPagamento === 'pix' ? 0 : Number(taxaMaquininha);
  const taxaPreenchida = !taxaObrigatoria || taxaMaquininha !== '';

  function handleLucroInput(valor) {
    setModoEdicao('lucro');
    setLucro(valor);
  }

  function handlePrecoFinalInput(valor) {
    setModoEdicao('precoFinal');
    setPrecoFinal(valor);
  }

  function alternarTipoLucro(novoTipo) {
    if (novoTipo === tipoLucro) return;

    // Converte o numero ja digitado pra nao virar um valor sem sentido na
    // nova unidade (ex.: "30" significando 30% virando "R$ 30" do nada).
    const precoNum = Number(precoFinal);
    const lucroNum = Number(lucro);

    if (lucro !== '' && Number.isFinite(lucroNum) && Number.isFinite(precoNum) && precoNum > 0) {
      const convertido =
        novoTipo === 'fixo' ? arredondar((lucroNum / 100) * precoNum) : arredondar((lucroNum / precoNum) * 100);
      setLucro(String(convertido));
    } else {
      setLucro('');
    }

    setTipoLucro(novoTipo);
  }

  // Modo direto: custo + taxa + lucro -> preco final.
  useEffect(() => {
    if (modoEdicao !== 'lucro') return undefined;

    if (custo === '' || lucro === '' || !taxaPreenchida) {
      setPrecoFinal('');
      setLucroReais(null);
      setTaxaReais(null);
      setErroCalculo('');
      return undefined;
    }

    let ativo = true;
    setCalculando(true);
    setErroCalculo('');

    const timer = setTimeout(async () => {
      try {
        const dados = await apiFetch('/produtos/calcular-preco', {
          method: 'POST',
          body: JSON.stringify({
            custo: Number(custo),
            taxaMaquininha: taxaEfetiva,
            tipoLucro,
            lucroDesejado: Number(lucro),
          }),
        });
        if (ativo) {
          setPrecoFinal(String(dados.precoVenda));
          setLucroReais(dados.valorLucro);
          setTaxaReais(dados.valorTaxaMaquininha);
        }
      } catch (err) {
        if (ativo) {
          setErroCalculo(err.message || 'Não foi possível calcular o preço.');
          setPrecoFinal('');
          setLucroReais(null);
        }
      } finally {
        if (ativo) setCalculando(false);
      }
    }, ATRASO_DEBOUNCE_MS);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoEdicao, custo, taxaEfetiva, taxaPreenchida, tipoLucro, lucro]);

  // Modo reverso: custo + taxa + preco final (digitado) -> lucro.
  useEffect(() => {
    if (modoEdicao !== 'precoFinal') return undefined;

    if (custo === '' || precoFinal === '' || !taxaPreenchida) {
      setErroCalculo('');
      return undefined;
    }

    let ativo = true;
    setCalculando(true);
    setErroCalculo('');

    const timer = setTimeout(async () => {
      try {
        const dados = await apiFetch('/produtos/calcular-preco', {
          method: 'POST',
          body: JSON.stringify({
            custo: Number(custo),
            taxaMaquininha: taxaEfetiva,
            precoVendaForcado: Number(precoFinal),
          }),
        });
        if (ativo) {
          const precoNum = Number(precoFinal);
          const lucroConvertido =
            tipoLucro === 'percentual' && precoNum > 0
              ? arredondar((dados.lucroCalculado / precoNum) * 100)
              : arredondar(dados.lucroCalculado);
          setLucro(String(lucroConvertido));
          setLucroReais(dados.lucroCalculado);
          setTaxaReais(dados.valorTaxaMaquininha);
        }
      } catch (err) {
        if (ativo) {
          setErroCalculo(err.message || 'Não foi possível calcular o lucro.');
          setLucroReais(null);
        }
      } finally {
        if (ativo) setCalculando(false);
      }
    }, ATRASO_DEBOUNCE_MS);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoEdicao, custo, taxaEfetiva, taxaPreenchida, precoFinal, tipoLucro]);

  async function handleSalvar() {
    if (!nome.trim()) {
      setMensagemSalvar({ tipo: 'erro', texto: 'Informe o nome do produto antes de salvar.' });
      return;
    }

    setSalvando(true);
    setMensagemSalvar(null);

    try {
      await apiFetch('/produtos', {
        method: 'POST',
        body: JSON.stringify({
          nome: nome.trim(),
          custo: Number(custo),
          preco_venda: Number(precoFinal),
          estoque_atual: 0,
          estoque_minimo: 0,
        }),
      });
      setMensagemSalvar({ tipo: 'sucesso', texto: `Produto "${nome.trim()}" salvo com sucesso!` });

      // Limpa os campos do produto salvo - sem isso, um segundo clique
      // acidental em "Salvar Produto" criaria um duplicado, ja que nome e
      // preco continuariam preenchidos com os mesmos valores. Mantem forma
      // de pagamento/tipo de lucro/parcelas (preferencia pro proximo produto).
      setNome('');
      setCusto('');
      setTaxaMaquininha('');
      setLucro('');
      setPrecoFinal('');
      setLucroReais(null);
      setTaxaReais(null);
      setModoEdicao('lucro');
    } catch (err) {
      setMensagemSalvar({ tipo: 'erro', texto: err.message || 'Não foi possível salvar o produto.' });
    } finally {
      setSalvando(false);
    }
  }

  function handleAplicarPreco() {
    onAplicarPreco?.({ custo: Number(custo) || 0, precoVenda: Number(precoFinal) || 0 });
  }

  // No modo embutido nao ha campo "nome" (o produto ja esta sendo
  // cadastrado no formulario por tras do modal) - so exige preco calculado.
  const podeSalvar = Boolean(precoFinal && !calculando && !erroCalculo && !salvando && (modoEmbutido || nome.trim()));
  const lucroNegativo = typeof lucroReais === 'number' && lucroReais < 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <div className="space-y-6 rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        {!modoEmbutido && (
          <Campo label="Nome do produto" value={nome} onChange={setNome} placeholder="Ex: Pão Francês" type="text" />
        )}
        <Campo label="Custo (R$)" sufixo="R$" value={custo} onChange={setCusto} placeholder="0,00" />

        {/* Forma de pagamento */}
        <div>
          <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Forma de Pagamento</span>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {FORMAS_PAGAMENTO.map(({ id, label, icon: Icon, ativo, icone, texto }) => {
              const selecionado = formaPagamento === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => setFormaPagamento(id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition-all duration-300 ease-in-out sm:p-4 ${
                    selecionado
                      ? ativo
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon
                    size={26}
                    className={selecionado ? icone : 'text-slate-400 dark:text-slate-500'}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-xs font-semibold leading-tight sm:text-sm ${
                      selecionado ? texto : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parcelas (so credito) + Taxa (credito e debito) */}
        {formaPagamento === 'credito' && (
          <label className="block">
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Quantidade de Parcelas</span>
            <select
              value={parcelas}
              onChange={(event) => setParcelas(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-xl font-semibold text-slate-900 outline-none transition-all focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
            >
              {PARCELAS.map((numero) => (
                <option key={numero} value={numero}>
                  {numero}x
                </option>
              ))}
            </select>
          </label>
        )}

        {taxaObrigatoria && (
          <Campo
            label={formaPagamento === 'credito' ? `Taxa da Maquininha (%) — ${parcelas}x` : 'Taxa da Maquininha (%)'}
            sufixo="%"
            value={taxaMaquininha}
            onChange={setTaxaMaquininha}
            placeholder="0"
          />
        )}

        {/* Lucro: toggle % / R$ + input */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Lucro Desejado</span>
            <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-700">
              <button
                type="button"
                onClick={() => alternarTipoLucro('percentual')}
                className={`rounded-full px-3 py-1 text-sm font-bold transition-all duration-200 ${
                  tipoLucro === 'percentual'
                    ? 'bg-white text-blue-700 shadow dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => alternarTipoLucro('fixo')}
                className={`rounded-full px-3 py-1 text-sm font-bold transition-all duration-200 ${
                  tipoLucro === 'fixo'
                    ? 'bg-white text-blue-700 shadow dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                R$
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-all focus-within:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-400">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={lucro}
              onChange={(event) => handleLucroInput(event.target.value)}
              placeholder={tipoLucro === 'percentual' ? '0' : '0,00'}
              className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
            <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">
              {tipoLucro === 'percentual' ? '%' : 'R$'}
            </span>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className="flex flex-col justify-between rounded-3xl bg-blue-600 p-6 text-white shadow-lg dark:bg-blue-700">
        <div>
          <div className="flex items-center gap-2 text-blue-100">
            <Calculator size={24} aria-hidden="true" />
            <span className="text-lg font-semibold">Preço Final de Venda</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-200">
            <ArrowLeftRight size={14} aria-hidden="true" />
            Edite aqui também — o lucro se ajusta sozinho
          </p>

          <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-blue-400/40 bg-white/10 px-4 py-3 transition-all focus-within:border-white">
            <span className="text-2xl font-extrabold text-blue-100 sm:text-3xl">R$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={precoFinal}
              onChange={(event) => handlePrecoFinalInput(event.target.value)}
              placeholder="0,00"
              className="w-full bg-transparent text-3xl font-extrabold text-white outline-none placeholder:text-blue-200/50 sm:text-4xl"
            />
          </div>

          {calculando && <p className="mt-3 text-base text-blue-100">Calculando...</p>}

          {!calculando && erroCalculo && (
            <p className="mt-3 rounded-xl bg-red-500/20 p-4 text-base font-medium text-red-50">{erroCalculo}</p>
          )}

          {!calculando && !erroCalculo && lucroReais !== null && (
            <div className="mt-6 space-y-2 border-t border-blue-400/40 pt-4 text-lg text-blue-50">
              <div className="flex items-center justify-between">
                <span>Custo do produto</span>
                <span className="font-semibold">{formatarMoeda(Number(custo) || 0)}</span>
              </div>
              {taxaObrigatoria && (
                <div className="flex items-center justify-between">
                  <span>Taxa da maquininha</span>
                  <span className="font-semibold">{formatarMoeda(taxaReais || 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  {lucroNegativo ? (
                    <TrendingDown size={18} aria-hidden="true" />
                  ) : (
                    <TrendingUp size={18} aria-hidden="true" />
                  )}
                  {lucroNegativo ? 'Prejuízo' : 'Seu lucro'}
                </span>
                <span className={`font-semibold ${lucroNegativo ? 'text-red-200' : ''}`}>
                  {formatarMoeda(lucroReais)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          {modoEmbutido ? (
            <button
              type="button"
              onClick={handleAplicarPreco}
              disabled={!podeSalvar}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-5 text-xl font-bold text-white shadow-lg transition-all duration-200 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={26} aria-hidden="true" />
              Usar este Preço
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={!podeSalvar}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-5 text-xl font-bold text-white shadow-lg transition-all duration-200 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={26} aria-hidden="true" />
                {salvando ? 'Salvando...' : 'Salvar Produto'}
              </button>

              {mensagemSalvar && (
                <p
                  className={`mt-3 text-center text-lg font-semibold ${
                    mensagemSalvar.tipo === 'sucesso' ? 'text-emerald-100' : 'text-red-100'
                  }`}
                >
                  {mensagemSalvar.texto}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
