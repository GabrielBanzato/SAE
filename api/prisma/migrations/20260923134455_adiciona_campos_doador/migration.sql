-- Painel Master - Etapa 3 (2026-09-23): "ha quanto tempo e doador" +
-- vencimento do ciclo de doacao simulado (ver comentario de
-- Empresa.doadorDesde/doadorProximoVencimento em schema.prisma).
--
-- Ambas colunas NULLABLE, sem NOT NULL - segura mesmo com `empresas` ja
-- tendo linhas reais em producao (ADD COLUMN nullable nunca falha por
-- causa de dado existente, diferente do que aconteceu com
-- `usuarios.codigo_usuario` - ver migration 20260923115935 e o runbook em
-- NOTAS_IMPORTANTES.md). Nao precisa de backfill nem de passo 2/3 - pode
-- ser aplicada direto com `prisma migrate deploy`.

-- AlterTable
ALTER TABLE `empresas` ADD COLUMN `doador_desde` DATETIME(3) NULL,
    ADD COLUMN `doador_proximo_vencimento` DATETIME(3) NULL;
