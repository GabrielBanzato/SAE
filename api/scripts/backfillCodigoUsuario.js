/**
 * Passo 2/3 do rollout seguro de `Usuario.codigoUsuario` (2026-09-23) -
 * preenche o codigo de 5 digitos de todo usuario que ainda nao tem um
 * (`codigo_usuario IS NULL`) - o caso de toda linha que ja existia ANTES
 * desta coluna nascer. Usa o MESMO gerador que `register()`/
 * `adicionarUsuario()` usam pra usuario novo (`gerarCodigoUsuario`, em
 * `auth.service.js`) - nao uma logica separada so pro backfill, pra nao
 * arriscar os dois divergirem (ex.: um formato de codigo diferente).
 *
 * Quando rodar: DEPOIS da migration `*_adiciona_codigo_usuario_5_digitos`
 * (passo 1/3, so adiciona a coluna NULLABLE) e ANTES da migration
 * `*_codigo_usuario_not_null_unique` (passo 3/3, aplica NOT NULL + UNIQUE
 * - falha se sobrar alguma linha NULL). Ver NOTAS_IMPORTANTES.md pro passo
 * a passo completo de producao.
 *
 * Idempotente: rodar de novo depois de completo nao faz nada (a query so
 * pega `codigo_usuario IS NULL`, e toda linha ja preenchida fica de fora).
 * Processa uma linha de cada vez (nao em lote/transacao unica) de proposito
 * - com potencialmente milhares de usuarios, e melhor um script que pode
 * ser interrompido e retomado (idempotente, ver acima) do que uma
 * transacao gigante travando a tabela inteira por muito tempo.
 *
 * `$queryRaw`/`$executeRaw` (nao `prisma.usuario.findMany`/`count`) pra
 * filtrar por `codigo_usuario IS NULL` - achado rodando este script pela
 * primeira vez: o Prisma Client, gerado a partir do `schema.prisma` ATUAL
 * (onde `codigoUsuario` ja e obrigatorio), recusa em runtime um filtro
 * `where: { codigoUsuario: null }` - `PrismaClientValidationError:
 * Argument codigoUsuario must not be null` - mesmo a COLUNA FISICA ainda
 * sendo nullable neste passo intermediario da migracao (o client so
 * conhece o schema final, nao o estado transitorio do banco). Raw SQL
 * ignora essa validacao de tipo, entao funciona nos dois passos.
 * `id` volta como BigInt de `$queryRaw` (coluna `INT UNSIGNED`, mesma
 * pegadinha ja documentada em dashboard.service.js/dossie-infraestrutura.md)
 * - convertido com `Number(...)` antes de usar em qualquer outro lugar.
 */
const { PrismaClient } = require('@prisma/client');
const { gerarCodigoUsuario } = require('../src/services/auth.service');

const prisma = new PrismaClient();

async function main() {
  const linhas = await prisma.$queryRaw`SELECT id, nome, email FROM usuarios WHERE codigo_usuario IS NULL`;
  const usuariosSemCodigo = linhas.map((linha) => ({ id: Number(linha.id), nome: linha.nome, email: linha.email }));

  if (usuariosSemCodigo.length === 0) {
    console.log('Nenhum usuario sem codigo_usuario - nada para fazer. Pode aplicar a proxima migration com seguranca.');
    return;
  }

  console.log(`Encontrados ${usuariosSemCodigo.length} usuario(s) sem codigo_usuario. Preenchendo...`);

  let feitos = 0;
  for (const usuario of usuariosSemCodigo) {
    const codigo = await gerarCodigoUsuario(prisma);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { codigoUsuario: codigo } });
    feitos += 1;
    console.log(`  [${feitos}/${usuariosSemCodigo.length}] usuario #${usuario.id} (${usuario.email}) -> ${codigo}`);
  }

  const [{ restantes }] = await prisma.$queryRaw`SELECT COUNT(*) AS restantes FROM usuarios WHERE codigo_usuario IS NULL`;
  if (Number(restantes) > 0) {
    // Nao deveria acontecer (nenhuma escrita concorrente esperada durante
    // uma janela de manutencao) - mas se acontecer, o proximo passo (NOT
    // NULL) vai falhar de qualquer forma, entao avisa aqui em vez de deixar
    // a mensagem de erro do MySQL ser a primeira pista.
    console.warn(
      `⚠️  Ainda sobraram ${restantes} usuario(s) sem codigo_usuario (provavelmente criados DURANTE este backfill) - rode este script de novo antes da proxima migration.`
    );
  } else {
    console.log('Backfill concluido - 0 usuarios sem codigo_usuario. Pode aplicar a proxima migration com seguranca.');
  }
}

main()
  .catch((err) => {
    console.error('Backfill falhou:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
