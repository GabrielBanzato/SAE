const { limitesDoMesCalendario } = require('../utils/datas');

/**
 * Camada de dados da Agenda: unifica Lancamentos (contas a pagar/receber,
 * incluindo as geradas automaticamente por vendas do PDV - ver
 * vendas.service.js) e Tarefas (lembretes manuais) de um mes especifico
 * num unico array de "Eventos", no formato que o frontend (Agenda.jsx) ja
 * espera desde a versao mockada (id/empresaId/titulo/descricao/
 * dataVencimento/tipo/statusConcluida/valor) - so troca a origem do dado,
 * o contrato de resposta nao muda.
 */

/**
 * Saida vira 'pagamento' (vermelho no frontend), Entrada vira
 * 'recebimento' (verde) - mapeamento pedido explicitamente na tarefa.
 * `id` prefixado ("lancamento-"/"tarefa-" abaixo) porque as duas tabelas
 * tem sequencias de auto-increment independentes - sem o prefixo, um
 * Lancamento id=1 e uma Tarefa id=1 colidiriam no array unificado (usado
 * como `key` de lista no React).
 */
function lancamentoParaEvento(lancamento) {
  return {
    id: `lancamento-${lancamento.id}`,
    empresaId: lancamento.empresaId,
    titulo: lancamento.descricao,
    descricao: lancamento.status === 'PAGO' ? 'Lançamento financeiro já pago.' : 'Lançamento financeiro pendente.',
    dataVencimento: lancamento.dataVencimento.toISOString(),
    tipo: lancamento.tipo === 'ENTRADA' ? 'recebimento' : 'pagamento',
    statusConcluida: lancamento.status === 'PAGO',
    valor: lancamento.valor.toNumber(),
  };
}

/**
 * `Tarefa.tipo` (enum TipoTarefa: pagamento/recebimento/venda/lembrete) ja
 * bate 1:1 com as chaves que o frontend espera - nenhuma tradução
 * necessária aqui, diferente do Lancamento acima. `Tarefa` ainda não tem
 * um campo de valor monetário no schema (ver schema.prisma), por isso
 * `valor` sai sempre `null` para esses eventos.
 *
 * `statusConcluida` (Boolean, contrato que Agenda.jsx ja consome) e
 * derivado de `Tarefa.status` (String - A_FAZER/EM_ANDAMENTO/CONCLUIDO,
 * ver tarefas.service.js e o Quadro de Tarefas Kanban) - so `CONCLUIDO`
 * conta como concluida aqui, `EM_ANDAMENTO` ainda aparece como pendente na
 * Agenda (mesma UI de "Dar baixa" ja existente).
 */
function tarefaParaEvento(tarefa) {
  return {
    id: `tarefa-${tarefa.id}`,
    empresaId: tarefa.empresaId,
    titulo: tarefa.titulo,
    descricao: tarefa.descricao ?? '',
    dataVencimento: tarefa.dataVencimento.toISOString(),
    tipo: tarefa.tipo,
    statusConcluida: tarefa.status === 'CONCLUIDO',
    valor: null,
  };
}

async function listarEventosDoMes(prisma, tenantId, ano, mesNumero) {
  const { inicio, fim } = limitesDoMesCalendario(ano, mesNumero);

  const [lancamentos, tarefas] = await Promise.all([
    prisma.lancamento.findMany({
      where: { empresaId: tenantId, dataVencimento: { gte: inicio, lt: fim } },
    }),
    prisma.tarefa.findMany({
      where: { empresaId: tenantId, dataVencimento: { gte: inicio, lt: fim } },
    }),
  ]);

  const eventos = [...lancamentos.map(lancamentoParaEvento), ...tarefas.map(tarefaParaEvento)];

  // As duas queries ja vem ordenadas por chegar de tabelas diferentes -
  // precisa reordenar o array UNIFICADO por data pra garantir a ordem
  // pedida na tarefa (Lancamentos e Tarefas do mesmo dia, por exemplo,
  // sairiam intercalados na ordem errada sem isso).
  eventos.sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));

  return eventos;
}

module.exports = { listarEventosDoMes };
