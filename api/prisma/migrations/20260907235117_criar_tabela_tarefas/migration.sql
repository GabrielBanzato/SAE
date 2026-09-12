-- CreateTable
CREATE TABLE `tarefas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `titulo` VARCHAR(150) NOT NULL,
    `descricao` VARCHAR(500) NULL,
    `data_vencimento` DATETIME(3) NOT NULL,
    `tipo` ENUM('pagamento', 'recebimento', 'venda', 'lembrete') NOT NULL,
    `status_concluida` BOOLEAN NOT NULL DEFAULT false,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_tarefas_empresa_id`(`empresa_id`),
    INDEX `idx_tarefas_empresa_data`(`empresa_id`, `data_vencimento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
