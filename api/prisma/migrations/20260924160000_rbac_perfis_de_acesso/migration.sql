-- RBAC - Perfis de Acesso (2026-09-24): tabela `perfis` (cargo com um array
-- JSON de permissoes, por empresa) + `usuarios.perfil_id` (nullable).
--
-- 100% ADITIVA - segura com dados reais em producao, sem backfill:
--   * usuarios existentes ficam com perfil_id NULL = comportamento de hoje
--     (admin: acesso total; nao-admin sem perfil: acesso total legado - ver
--     comentario de Usuario.perfilId em schema.prisma).
--   * FK usuarios.perfil_id com ON DELETE RESTRICT de proposito (apagar um
--     perfil em uso NAO pode zerar o campo - o usuario ganharia acesso total).
-- Aplicar com `npx prisma migrate deploy` (backup antes, como sempre).
-- Gerada via `prisma migrate diff --from-migrations` (ver dossie 2.10).
-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `perfil_id` INTEGER UNSIGNED NULL;

-- CreateTable
CREATE TABLE `perfis` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `nome` VARCHAR(60) NOT NULL,
    `permissoes` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_perfis_empresa_id`(`empresa_id`),
    UNIQUE INDEX `uq_perfis_empresa_nome`(`empresa_id`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_usuarios_perfil_id` ON `usuarios`(`perfil_id`);

-- AddForeignKey
ALTER TABLE `perfis` ADD CONSTRAINT `perfis_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_perfil_id_fkey` FOREIGN KEY (`perfil_id`) REFERENCES `perfis`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

