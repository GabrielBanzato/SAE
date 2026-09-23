-- ============================================================================
-- MIGRATION DE ALCANCE (catch-up), gerada em 2026-09-22.
--
-- Captura TUDO que schema.prisma ganhou desde a ultima migration real
-- (20260908004951_produto_sob_demanda_cliente_venda) e que, ate hoje, so
-- tinha sido aplicado ao banco local via `prisma db push` - nunca virou uma
-- migration de verdade, entao `prisma migrate deploy` em producao sempre
-- reportava "nada pendente" mesmo com o schema tendo evoluido muito
-- (segmento obrigatorio, modulosAtivos/pagamentosAtivos/isDoador,
-- nivelAcesso, Tarefa.status, venda multi-item via VendaItem, Atendimento/
-- Mensagem, ChamadoSuporte, ConfiguracaoGlobal). Ver NOTAS_IMPORTANTES.md e
-- dossie-infraestrutura.md, entrada de 2026-09-22, para o achado completo.
--
-- ⚠️ NAO rode isto direto contra um banco de PRODUCAO com dados reais sem
-- ler os 2 avisos abaixo primeiro. Contra o banco LOCAL de desenvolvimento
-- (sempre vazio nas tabelas afetadas, conferido antes de gerar este
-- arquivo) isto e seguro.
--
-- 1) `tarefas.status_concluida` (Boolean) e DROPADA e substituida por
--    `tarefas.status` (String, default 'A_FAZER' pra TODA LINHA, inclusive
--    as que ja estavam concluidas). Se producao tiver tarefas reais, rode
--    ANTES de aplicar esta migration (com a coluna antiga ainda presente):
--
--      ALTER TABLE tarefas ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'A_FAZER';
--      UPDATE tarefas SET status = IF(status_concluida, 'CONCLUIDO', 'A_FAZER');
--      ALTER TABLE tarefas DROP COLUMN status_concluida;
--
--    (mesma orientacao ja registrada em dossie-infraestrutura.md, secao 2.5)
--
-- 2) `vendas.produto_id`/`quantidade`/`preco_unitario` sao DROPADAS - viraram
--    a tabela `venda_itens` (1 venda pode ter varios produtos agora). Este
--    script NAO faz backfill: se producao tiver vendas reais com esses
--    campos preenchidos, o historico de itens vendidos seria perdido
--    silenciosamente. Antes de aplicar em producao, rode um backfill tipo:
--
--      INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
--      SELECT id, produto_id, quantidade, preco_unitario, quantidade * preco_unitario
--      FROM vendas WHERE produto_id IS NOT NULL;
--
--    (rodar ANTES do `DROP COLUMN` abaixo - ajustar nomes/tipos se o schema
--    real de producao divergir do que este script assume)
--
-- Faca backup do banco (`mysqldump`) antes de rodar isto em qualquer
-- ambiente com dados que importam.
-- ============================================================================

-- DropForeignKey
ALTER TABLE `vendas` DROP FOREIGN KEY `vendas_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `vendas` DROP FOREIGN KEY `vendas_produto_id_fkey`;

-- DropIndex
DROP INDEX `idx_vendas_empresa_produto` ON `vendas`;

-- DropIndex
DROP INDEX `vendas_produto_id_fkey` ON `vendas`;

-- AlterTable
ALTER TABLE `clientes` ADD COLUMN `status_crm` VARCHAR(20) NOT NULL DEFAULT 'Lead';

-- AlterTable
ALTER TABLE `empresas` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `is_doador` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `modulos_ativos` JSON NULL,
    ADD COLUMN `nome_loja` VARCHAR(150) NULL,
    ADD COLUMN `pagamentos_ativos` JSON NULL,
    ADD COLUMN `segmento` VARCHAR(30) NOT NULL;

-- AlterTable (ver aviso 1 no topo deste arquivo antes de rodar em producao)
ALTER TABLE `tarefas` DROP COLUMN `status_concluida`,
    ADD COLUMN `responsavel_id` INTEGER UNSIGNED NULL,
    ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'A_FAZER',
    MODIFY `data_vencimento` DATETIME(3) NULL,
    MODIFY `tipo` ENUM('pagamento', 'recebimento', 'venda', 'lembrete') NOT NULL DEFAULT 'lembrete';

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `nivel_acesso` VARCHAR(20) NOT NULL DEFAULT 'LOJISTA';

-- AlterTable (ver aviso 2 no topo deste arquivo antes de rodar em producao)
ALTER TABLE `vendas` DROP COLUMN `preco_unitario`,
    DROP COLUMN `produto_id`,
    DROP COLUMN `quantidade`,
    ADD COLUMN `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `data_pagamento` DATETIME(3) NULL,
    ADD COLUMN `forma_pagamento` ENUM('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'pendente', 'consumo_interno', 'doacao') NOT NULL DEFAULT 'dinheiro',
    ADD COLUMN `funcionario_id` INTEGER UNSIGNED NULL;

-- CreateTable
CREATE TABLE `venda_itens` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `venda_id` INTEGER UNSIGNED NOT NULL,
    `produto_id` INTEGER UNSIGNED NOT NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 1,
    `preco_unitario` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    INDEX `idx_venda_itens_venda_id`(`venda_id`),
    INDEX `idx_venda_itens_produto_id`(`produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lancamentos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `descricao` VARCHAR(200) NOT NULL,
    `valor` DECIMAL(12, 2) NOT NULL,
    `tipo` ENUM('ENTRADA', 'SAIDA') NOT NULL,
    `data_vencimento` DATETIME(3) NOT NULL,
    `data_pagamento` DATETIME(3) NULL,
    `status` ENUM('PENDENTE', 'PAGO') NOT NULL DEFAULT 'PENDENTE',
    `categoria` VARCHAR(30) NOT NULL DEFAULT 'outros',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_lancamentos_empresa_id`(`empresa_id`),
    INDEX `idx_lancamentos_empresa_vencimento`(`empresa_id`, `data_vencimento`),
    INDEX `idx_lancamentos_empresa_status`(`empresa_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredientes` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `unidade_medida` VARCHAR(10) NOT NULL,
    `custo_unitario` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `estoque_atual` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ingredientes_empresa_id`(`empresa_id`),
    INDEX `idx_ingredientes_empresa_nome`(`empresa_id`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `atendimentos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `cliente_id` INTEGER UNSIGNED NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'ABERTO',
    `ia_ativa` BOOLEAN NOT NULL DEFAULT true,
    `data_criacao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_atendimentos_empresa_id`(`empresa_id`),
    INDEX `idx_atendimentos_empresa_cliente_status`(`empresa_id`, `cliente_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `atendimento_id` INTEGER UNSIGNED NOT NULL,
    `remetente` VARCHAR(10) NOT NULL,
    `conteudo` TEXT NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_mensagens_atendimento_timestamp`(`atendimento_id`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ficha_tecnica` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `produto_id` INTEGER UNSIGNED NOT NULL,
    `ingrediente_id` INTEGER UNSIGNED NOT NULL,
    `quantidade_usada` DECIMAL(12, 3) NOT NULL,

    INDEX `idx_ficha_tecnica_produto_id`(`produto_id`),
    INDEX `idx_ficha_tecnica_ingrediente_id`(`ingrediente_id`),
    UNIQUE INDEX `uq_ficha_tecnica_produto_ingrediente`(`produto_id`, `ingrediente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chamados_suporte` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER UNSIGNED NOT NULL,
    `titulo` VARCHAR(150) NOT NULL,
    `descricao` VARCHAR(1000) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ABERTO',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_chamados_suporte_empresa_id`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracoes_globais` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `precos_modulos` JSON NOT NULL,
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_tarefas_empresa_status` ON `tarefas`(`empresa_id`, `status`);

-- CreateIndex
CREATE INDEX `idx_tarefas_empresa_responsavel` ON `tarefas`(`empresa_id`, `responsavel_id`);

-- CreateIndex
CREATE INDEX `idx_vendas_funcionario_id` ON `vendas`(`funcionario_id`);

-- AddForeignKey (re-adicionada apos o DROP FOREIGN KEY do topo deste arquivo -
-- faltava recriar esta, achado em 2026-09-23 via "prisma migrate dev" detectando
-- drift entre esta migration e o banco local real, que sempre teve a FK; ver
-- NOTAS_IMPORTANTES.md)
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_funcionario_id_fkey` FOREIGN KEY (`funcionario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venda_itens` ADD CONSTRAINT `venda_itens_venda_id_fkey` FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venda_itens` ADD CONSTRAINT `venda_itens_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_responsavel_id_fkey` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingredientes` ADD CONSTRAINT `ingredientes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atendimentos` ADD CONSTRAINT `atendimentos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atendimentos` ADD CONSTRAINT `atendimentos_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens` ADD CONSTRAINT `mensagens_atendimento_id_fkey` FOREIGN KEY (`atendimento_id`) REFERENCES `atendimentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ficha_tecnica` ADD CONSTRAINT `ficha_tecnica_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ficha_tecnica` ADD CONSTRAINT `ficha_tecnica_ingrediente_id_fkey` FOREIGN KEY (`ingrediente_id`) REFERENCES `ingredientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chamados_suporte` ADD CONSTRAINT `chamados_suporte_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
