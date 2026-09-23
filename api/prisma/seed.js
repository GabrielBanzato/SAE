const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const empresa = await prisma.empresa.upsert({
    where: { documento: '12345678000199' },
    update: {},
    create: {
      razaoSocial: 'Padaria Teste LTDA',
      tipoPessoa: 'PJ',
      documento: '12345678000199',
      endereco: 'Rua das Flores, 123 - Centro, Sao Paulo - SP',
      telefone: '11987654321',
      plano: 'gratuito',
      // `segmento` e obrigatorio desde esta tarefa (schema.prisma nao tem
      // mais @default) - "Padaria Teste" e o cenario canonico de
      // varejo_alimentacao (ver MAPA_MODULOS em auth.service.js).
      segmento: 'varejo_alimentacao',
    },
  });

  const senhaHash = await bcrypt.hash('senha123', 10);

  await prisma.usuario.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'admin@teste.com' } },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Admin Teste',
      email: 'admin@teste.com',
      senhaHash,
      role: 'admin',
      // Codigo de 5 digitos fixo pro seed (nao precisa do gerador aleatorio
      // com checagem de unicidade que os services usam - o seed roda contra
      // um banco vazio/conhecido, sem risco de colisao).
      codigoUsuario: '00001',
    },
  });

  await prisma.usuario.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'vendedor@teste.com' } },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Vendedor Teste',
      email: 'vendedor@teste.com',
      senhaHash,
      role: 'vendedor',
      codigoUsuario: '00002',
    },
  });

  await prisma.produto.upsert({
    where: { id: 1 },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Pao Frances',
      custo: 0.3,
      precoVenda: 0.75,
      estoqueAtual: 100,
      estoqueMinimo: 20,
    },
  });

  await prisma.produto.upsert({
    where: { id: 2 },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Bolo de Chocolate',
      custo: 8.0,
      precoVenda: 15.0,
      estoqueAtual: 5,
      estoqueMinimo: 5,
    },
  });

  console.log('Seed concluido: empresa, usuario admin e 2 produtos de teste criados.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
