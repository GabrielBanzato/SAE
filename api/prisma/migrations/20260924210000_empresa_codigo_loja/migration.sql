-- "ID da Loja" (2026-09-24): `empresas.codigo_loja` - codigo de 5 digitos
-- da EMPRESA, mostrado a todos os usuarios dela no Suporte (antes cada um
-- via o proprio `usuarios.codigo_usuario`, pessoal).
--
-- Aditiva + BACKFILL no mesmo arquivo: cada empresa existente recebe o
-- codigo do seu admin FUNDADOR (admin de menor id) - o mesmo numero que o
-- dono ja via como "Seu ID" e que a coluna "ID" do Painel Master ja
-- mostrava (codigoUsuarioAdmin). Nenhum numero conhecido muda.
-- Codigos de usuario sao unicos globalmente, entao o UNIQUE nao colide.
-- Empresa sem nenhum admin fica NULL e ganha um codigo novo na 1a leitura
-- (empresa.service.js#garantirCodigoLoja). Seguro com `migrate deploy`.
-- AlterTable
ALTER TABLE `empresas` ADD COLUMN `codigo_loja` VARCHAR(5) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `uq_empresas_codigo_loja` ON `empresas`(`codigo_loja`);


-- Backfill: codigo do admin fundador de cada empresa.
UPDATE `empresas` e
JOIN (
    SELECT u.`empresa_id`, u.`codigo_usuario`
    FROM `usuarios` u
    JOIN (
        SELECT `empresa_id`, MIN(`id`) AS `id_fundador`
        FROM `usuarios`
        WHERE `role` = 'admin'
        GROUP BY `empresa_id`
    ) f ON f.`id_fundador` = u.`id`
) a ON a.`empresa_id` = e.`id`
SET e.`codigo_loja` = a.`codigo_usuario`
WHERE e.`codigo_loja` IS NULL;
