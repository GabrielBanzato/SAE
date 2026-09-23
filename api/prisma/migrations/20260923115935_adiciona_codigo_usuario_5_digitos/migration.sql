-- Passo 1/2 (EXPAND) do rollout seguro de `Usuario.codigoUsuario` - so
-- adiciona a coluna NULLABLE, sem NOT NULL/UNIQUE ainda. Seguro pra rodar
-- contra uma tabela `usuarios` com linhas existentes (um ADD COLUMN
-- nullable nunca falha por causa de dado ja presente).
--
-- APOS aplicar esta migration em producao, ANTES de aplicar a proxima
-- (`*_codigo_usuario_not_null_unique`), rode o script de backfill:
--
--   node api/scripts/backfillCodigoUsuario.js
--
-- (precisa de DATABASE_URL apontando pro banco certo - mesma variavel que
-- a API usa. Ver o cabecalho do proprio script e NOTAS_IMPORTANTES.md pro
-- passo a passo completo.) So depois do backfill confirmar 0 linhas com
-- `codigo_usuario` NULL e que a proxima migration deve ser aplicada -
-- ela e o passo 2/2 (CONTRACT), que exige NOT NULL + UNIQUE.

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `codigo_usuario` VARCHAR(5) NULL;
