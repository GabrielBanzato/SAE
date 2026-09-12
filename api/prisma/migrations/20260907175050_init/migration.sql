-- CreateTable
CREATE TABLE `empresas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `razao_social` VARCHAR(150) NOT NULL,
    `cnpj` CHAR(14) NOT NULL,
    `endereco` VARCHAR(255) NULL,
    `telefone` VARCHAR(20) NULL,
    `plano_ativo` ENUM('gratuito', 'apoiador') NOT NULL DEFAULT 'gratuito',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `empresas_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `senha_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'gerente', 'vendedor') NOT NULL DEFAULT 'vendedor',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_usuarios_empresa_id`(`empresa_id`),
    UNIQUE INDEX `uq_usuarios_empresa_email`(`empresa_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produtos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `custo` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `preco_venda` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `estoque_atual` INTEGER NOT NULL DEFAULT 0,
    `estoque_minimo` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_produtos_empresa_id`(`empresa_id`),
    INDEX `idx_produtos_empresa_nome`(`empresa_id`, `nome`),
    INDEX `idx_produtos_empresa_estoque`(`empresa_id`, `estoque_atual`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `usuario_id` INTEGER UNSIGNED NOT NULL,
    `produto_id` INTEGER UNSIGNED NOT NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 1,
    `preco_unitario` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_vendas_empresa_id`(`empresa_id`),
    INDEX `idx_vendas_empresa_data`(`empresa_id`, `data`),
    INDEX `idx_vendas_usuario_id`(`usuario_id`),
    INDEX `idx_vendas_empresa_produto`(`empresa_id`, `produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produtos` ADD CONSTRAINT `produtos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
