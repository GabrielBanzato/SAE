-- Pendencias do RBAC (2026-09-24): `usuarios.ativo` (remover da equipe =
-- desativar, preservando historico - toda FK pra usuarios e RESTRICT) e
-- `usuarios.deve_trocar_senha` (senha temporaria de convite/redefinicao
-- obriga a troca no 1o login).
--
-- 100% ADITIVA, sem backfill: todo usuario existente nasce ativo = 1 e
-- deve_trocar_senha = 0 (comportamento de hoje, ninguem e forcado a nada).
-- Aplicar com `npx prisma migrate deploy` (backup antes).
-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `deve_trocar_senha` BOOLEAN NOT NULL DEFAULT false;

