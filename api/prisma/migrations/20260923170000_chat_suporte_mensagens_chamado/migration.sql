-- Chat de Suporte (2026-09-23): chamado deixa de ser formulario estatico e
-- vira conversa bidirecional (lojista <-> Supra Admin), com texto e audio.
--
-- 100% ADITIVA - segura com `chamados_suporte` ja tendo linhas reais em
-- producao, sem passo de backfill:
--   * `chamados_suporte.atualizado_em` nasce NOT NULL com DEFAULT
--     CURRENT_TIMESTAMP(3) - linhas existentes recebem o horario da propria
--     migration (nao ha como saber a "ultima alteracao" real delas).
--   * `mensagens_chamado` e tabela nova (1 chamado : N mensagens), cascade
--     com o chamado.
-- Pode ir direto com `npx prisma migrate deploy` (backup antes, como sempre).
-- Gerada via `prisma migrate diff --from-migrations ... --to-schema-datamodel`
-- (nao `migrate dev`, que exigia reset do banco local por checksum alterado
-- da migration 20260922222219 - ver NOTAS_IMPORTANTES.md).

-- AlterTable
ALTER TABLE `chamados_suporte` ADD COLUMN `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `mensagens_chamado` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `chamado_id` INTEGER UNSIGNED NOT NULL,
    `remetente` ENUM('LOJISTA', 'ADMIN') NOT NULL,
    `tipo_mensagem` ENUM('TEXTO', 'AUDIO') NOT NULL DEFAULT 'TEXTO',
    `conteudo` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_mensagens_chamado_chamado_criado`(`chamado_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mensagens_chamado` ADD CONSTRAINT `mensagens_chamado_chamado_id_fkey` FOREIGN KEY (`chamado_id`) REFERENCES `chamados_suporte`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
