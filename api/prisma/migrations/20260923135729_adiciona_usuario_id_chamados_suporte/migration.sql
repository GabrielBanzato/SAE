-- Ajuste no Formulario de Suporte (2026-09-23): rastreia QUEM abriu cada
-- chamado. `usuario_id` NULLABLE - segura mesmo com `chamados_suporte` ja
-- tendo linhas reais em producao (chamados antigos ficam com `NULL`, nao
-- um usuario "desconhecido" fabricado so pra preencher). Sem passo de
-- backfill necessario (diferente de `usuarios.codigo_usuario`, que exigiu
-- NOT NULL) - pode ser aplicada direto com `prisma migrate deploy`.

-- AlterTable
ALTER TABLE `chamados_suporte` ADD COLUMN `usuario_id` INTEGER UNSIGNED NULL;

-- CreateIndex
CREATE INDEX `idx_chamados_suporte_usuario_id` ON `chamados_suporte`(`usuario_id`);

-- AddForeignKey
ALTER TABLE `chamados_suporte` ADD CONSTRAINT `chamados_suporte_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
