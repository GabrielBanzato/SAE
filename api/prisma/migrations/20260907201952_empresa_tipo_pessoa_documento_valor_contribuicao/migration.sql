-- Adiciona tipo_pessoa, valor_contribuicao e renomeia cnpj -> documento na
-- tabela empresas. Escrita manualmente (em vez de gerada por `prisma migrate
-- dev`) porque a tabela ja tinha linhas reais e o Prisma CLI recusa criar
-- automaticamente uma coluna obrigatoria sem default numa tabela nao-vazia
-- em modo nao-interativo - aqui fazemos o backfill explicitamente, sem
-- perder o CNPJ ja cadastrado (ele migra para `documento` com
-- tipo_pessoa = 'PJ', ja que a coluna antiga so aceitava CNPJ).

-- AlterTable: novas colunas, "documento" comeca nullable pra podermos
-- copiar o valor de "cnpj" antes de torna-la obrigatoria.
ALTER TABLE `empresas`
  ADD COLUMN `tipo_pessoa` ENUM('PF', 'PJ') NOT NULL DEFAULT 'PJ',
  ADD COLUMN `documento` VARCHAR(14) NULL,
  ADD COLUMN `valor_contribuicao` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Backfill: toda linha existente so podia ter cadastrado um CNPJ (tabela
-- antiga nao suportava CPF), entao tipo_pessoa='PJ' (default acima) esta
-- correto para elas.
UPDATE `empresas` SET `documento` = `cnpj` WHERE `documento` IS NULL;

-- Agora que todo mundo tem `documento` preenchido, torna obrigatoria e
-- substitui o indice/coluna antigos.
ALTER TABLE `empresas`
  MODIFY `documento` VARCHAR(14) NOT NULL;

ALTER TABLE `empresas` DROP INDEX `empresas_cnpj_key`;
ALTER TABLE `empresas` DROP COLUMN `cnpj`;
ALTER TABLE `empresas` ADD UNIQUE INDEX `empresas_documento_key`(`documento`);
