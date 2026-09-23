const AppError = require('../utils/AppError');

/**
 * Precos padrao (usados so pra semear a linha singleton na primeira
 * leitura, ver `obterPrecos` abaixo) - mesmos valores que ja estavam fixos
 * em Modulos.jsx antes desta tarefa. Chaves batem com `MODULOS_PAGOS`
 * (empresa.service.js) e `PLANOS_IA_WHATSAPP` (Modulos.jsx).
 */
const PRECOS_PADRAO = {
  pdv_touch: 5.9,
  clientes: 3.9,
  tarefas: 3.9,
  notas_fiscais: 9.9,
  ia_whatsapp: { whatsapp_web: 39.9, meta_api: 69.9 },
};

const CHAVES_SIMPLES = ['pdv_touch', 'clientes', 'tarefas', 'notas_fiscais'];
const CHAVES_IA_WHATSAPP = ['whatsapp_web', 'meta_api'];

/**
 * `ConfiguracaoGlobal` e uma tabela singleton (sempre no maximo 1 linha) -
 * `findFirst` (nao um id fixo assumido) acha essa linha se existir, e cria
 * com os padroes na primeira leitura se ainda nao existir (nenhum seed
 * manual necessario). Mesclado com `PRECOS_PADRAO` defensivamente - se a
 * linha existir mas faltar alguma chave nova (ex.: um modulo pago
 * adicionado depois desta tarefa, sem `atualizarPrecos` ter rodado ainda
 * pra ele), Modulos.jsx nunca recebe um preco `undefined`.
 */
async function obterPrecos(prisma) {
  let config = await prisma.configuracaoGlobal.findFirst();
  if (!config) {
    config = await prisma.configuracaoGlobal.create({ data: { precosModulos: PRECOS_PADRAO } });
  }

  const precos = config.precosModulos || {};
  return {
    ...PRECOS_PADRAO,
    ...precos,
    ia_whatsapp: { ...PRECOS_PADRAO.ia_whatsapp, ...(precos.ia_whatsapp || {}) },
  };
}

function validarPreco(valor, nomeCampo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    throw new AppError(`${nomeCampo} deve ser um numero maior ou igual a 0.`, 422);
  }
}

/**
 * "Configurações Globais" (SupraAdmin.jsx) - atualizacao parcial (so as
 * chaves presentes no body sao alteradas, mesmo padrao de
 * empresa.service.js#atualizarDados), mesclada em cima do valor atual (nao
 * substitui o objeto inteiro) pra editar so o preco de 1 modulo nao apagar
 * os demais.
 */
async function atualizarPrecos(prisma, novosPrecos) {
  if (typeof novosPrecos !== 'object' || novosPrecos === null || Array.isArray(novosPrecos)) {
    throw new AppError('Corpo da requisicao deve ser um objeto de precos.', 422);
  }

  for (const chave of CHAVES_SIMPLES) {
    if (novosPrecos[chave] !== undefined) validarPreco(novosPrecos[chave], chave);
  }
  if (novosPrecos.ia_whatsapp !== undefined) {
    for (const chave of CHAVES_IA_WHATSAPP) {
      if (novosPrecos.ia_whatsapp[chave] !== undefined) {
        validarPreco(novosPrecos.ia_whatsapp[chave], `ia_whatsapp.${chave}`);
      }
    }
  }

  const atual = await obterPrecos(prisma);
  const mesclado = {
    ...atual,
    ...novosPrecos,
    ia_whatsapp: { ...atual.ia_whatsapp, ...(novosPrecos.ia_whatsapp || {}) },
  };

  let config = await prisma.configuracaoGlobal.findFirst({ select: { id: true } });
  if (!config) {
    config = await prisma.configuracaoGlobal.create({ data: { precosModulos: mesclado } });
  } else {
    config = await prisma.configuracaoGlobal.update({ where: { id: config.id }, data: { precosModulos: mesclado } });
  }

  return mesclado;
}

module.exports = { obterPrecos, atualizarPrecos, PRECOS_PADRAO };
