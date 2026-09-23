-- Passo 3/3 (CONTRACT) do rollout seguro de `Usuario.codigoUsuario`.
--
-- ⚠️ SO aplique esta migration DEPOIS de confirmar que
-- `node api/scripts/backfillCodigoUsuario.js` terminou com "0 usuarios sem
-- codigo_usuario" (passo 2/3). Se sobrar alguma linha com `codigo_usuario`
-- NULL, o `MODIFY COLUMN ... NOT NULL` abaixo falha (comportamento
-- esperado - falha alta e clara, nao corrompe nada).

-- AlterTable
ALTER TABLE `usuarios` MODIFY COLUMN `codigo_usuario` VARCHAR(5) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `uq_usuarios_codigo_usuario` ON `usuarios`(`codigo_usuario`);
