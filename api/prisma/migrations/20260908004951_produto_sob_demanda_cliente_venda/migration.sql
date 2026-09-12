-- AlterTable
ALTER TABLE `produtos` ADD COLUMN `sob_demanda` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `vendas` ADD COLUMN `cliente_id` INTEGER UNSIGNED NULL;

-- CreateTable
CREATE TABLE `clientes` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `telefone` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `data_cadastro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_clientes_empresa_id`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_vendas_cliente_id` ON `vendas`(`cliente_id`);

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
