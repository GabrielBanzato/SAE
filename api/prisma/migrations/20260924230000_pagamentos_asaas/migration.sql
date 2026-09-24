-- Pagamentos reais via Asaas (2026-09-24): `empresas.asaas_customer_id`,
-- tabela `assinaturas_modulo` (1 assinatura recorrente por empresa+modulo)
-- e `webhook_eventos_asaas` (idempotencia dos webhooks).
--
-- 100% ADITIVA, sem backfill: modulos ja pagos pelo checkout simulado
-- continuam liberados (quem libera e `empresas.pagamentos_ativos`, que
-- esta migration nao toca). Aplicar com `npx prisma migrate deploy`.
-- AlterTable
ALTER TABLE `empresas` ADD COLUMN `asaas_customer_id` VARCHAR(40) NULL;

-- CreateTable
CREATE TABLE `assinaturas_modulo` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `modulo` VARCHAR(30) NOT NULL,
    `plano_ia` VARCHAR(30) NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `forma_pagamento` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    `asaas_subscription_id` VARCHAR(40) NOT NULL,
    `asaas_payment_id` VARCHAR(40) NULL,
    `invoice_url` VARCHAR(255) NULL,
    `pago_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_assinaturas_asaas_subscription`(`asaas_subscription_id`),
    INDEX `idx_assinaturas_asaas_payment`(`asaas_payment_id`),
    UNIQUE INDEX `uq_assinaturas_empresa_modulo`(`empresa_id`, `modulo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_eventos_asaas` (
    `id` VARCHAR(120) NOT NULL,
    `evento` VARCHAR(60) NOT NULL,
    `payment_id` VARCHAR(40) NULL,
    `recebido_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `uq_empresas_asaas_customer` ON `empresas`(`asaas_customer_id`);

-- AddForeignKey
ALTER TABLE `assinaturas_modulo` ADD CONSTRAINT `assinaturas_modulo_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

