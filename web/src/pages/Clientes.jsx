import { useEffect, useState } from 'react';
import { Users, Plus, Phone, Mail } from 'lucide-react';
import { apiFetch } from '../services/api';
import ModalClienteRapido from '../components/clientes/ModalClienteRapido';

// `dataCadastro` e um timestamp de verdade (`@default(now())` no Prisma,
// nao uma data escolhida em formulario) - ao contrario de dataVencimento/
// dataPagamento (ver web/src/utils/datas.js), a conversao local padrao
// (`new Date(iso).toLocaleDateString()`) ja e a correta aqui, sem o
// truque de reler os componentes UTC (que so se aplica a datas "so
// calendario" gravadas como meia-noite UTC).
function formatarData(valor) {
  return new Date(valor).toLocaleDateString('pt-BR');
}

/**
 * Tabela de contato: telefone em cima, e-mail embaixo (ou so um dos dois,
 * ou um travessao se o cliente nao tiver nenhum contato cadastrado - os 2
 * campos sao opcionais desde o cadastro rapido do PDV).
 */
function Contato({ telefone, email }) {
  if (!telefone && !email) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  return (
    <div className="space-y-1">
      {telefone && (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <Phone size={14} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          {telefone}
        </div>
      )}
      {email && (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <Mail size={14} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          {email}
        </div>
      )}
    </div>
  );
}

/**
 * Tela de Clientes: tabela consumindo GET /clientes (rota que ja existia,
 * usada ate agora so pelo dropdown do PDV). "Novo Cliente" reaproveita o
 * mesmo ModalClienteRapido do PDV, ja movido pra `components/clientes/`
 * pra ficar num lugar compartilhado entre as duas telas.
 *
 * "Total Comprado" fica como coluna fixa em "Em breve" - a API ainda nao
 * tem um jeito de agregar o historico de vendas por cliente (Venda.total
 * existe, mas nao ha endpoint de soma por cliente ainda). A coluna ja
 * existe no layout pra nao precisar redesenhar a tabela quando esse dado
 * real chegar, seguindo o mesmo padrao de "em breve" ja usado noutras
 * telas do app (Configuracoes, por exemplo) em vez de inventar um numero
 * (ex.: R$ 0,00, que pareceria um dado real e errado).
 */
export default function Clientes() {
  const [clientes, setClientes] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');

    apiFetch('/clientes')
      .then((dados) => {
        if (ativo) setClientes(dados);
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Não foi possível carregar os clientes.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  async function cadastrarCliente(dados) {
    const cliente = await apiFetch('/clientes', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
    setClientes((atual) => [...(atual || []), cliente].sort((a, b) => a.nome.localeCompare(b.nome)));
    setModalAberto(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
            <Users size={28} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Clientes
          </h1>
          <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
            Cadastro e histórico de clientes da loja.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          <Plus size={22} aria-hidden="true" />
          Novo Cliente
        </button>
      </div>

      {erro && (
        <p className="rounded-2xl bg-red-50 p-4 text-lg font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Nome
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Contato
                </th>
                <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Data de Cadastro
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total Comprado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {carregando && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-lg text-slate-500 dark:text-slate-400">
                    Carregando clientes...
                  </td>
                </tr>
              )}

              {!carregando && clientes?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum cliente cadastrado ainda.
                    </p>
                    <p className="mt-1 text-base text-slate-400 dark:text-slate-500">
                      Clique em "Novo Cliente" para começar.
                    </p>
                  </td>
                </tr>
              )}

              {!carregando &&
                clientes?.map((cliente) => (
                  <tr key={cliente.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30">
                    <td className="px-6 py-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {cliente.nome}
                    </td>
                    <td className="px-6 py-4">
                      <Contato telefone={cliente.telefone} email={cliente.email} />
                    </td>
                    <td className="px-6 py-4 text-base text-slate-600 dark:text-slate-300">
                      {formatarData(cliente.dataCadastro)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className="text-sm font-medium text-slate-400 dark:text-slate-500"
                        title="Em breve: histórico de vendas por cliente"
                      >
                        Em breve
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <ModalClienteRapido onFechar={() => setModalAberto(false)} onSalvar={cadastrarCliente} />
      )}
    </div>
  );
}
