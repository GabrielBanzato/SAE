-- Cancelamento de assinatura pelo lojista (2026-09-24): data do cancelamento
-- em `assinaturas_modulo` (auditoria). Aditiva, nullable, sem backfill.

-- AlterTable
ALTER TABLE `assinaturas_modulo` ADD COLUMN `cancelado_em` DATETIME(3) NULL;

