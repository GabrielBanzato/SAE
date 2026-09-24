# Notas Importantes — Infraestrutura, Deploy e Histórico de Correções Críticas

> Dossiê de operação do SAE: como o sistema roda em produção, pegadinhas já mapeadas e o histórico de incidentes que já custaram tempo de debug. Companheiro de [`direcionamento.md`](direcionamento.md) (que cobre arquitetura/código). Este arquivo é um resumo curado — o histórico bruto, cronológico e completo de todas as tarefas de desenvolvimento está em [`NOTAS_IMPORTANTES.md`](NOTAS_IMPORTANTES.md) (arquivo já existente no repositório, ~5000 linhas, um diário de cada sessão de trabalho).
>
> **Nota sobre o nome deste arquivo**: originalmente publicado como `notas_importantes.md` (minúsculo) — renomeado pra `dossie-infraestrutura.md` depois de uma descoberta importante: este projeto roda num Windows com NTFS, que é *case-insensitive* (não distingue maiúsculas/minúsculas em nomes de arquivo). `notas_importantes.md` e `NOTAS_IMPORTANTES.md` são, na prática, **o mesmo arquivo físico** nesse sistema — não dá pra ter os dois coexistindo como documentos separados aqui, por mais que pareçam nomes diferentes. A primeira tentativa de criar este dossiê com esse nome acabou sobrescrevendo por engano o diário original (`NOTAS_IMPORTANTES.md`); o incidente foi detectado, o original restaurado a partir do último commit do Git (nenhum dado perdido de verdade, já que nunca chegou a ser commitado por cima), e este arquivo recriado com um nome que não colide. Ver a entrada datada 2026-09-18 na seção 2.3 abaixo pra o relato completo desse incidente.

---

## 1. Infraestrutura e Deploy (Portainer)

O SAE roda em produção como uma stack de **4 containers Docker**, definida em [`docker-compose.yml`](docker-compose.yml), gerenciada em produção via **Portainer** (não via `docker compose` direto na linha de comando do host de produção).

```
services:
  mysql       # MySQL 8.0 — dado persistente em volume nomeado sae_mysql_data
  api         # Fastify (Node 20) — porta 3001:3001 — áudios do chat no volume nomeado sae_uploads (/app/uploads)
  web         # Nginx servindo o build estático do React — porta 8081:80
  cloudflare  # cloudflared — túnel que expõe a stack à internet sem abrir porta no roteador
```

Pontos que importam especificamente para quem opera via Portainer:

- **O compose usa `${VARIAVEL}`** para quase tudo sensível (senhas do MySQL, `JWT_SECRET`, `TUNNEL_TOKEN`) — essas variáveis vêm do arquivo `.env` na raiz do repositório (**não commitado**, `.gitignore` na raiz contém só `.env`). No Portainer, isso normalmente é configurado na seção de "Environment variables" da Stack, ou via um arquivo `.env` que o Portainer lê a partir do mesmo diretório do `docker-compose.yml` — confirme qual dos dois métodos está em uso antes de editar variável de produção.
- **A rede `sae_net` é uma bridge definida pelo usuário** (não a bridge padrão do Docker) — isso importa porque só nesse tipo de rede o Compose cria automaticamente resolução DNS interna tanto pelo **nome do serviço** (`mysql`, `api`, `web`, `cloudflare`) quanto pelo **`container_name`** (`sae_mysql`, `sae_api`, `sae_web`, `sae_cloudflare`). Os dois nomes resolvem para o mesmo IP interno.
- **`web` builda o frontend com a URL da API já embutida** (`VITE_API_URL`, lido de `web/.env` **no momento do build**, não em runtime) — trocar o endereço da API depois de já buildado exige **rebuildar a imagem `web`** no Portainer (não basta reiniciar o container). Ver seção 3.3.
- **O serviço `cloudflare` não expõe porta nenhuma** (`TUNNEL_TOKEN` autentica um túnel outbound) — se o site parar de responder externamente mas os containers estiverem `Up` no Portainer, o primeiro suspeito é esse container ou a configuração do túnel no painel da Cloudflare (Zero Trust > Networks > Tunnels), não necessariamente `api`/`web`.
- **`api` e `web` têm `pull_policy: build`** (desde 2026-09-23) — sem isso, `docker compose up` (o "Pull and redeploy" do Portainer) reaproveitava a imagem já existente e **nunca compilava o código novo** do repositório. Não remover. Ver 2.11.
- **Confirmar todo deploy pelo carimbo de versão**: rodapé da tela `/suporte` ("Versão do sistema: …") e console do navegador (`[SAE] build …`) mostram a data/hora do build do frontend. Se não mudou depois de um redeploy, o deploy não pegou.
- **`db/init/` está vazio** — não há scripts de inicialização SQL rodando automaticamente no primeiro boot do MySQL. Todo o schema é criado exclusivamente pelo Prisma (ver seção 2).

---

## 2. Histórico de Correções Críticas (contexto que você precisa saber antes de mexer)

### 2.1 Fix de Lentidão / Timeout de conexão — `DATABASE_URL` não pode usar `localhost` em produção

**Sintoma**: API extremamente lenta ou com timeout (~24s) para responder qualquer rota que toque o banco, mesmo com o MySQL "rodando".

**Causa raiz**: quando `DATABASE_URL` do container `api` aponta para `localhost` (ou `127.0.0.1`), o driver do Prisma tenta se conectar ao **próprio container da API**, não ao container do MySQL — cada container Docker tem seu próprio `localhost` isolado. Em ambientes onde o resolvedor de nome tenta IPv6 antes de IPv4 (comportamento padrão do Node.js em muitas distros), a tentativa de conexão fica presa tentando uma rota IPv6 que não existe internamente até estourar o timeout do socket (o efeito prático mais reportado é a demora de ~24 segundos por requisição antes de finalmente cair no fallback ou falhar).

**Correção correta**: `DATABASE_URL` do container `api` **precisa apontar para o nome do serviço/container do MySQL dentro da rede Docker** (`sae_mysql`, ou o nome do serviço `mysql` — ambos resolvem, ver seção 1), nunca para `localhost`:

```
# ERRADO em produção (container):
DATABASE_URL="mysql://sae_app:senha@localhost:3306/sae"

# CORRETO em produção (container falando com outro container na mesma rede sae_net):
DATABASE_URL="mysql://sae_app:senha@sae_mysql:3306/sae"
```

O `docker-compose.yml` atual do repositório já monta a variável corretamente para o host de serviço (`mysql:3306`, interpolada a partir de `MYSQL_USER`/`MYSQL_PASSWORD`/`MYSQL_DATABASE`) — **`localhost` só é correto no `api/.env.example` porque esse arquivo é o template para desenvolvimento local sem Docker** (rodando `npm run dev` direto na máquina do desenvolvedor, com MySQL exposto em `localhost:3306` via `ports:` do compose). Se alguém copiar `api/.env.example` para dentro do container em produção sem trocar `localhost` pelo nome do serviço, o sintoma acima volta.

**Checklist rápido se a API voltar a ficar lenta:**
1. Confirme que `DATABASE_URL` usado pelo container `api` (variável de ambiente real do container, não o arquivo `.env.example`) aponta para `sae_mysql` (ou `mysql`), não `localhost`/`127.0.0.1`.
2. Confirme que `api` e `mysql` estão na mesma rede (`sae_net`) — `docker network inspect sae_net` deve listar os dois containers.
3. Se ainda lento, teste resolução DNS de dentro do container da API: `docker exec sae_api node -e "require('dns').lookup('sae_mysql', console.log)"`.

### 2.2 Fix do Erro 500 — Drift entre `schema.prisma` e o banco real (coluna/tabela faltando)

**Sintoma**: `500 Internal Server Error` genérico em rotas que deveriam funcionar — historicamente já aconteceu em Histórico de Vendas, Configurações e Relatórios simultaneamente.

**Causa raiz**: o `schema.prisma` é editado e commitado no controle de versão, mas as **migrations não são automaticamente aplicadas ao banco real** — é preciso rodar `npx prisma migrate deploy` (produção) ou `npx prisma db push`/`migrate dev` (desenvolvimento) manualmente contra o `DATABASE_URL` de cada ambiente. Já aconteceu neste projeto do schema evoluir (ex.: `Empresa.nicho` virar `Empresa.segmento`, `Venda` ganhar itens via `VendaItem`) sem que a migration correspondente fosse gerada/aplicada no banco que a API de fato usava — o Prisma falha ao tentar ler/gravar uma coluna que não existe, e isso cai no `catch-all` genérico do `setErrorHandler` (`api/src/app.js`), virando um `500` sem detalhe nenhum pro cliente.

**Correção aplicada (ambiente local, na sessão de 2026-09-18 — ver `NOTAS_IMPORTANTES.md` linha ~5879)**:
1. `npx prisma migrate status` confirmou que o banco só tinha as **4 migrations mais antigas** aplicadas (`20260907175050_init` até `20260908004951_produto_sob_demanda_cliente_venda`) — toda evolução de schema posterior existia só em `schema.prisma`, nunca chegou no MySQL real.
2. `npx prisma migrate dev` recusou rodar direto: detectou **drift** (tabelas/colunas já existiam no banco sem migration correspondente — sinal de que alguém já tinha usado `db push` nesse banco antes, por fora do histórico de migrations) e exigia `prisma migrate reset` (**apaga o banco inteiro**).
3. Em vez de resetar (destruiria dados reais de produção/teste), foi usado **`npx prisma db push --accept-data-loss`** — sincroniza o schema real do MySQL com `schema.prisma` sem gerar uma migration nova, aceitando perdas de dado pontuais e já esperadas (no caso, a antiga coluna `nicho` virou `segmento`, com o valor antigo `geral` sem equivalente direto, caindo no novo default `outros`).
4. Validado rodando a API local de verdade contra esse banco e testando manualmente `GET/PUT /empresa/dados`, `GET/POST /vendas`, `GET /relatorios/resumo`, `GET /relatorios/dre` — todos voltando `200`.

**⚠️ Consequência que ainda pode não estar resolvida**: essa correção foi confirmada **só no banco local de desenvolvimento**. Se existir um `DATABASE_URL` de produção separado (apontando para o MySQL do Portainer, atrás do túnel Cloudflare), ele **provavelmente tem o mesmo drift** e precisa do mesmo `npx prisma db push` (ou de uma migration formal) rodado contra o `DATABASE_URL` de produção antes de considerar o problema resolvido lá. Antes de rodar isso em produção: **faça backup do volume `sae_mysql_data`** (ou um `mysqldump`) — `db push --accept-data-loss` pode apagar/transformar colunas sem confirmação interativa.

**Checklist se um 500 genérico aparecer de novo:**
1. Olhe o log do container `api` (Fastify usa Pino — erros `5xx` são logados como `error` com o erro completo, diferente dos `4xx` que viram `warn`). Um erro do Prisma sobre coluna/tabela desconhecida (`Unknown column`, `Table ... doesn't exist`, código `P2021`/`P2022`) é a assinatura desse problema.
2. Rode `npx prisma migrate status` contra o `DATABASE_URL` do ambiente afetado.
3. Se houver drift, prefira `npx prisma db push` (não destrutivo do ponto de vista do dado que já bate com o schema) a `migrate reset` — mas **faça backup antes**, sempre.

### 2.3 SaaS Modular: `segmento` passou a decidir quais módulos/telas a empresa vê — e um incidente de nomenclatura de arquivo (2026-09-18)

**Pedido**: refatorar Autenticação + Core de Roteamento pra que os módulos/telas disponíveis pro usuário sejam carregados dinamicamente a partir do `segmento` de atuação da `Empresa` — sem inflar o JWT, sem tabela relacional nova (`empresas_modulos`), reaproveitando o `Placeholder.jsx` já existente como fallback, e com `React.lazy`/`Suspense` nas rotas de negócio do frontend.

**O que mudou, arquivo a arquivo:**

- `api/prisma/schema.prisma` — `Empresa` ganhou `nomeLoja` (`String?`, `@map("nome_loja")`, `VarChar(150)` — apelido/nome fantasia, campo que a UI de Configurações já tinha visualmente mas nunca persistia, ver bônus abaixo) e `segmento` **perdeu o `@default("outros")`** (continua `String` `NOT NULL`, mas agora é obrigatório informar no cadastro — sem fallback implícito).
- `api/src/services/auth.service.js` — novo dicionário estático `MAPA_MODULOS` (chave = segmento, valor = array de módulos liberados) + `SEGMENTOS_VALIDOS = Object.keys(MAPA_MODULOS)` (fonte única, não duas listas soltas) + helper `modulosDoSegmento(segmento)`. `register` agora aceita/persiste `nome_loja` e devolve `empresa.modulos` na resposta. `login` passou a incluir `empresa` (antes não existia esse campo na resposta) com `modulos` calculado a partir do segmento do usuário — **o payload do JWT continua só com `sub`/`empresa_id`/`role`** (confirmado decodificando o token gerado em teste manual, ver "Status de validação" abaixo), `modulos` trafega só no corpo HTTP.
- `api/src/services/empresa.service.js` — `SEGMENTOS_VALIDOS` deixou de ser definido aqui, agora é importado de `auth.service.js` (evita duas listas divergentes). **Decisão não pedida explicitamente, mas necessária**: `GET /empresa/dados` (`obterDados`) e `PUT /empresa/dados` (`atualizarDados`) também passaram a devolver `modulos` (recalculado a cada leitura, não só no login) — sem isso, o `refreshEmpresa()` do frontend (que roda a cada reidratação de sessão e depois de qualquer PUT) sobrescreveria o `empresa.modulos` que o login tinha acabado de calcular com um objeto sem esse campo, e trocar de segmento em Configurações > Dados da Loja nunca atualizaria o menu/as rotas sem um novo login.
- `api/src/controllers/auth.controller.js` / `empresa.controller.js` — `register` agora exige `segmento` no body (400 se faltar, antes era opcional); `SEGMENTOS_VALIDOS` importado direto de `auth.service.js` (não mais de `empresa.service.js`, elimina uma dependência circular em potencial); `atualizarDados` passou a aceitar `nomeLoja` no body.
- **Migração de taxonomia (achado, não pedido explicitamente, mas inevitável)**: o pedido deu exemplos de segmento novos (`varejo_alimentacao`, `moda_vestuario`, `saude_fitness`, `servicos_automotivos`) — diferentes dos 4 valores antigos (`alimenticio`/`varejo`/`servicos`/`outros`). Os gates de regra de negócio que já existiam comparando `empresa.segmento === 'alimenticio'` (Ficha Técnica de ingredientes em `produtos.service.js`, formas de pagamento "Consumo Interno"/"Doação" em `vendas.service.js`, e as telas condicionais equivalentes no frontend) foram **migrados pra `'varejo_alimentacao'`** (o valor novo mais próximo em significado) — sem esse ajuste, essas features ficariam permanentemente inacessíveis pra qualquer empresa, já que `'alimenticio'` nunca mais seria um valor válido de `segmento`.
- `api/prisma/seed.js` — `segmento: 'varejo_alimentacao'` adicionado ao create da empresa seed (quebraria com `NOT NULL` sem `@default` senão).
- `web/src/pages/Cadastro.jsx` — campo novo "Nome da Loja" (opcional) + `<select>` obrigatório "Segmento de Atuação" (as 4 chaves acima, com rótulo em português) — valida no submit além do `required` nativo do `<select>`, e manda `segmento`/`nome_loja` no `POST /auth/register`.
- `web/src/services/api.js` — nova constante `EMPRESA_KEY = 'sae_empresa'` (mesmo padrão de `TOKEN_KEY`/`USER_KEY`).
- `web/src/context/AuthContext.jsx` — `empresa` agora é **persistido em `localStorage`** (`obterEmpresaInicial`, espelhando `obterUsuarioInicial`) e reidratado no boot do app — sem isso, todo F5 numa rota de módulo começaria com `empresa === null` até o `GET /empresa/dados` resolver, arriscando um flash da tela "Módulo indisponível" antes da checagem real. `persistirSessao` grava `resultado.empresa` (login/registro) direto no estado + storage; `refreshEmpresa`/`logout` mantêm o storage em sincronia.
- `web/src/App.jsx` — **reescrito**: todas as páginas de negócio (Dashboard, Vendas, HistoricoVendas, Produtos, CalculadoraPrecificacao, Estoque, Clientes, Lancamentos, ControleFinanceiro, Notas, Agenda, Relatorios, Configuracoes, Modulos, Suporte) viraram `React.lazy()` + `<Suspense fallback={<CarregandoRota />}>` (Login/Cadastro continuam com import estático de propósito — são o caminho mais crítico de quem ainda não tem sessão, não faz sentido atrasá-los com Suspense). Rotas de módulo (`ROTAS_POR_MODULO`) são montadas condicionalmente (`modulos.includes(chave) && <Route .../>` dentro de `.map()`, padrão suportado nativamente pelo `createRoutesFromChildren` do React Router) — Dashboard/Notas/Configuracoes/Modulos/Suporte ficam de fora desse gate (sempre acessíveis, independente de segmento). Catch-all `*` mostra `CarregandoRota` enquanto `empresa === null` (evita falso-negativo) ou `<Placeholder titulo="Módulo indisponível" .../>` quando já se sabe que o módulo não está liberado.
- `web/src/components/Sidebar.jsx` — cada item de `CATEGORIAS_MENU` ganhou um campo `modulo`; a categoria inteira (não só os itens) some do menu se nenhum módulo dela estiver em `empresa.modulos` (evita uma "gaveta" vazia, só com cabeçalho).
- `web/src/components/Placeholder.jsx` — **achado durante a implementação**: o componente (que o pedido pediu pra reaproveitar como estava) tinha o texto interno "Em construção"/"esqueleto de navegação" **hardcoded**, sem prop pra customizar — reaproveitá-lo sem ajuste pro catch-all de módulo indisponível deixaria essa mensagem literalmente errada (não é "em construção", é "não incluído no seu plano/segmento"). Conferido que `Placeholder` não tinha nenhum outro uso ativo no app (só uma menção em comentário, em `Notas.jsx`, explicando por que aquela tela NÃO o usa) — sem risco de quebrar nada existente, adicionadas 2 props opcionais (`corpoTitulo`/`corpoTexto`, com default = texto de sempre) pra cobrir os dois casos sem duplicar o componente.
- `web/src/components/configuracoes/DadosDaLoja.jsx` — **bônus não pedido explicitamente, mas consequência direta do campo novo**: a lista `SEGMENTOS` (select de "Segmento da Empresa") foi atualizada pra nova taxonomia (idêntica à de `Cadastro.jsx` — segmento também é editável depois do cadastro), e o campo "Apelido/Nome Fantasia" (que já existia na tela, mas só alterava estado local — documentado no próprio código como "ainda não é salvo") passou a **ler/gravar `empresa.nomeLoja` de verdade** via `PUT /empresa/dados`, já que o campo que faltava no schema pra isso agora existe.
- Demais arquivos com comentário mudado só de `"alimenticio"` pra `"varejo_alimentacao"` (sem mudança de lógica): `ingredientes.service.js`, `produtos.controller.js`, e os comentários de `schema.prisma` nos models `Produto`/`Venda`/`Ingrediente`/`FichaTecnica`/enum `FormaPagamento`.

**Banco de dados**: rodado `npx prisma db push --accept-data-loss` no MySQL local (`sae_mysql`) após editar o schema — sem perda de dado real: a tabela `empresas` estava **vazia** neste banco local no momento (confirmado via `SELECT COUNT(*)` antes de mexer), então não houve nenhuma linha com `segmento` no formato antigo pra se preocupar aqui. **Achado à parte, sem relação com o schema**: o container `sae_mysql` existente não tinha a porta `3306` publicada pro host (`docker port sae_mysql` vazio, `Test-NetConnection` falhava) mesmo com o healthcheck interno OK — recriado via `docker stop`/`docker rm`/`docker compose up -d mysql` (o volume nomeado `sae_mysql_data` é independente do container, então nenhum dado seria perdido nesse passo mesmo se a tabela não estivesse vazia) e a porta voltou a publicar corretamente.

**⚠️ Atenção pra quando isso for aplicado em produção**: se o banco de produção (fora do alcance desta sessão local) tiver empresas já cadastradas com os valores antigos de segmento (`alimenticio`/`varejo`/`servicos`/`outros`), `modulosDoSegmento()` devolve `[]` (array vazio, não erro) pra qualquer valor que não seja uma das 4 chaves novas — ou seja, **toda empresa existente perderia acesso a todos os módulos de negócio silenciosamente** (Dashboard/Configurações/Módulos/Suporte continuam acessíveis, o resto do menu simplesmente fica vazio) até alguém entrar em Configurações > Dados da Loja e escolher um segmento novo. Antes de rodar `db push`/deploy em produção: migrar os valores existentes com um `UPDATE` (sugestão de mapeamento: `alimenticio`→`varejo_alimentacao`, `varejo`→`moda_vestuario`, `servicos`→`servicos_automotivos`, `outros`→ escolher manualmente por não ter equivalente direto) **antes** de considerar o deploy concluído, mesmo espírito da nota já registrada sobre a migração `nicho`→`segmento`.

**Status de validação**: `npm run build` (Vite) confirmado gerando um chunk JS separado por página lazy (`Vendas-*.js`, `Agenda-*.js`, `Relatorios-*.js` etc. — este último isolado com ~369 KB porque é o único lugar que importa `recharts`, prova de que o code splitting está funcionando de verdade), `npm run lint` (oxlint) sem nenhum erro novo (só os avisos `set-state-in-effect`/`only-export-components` que já existiam em arquivos não tocados por esta tarefa). Testado de ponta a ponta contra a API local rodando de verdade (`node src/server.js`): `POST /auth/register` com `segmento`/`nome_loja` novos (`modulos` retornado batendo com `MAPA_MODULOS['varejo_alimentacao']`), confirmado por `POST /auth/register` **sem** `segmento` retornando `400` como esperado, `POST /auth/login` devolvendo `empresa.modulos`, JWT decodificado manualmente (payload = só `sub`/`empresa_id`/`role`/`iat`/`exp`, confirma a restrição de não inflar o token), `GET /empresa/dados` devolvendo `nomeLoja`/`modulos`, e `PUT /empresa/dados` trocando o segmento pra `saude_fitness` e confirmando que `modulos` recalculou na hora (perdeu `precificacao`/`estoque_avancado`, manteve o resto). Empresa/usuário de teste apagados do banco local ao final (`DELETE FROM empresas WHERE documento = ...`, cascade apagou o usuário junto) — banco local voltado ao estado vazio de antes do teste.

**🔥 Incidente à parte, descoberto ao fechar esta tarefa: sobrescrita acidental de `NOTAS_IMPORTANTES.md`.** Este dossiê (então chamado `notas_importantes.md`, minúsculo) tinha sido criado numa sessão anterior como arquivo supostamente distinto do diário original `NOTAS_IMPORTANTES.md` (maiúsculo). Windows/NTFS (o sistema de arquivos desta máquina) é **case-insensitive** — os dois nomes resolvem pro **mesmo arquivo físico** no disco, então toda escrita num acabava, na prática, sobrescrevendo o outro. Ao editar este dossiê nesta tarefa (adicionando esta própria seção 2.3), o diário original de ~5000 linhas foi reduzido a esse resumo curado no working tree. **Detectado ainda nesta sessão** (`git status`/`git diff --stat` mostrando `5915 deletions(-)` no arquivo rastreado) e **corrigido antes de qualquer commit**: `git checkout -- NOTAS_IMPORTANTES.md` restaurou o conteúdo original a partir do último commit (`5ad336b`) sem perda nenhuma (a sobrescrita nunca chegou a ser commitada). Este dossiê foi então recriado sob o nome `dossie-infraestrutura.md` — sem colisão de case com nada existente no repositório. **Lição registrada aqui de propósito**: neste projeto, nunca nomear um arquivo novo que difira de um já existente só por maiúsculas/minúsculas — sempre um nome genuinamente distinto.

### 2.4 Boot da API quebra sem `AI_API_KEY` assim que alguma rota importa `services/ai` (corrigido em 2026-09-22)

**Sintoma**: `node src/server.js` (ou qualquer `require('./src/app')`) lança `OpenAIError: Missing credentials` e derruba o processo inteiro no boot — mesmo sem nenhuma chamada de IA ter sido feita ainda.

**Causa raiz**: `api/src/services/ai/index.js` instancia `OpenAiCompatibleProvider` **uma única vez, no `module-load`** (decisão deliberada — evita recriar o client do SDK a cada chamada). O construtor do SDK da OpenAI, porém, lança na hora de **criar** o client se `apiKey` vier `undefined`, não só quando ele é usado de verdade. `api/.env.example` documenta `AI_API_KEY=` vazia como valor padrão de desenvolvimento — então qualquer rota que `require('services/ai')` (direta ou indiretamente) derruba o boot inteiro se essa variável não estiver setada. Isso nunca foi percebido até 2026-09-22 porque, até então, `services/ai`/`services/whatsapp` eram scaffolding "pronto mas não plugado" (ver `NOTAS_IMPORTANTES.md`, entrada de 2026-09-16) — nenhuma rota real os importava, até o Inbox Unificado de WhatsApp (`NOTAS_IMPORTANTES.md`, entrada de 2026-09-22) ligar o fio pela primeira vez.

**Correção**: `api/src/services/ai/OpenAiCompatibleProvider.js` já tinha um fallback de `apiKey` pro ramo Ollama (`'ollama-nao-valida-chave'`, quando `AI_BASE_URL` está setada) — passou a valer também quando `AI_BASE_URL` está vazia (`'chave-nao-configurada'`). O client sempre constrói com sucesso; o erro real (401 da OpenAI por chave inválida/ausente) só aparece na hora de uma chamada de fato, não no boot.

**Lição pra qualquer client de SDK externo instanciado no module-load**: nunca deixar um campo obrigatório do construtor cair em `undefined` só porque a env var correspondente está vazia em dev — ou o client falha construção assim que QUALQUER código importar o módulo, mesmo sem usá-lo, e o efeito colateral (processo inteiro não sobe) é desproporcional à causa (uma chamada de IA que nem foi tentada ainda).

### 2.5 Pendência de deploy: migrar `tarefas.status_concluida` (Boolean) → `status` (String) antes de aplicar em produção (2026-09-22)

O Módulo de Produtividade (Quadro de Tarefas Kanban, ver `NOTAS_IMPORTANTES.md` entrada de 2026-09-22) trocou `Tarefa.statusConcluida` (Boolean) por `Tarefa.status` (String — `A_FAZER`/`EM_ANDAMENTO`/`CONCLUIDO`). Aplicado com `npx prisma db push --accept-data-loss` no banco **local**, sem problema porque a tabela `tarefas` estava vazia no momento. **Se o banco de produção já tiver tarefas reais cadastradas, rodar o mesmo `db push` sem mais nada vai apagar silenciosamente o estado de conclusão de cada uma** (`status_concluida` some, `status` nasce todo com o default `A_FAZER`, mesmo pra tarefas que já estavam concluídas).

**Antes de aplicar este schema em produção**, rodar primeiro (com o banco de produção em `status_concluida` ainda presente):

```sql
UPDATE tarefas SET status = IF(status_concluida, 'CONCLUIDO', 'A_FAZER');
```

(A coluna `status` só existe depois que o `db push`/migration já rodou — ou seja, a ordem certa é: 1) aplicar o schema novo com a coluna `status` já criada (ela nasce com o default `A_FAZER` pra tudo), 2) **antes** de derrubar a coluna antiga `status_concluida`, rodar o `UPDATE` acima pra corrigir as linhas que já estavam concluídas, 3) só então considerar a migração terminada. Se o `db push` já tiver rodado tudo de uma vez (schema E drop da coluna antiga juntos, como aconteceu no ambiente local), não há mais como recuperar o valor antigo — faça backup do banco antes.) Mesma lição já registrada na seção 2.3 sobre a migração `nicho`→`segmento`: **toda vez que um campo de schema muda de tipo/significado, o `db push` sozinho nunca migra o *dado* — só a estrutura.**

### 2.6 Arquitetura Modular SaaS: `Empresa.segmento` parou de decidir os módulos ativos (2026-09-22)

Mudança de comportamento importante pra quem for depurar "por que trocar o segmento da empresa não muda mais o menu": até 2026-09-22, `empresa.modulos` (consumido por `App.jsx`/`Sidebar.jsx`) era **recalculado a cada leitura** a partir de `Empresa.segmento` (`MAPA_MODULOS` em `auth.service.js`). Isso mudou — `Empresa` ganhou um campo novo, `modulosAtivos` (`Json?`, ver schema.prisma), que é a fonte da verdade **persistida** e editável pela própria empresa em `Modulos.jsx` (`PUT /empresa/modulos`). `segmento` só decide o conjunto **inicial** de módulos no cadastro (`register()`) — depois disso os dois campos são independentes, e `PUT /empresa/dados` (que edita o segmento) não toca mais em `modulosAtivos`.

**Pendência de deploy, mesma classe da 2.5 acima**: uma empresa já cadastrada em produção **antes** desta tarefa não tem `modulosAtivos` preenchido (coluna nova, `NULL` pra toda linha existente). O código tem um fallback (`modulosAtivos ?? modulosDoSegmento(segmento)`, em `auth.service.js#login` e `empresa.service.js#obterDados`/`atualizarDados`) que cobre esse caso automaticamente — a empresa continua vendo os módulos calculados do segmento até a primeira vez que alguém mexer num toggle em `Modulos.jsx` (a partir daí o valor persiste de verdade). Não é uma migration bloqueante como a 2.5 (não há perda de dado, só um `NULL` temporário coberto por fallback), mas vale confirmar esse comportamento com um teste real contra o banco de produção antes de considerar o deploy encerrado.

**Renomeação de chave que pode confundir quem procurar `'pdv'` no código**: a chave de módulo `'pdv'` (cobria Vendas + PDV Rápido/Frente de Loja juntos) foi separada em `'vendas'` (módulo base, sempre ativo) e `'pdv_touch'` (opcional, toggle próprio). Do mesmo jeito, `'tarefas'` (Quadro Kanban) deixou de compartilhar a chave `'agenda'` — agora é um módulo independente. Ver `MODULOS_BASE`/`MODULOS_VALIDOS`/`MAPA_MODULOS` em `api/src/services/auth.service.js` pro catálogo atual completo.

### 2.7 Motor de monetização: `pdv_touch`/`clientes`/`tarefas` viraram pagos — empresas antigas continuam com acesso de graça (2026-09-22)

No mesmo dia da 2.6, um motor de pricing foi adicionado à App Store: `pdv_touch` (Frente de Loja), `clientes` (CRM), `tarefas` (Kanban) e `ia_whatsapp` (Inbox de IA) agora exigem pagamento simulado (`Empresa.pagamentosAtivos`, `PUT /empresa/pagamentos`) antes de poderem ser ligados (`PUT /empresa/modulos` recusa com `402` quem tentar ligar sem pagar). Os 3 primeiros **eram gratuitos** até então, liberados automaticamente pelo `MAPA_MODULOS` do cadastro (ver 2.6) — foram removidos dos arrays de `MAPA_MODULOS` nesta tarefa (senão o bloqueio de pagamento não valeria pra empresa nova nenhuma, ver `NOTAS_IMPORTANTES.md`).

**Pendência de produto pra antes do deploy**: essa mudança só afeta cadastros **novos** — qualquer empresa que já tinha `pdv_touch`/`clientes`/`tarefas` em `modulosAtivos` (seja por ter se cadastrado no mesmo dia antes desta tarefa, seja num eventual banco de produção anterior a ela) **continua com o módulo ativo e nunca pagou por ele** (`pagamentosAtivos` fica vazio pra esses módulos). Efeito colateral: se essa empresa desligar o módulo no toggle e tentar religar depois, vai esbarrar no `402` — parece um bug pro usuário ("eu já tinha isso, por que agora está pedindo pra pagar?"), mas é esperado dado como a migração foi feita. Antes de considerar esse motor de pricing "pronto pra produção": rodar uma migração de dados retroativa marcando como pago (`pagamentosAtivos[chave] = true`) qualquer módulo que já constava em `modulosAtivos` de uma empresa existente, pra não cobrar por algo que já era de graça.

### 2.7.1 Pedido duplicado da "Fase 2" de monetização recebido no mesmo dia (2026-09-22)

Depois da 2.7 acima ser implementada e commitada (`d884708`), uma sessão seguinte pediu a **mesma feature do zero** ("Fase 2: Monetização, Regras de Desconto para Doadores e Bloqueio de Módulos"), com um spec que diverge só em nomenclatura: pedia uma coluna literal `Empresa.is_doador` (o código já tinha decidido, com o usuário, **derivar** isso de `plano === 'apoiador'` — ver 2.7 e `NOTAS_IMPORTANTES.md`) e uma rota `POST /pagamentos/checkout` (o código já usa `PUT /empresa/pagamentos`, mesmo comportamento). Confrontado com o usuário antes de mexer em código já testado — decisão: **manter como está**, sem renomear nada. Nenhum arquivo de código mudou; só esta nota e a entrada correspondente em `NOTAS_IMPORTANTES.md`.

**Lição prática**: antes de implementar um pedido detalhado (schema + backend + frontend + modal) neste projeto, vale conferir `git log --oneline` e grepar pelos nomes-chave do pedido primeiro — pode já existir.

### 2.7.2 Causa raiz confirmada: quase nada tinha migration real desde 2026-09-08 (2026-09-22)

Investigando o relato "mudanças não refletem em produção, servidor diz que schema não tem alterações": `api/prisma/migrations/` só tinha 4 pastas (todas de 2026-09-07/08). Tudo depois disso (`segmento` obrigatório, `modulosAtivos`/`pagamentosAtivos`/`isDoador`, `nivelAcesso`, `Tarefa.status`, `VendaItem`, `Atendimento`/`Mensagem`, `ChamadoSuporte`, `ConfiguracaoGlobal`) só existia via `prisma db push` local - nunca virou migration commitada. `prisma migrate deploy` em produção sempre reportaria "nada pendente" mesmo com o schema real defasado, porque **não existe migration nenhuma pra ele aplicar** - a mensagem "schema não tem alterações" é literalmente verdadeira e ao mesmo tempo enganosa.

**Corrigido nesta sessão**: gerada `api/prisma/migrations/20260922222219_saas_modular_pricing_supra_admin_catchup/migration.sql` via `prisma migrate diff` (contra um banco shadow, sem tocar no banco real). Local sincronizado e as 5 migrations marcadas como aplicadas (`prisma migrate resolve --applied`) - `migrate status` local limpo agora.

**Não resolvido, fora do alcance desta sessão (sem acesso ao MySQL de produção)**: a migration nova precisa rodar em produção via `prisma migrate deploy`, mas ela **derruba colunas com dado real** se produção tiver `tarefas`/`vendas` preenchidas (`tarefas.status_concluida`, `vendas.produto_id`/`quantidade`/`preco_unitario`) - os comandos de backfill necessários estão no cabeçalho do próprio arquivo de migration. **Backup obrigatório antes.** Ver a entrada completa em `NOTAS_IMPORTANTES.md` (2026-09-22, "Causa raiz real do 'schema não tem alterações em produção'") para o passo a passo.

**Lição de processo**: este projeto não tem nenhum pipeline que rode `prisma migrate deploy` (ou `db push`) contra produção automaticamente a cada deploy - toda evolução de schema até agora dependeu de alguém lembrar de fazer isso manualmente. Enquanto isso não existir, qualquer mudança de schema nova corre o mesmo risco de "não refletir em produção" silenciosamente.

### 2.7.3 Terceiro pedido duplicado no mesmo dia: "Fase 3" (Painel Supra Admin) também já existia (2026-09-22)

Mesmo padrão das entradas 2.7.1/2.7.2 acima: pedido de "Fase 3 - Painel Supra Admin" pediu do zero algo já implementado no commit `499776a` (ver 2.8 logo abaixo). Duas divergências do spec, nenhuma aplicada (usuário confirmou deixar como está): (1) `Usuario.role` pedido como campo de nível de plataforma - já resolvido antes como `nivelAcesso`, campo separado de `role` (permissão intra-empresa); (2) `ChamadoSuporte.id`/`empresaId` como `String`/`uuid()` pedido no spec - **tecnicamente incompatível**, já que `Empresa.id` é `Int` em toda a aplicação e o Prisma exige tipos batendo entre FK e coluna referenciada. Detalhe completo em `NOTAS_IMPORTANTES.md`.

### 2.8 Painel Supra Admin — "Suspender Acesso" não revoga sessões JWT já abertas (2026-09-22)

Nível mais alto do sistema, exclusivo pro dono do software (`Usuario.nivelAcesso === 'SUPERADMIN'`, campo novo e separado do já existente `Usuario.role` — ver `NOTAS_IMPORTANTES.md` pra o raciocínio completo por trás de não reaproveitar `role`). Ninguém vira SUPERADMIN pelo cadastro self-service (`register()` sempre grava `"LOJISTA"`) — só manualmente, direto no banco.

**Limitação estrutural a saber antes de confiar cegamente em "Suspender Acesso" (aba Empresas/Clientes)**: suspender uma empresa (`Empresa.ativo = false`) bloqueia **login novo** (`auth.service.js#login` passou a checar isso, `403`), mas esta arquitetura usa JWT **stateless**, sem blacklist/revogação de token ativo — qualquer sessão já aberta (token emitido antes da suspensão) continua funcionando normalmente até expirar (`JWT_EXPIRES_IN`, padrão 8h). Ou seja: suspender uma empresa não tira ninguém que já está logado do sistema na hora, só impede login novo dali pra frente. Se um caso de uso real exigir corte instantâneo (ex.: fraude, inadimplência crítica), essa arquitetura não entrega isso sem trabalho adicional (lista de tokens revogados, ou trocar pra sessão server-side) — nenhum desses foi implementado, fora do escopo desta tarefa.

Mesma observação vale, por extensão, pra qualquer futuro mecanismo de "banir"/"desativar" usuário individual (não só empresa inteira) que reaproveite o mesmo padrão de JWT sem estado.

### 2.9 Incidente de produção: 500 em `POST /auth/login` — promoção manual a Supra Admin gravou a coluna errada (2026-09-22/23)

**Sintoma**: `500` em `POST /auth/login`, infraestrutura (Nginx/MySQL/Cloudflare Tunnel) toda saudável — indicando falha no backend.

**Causa raiz**: `Usuario.role` (enum `admin`/`gerente`/`vendedor`, permissão *dentro* da empresa) tinha o valor `'SUPERADMIN'` gravado na linha do dono do sistema (`id=1`) — inválido pro enum. Qualquer query tocando essa linha (inclusive `login()`) quebrava com `PrismaClientUnknownRequestError: Value 'SUPERADMIN' not found in enum 'RoleUsuario'` ao tentar desserializar. A causa: alguém promoveu essa conta a Supra Admin rodando o `UPDATE` na coluna **errada** — `role` em vez de `nivel_acesso` (a coluna certa, String livre, separada de `role` de propósito — ver 2.8 acima). MySQL aceitou a escrita sem reclamar porque `role`, em produção, não está restrito como ENUM nativo estrito (mesmo drift de schema documentado em 2.2/2.7.2).

**Correção aplicada e confirmada**: `UPDATE usuarios SET role = 'admin', nivel_acesso = 'SUPERADMIN' WHERE id = 1;` — login voltou a funcionar.

**⚠️ Como promover um Supra Admin corretamente, daqui pra frente** — nunca escreva `'SUPERADMIN'` em `role`:

```sql
-- Promover (so mexe em nivel_acesso, role fica como estava - normalmente 'admin'):
UPDATE usuarios SET nivel_acesso = 'SUPERADMIN' WHERE email = 'email-do-usuario@exemplo.com';
-- Reverter:
UPDATE usuarios SET nivel_acesso = 'LOJISTA' WHERE email = 'email-do-usuario@exemplo.com';
```

Sempre `SELECT` por `email` antes de qualquer `UPDATE` manual em produção, pra confirmar a linha certa. Detalhe completo (incluindo a tabela `role` vs. `nivel_acesso`) em `NOTAS_IMPORTANTES.md`.

**⚠️ Achado à parte, mais grave**: durante este diagnóstico, o comando colado pelo usuário usava a senha root do MySQL de produção como `dev_root_change_me` — o placeholder de desenvolvimento local (ver 3.4 abaixo, que já avisa contra isso). Se essa é de fato a senha em produção, é uma exposição de segurança real — troque assim que possível. Ver 4.2 abaixo.

### 2.10 Chat de Suporte (Passo 1): migration `mensagens_chamado` + sessões antigas sem campos novos (2026-09-23)

**Migration nova, 100% aditiva** — `20260923170000_chat_suporte_mensagens_chamado`: cria a tabela `mensagens_chamado` (chat 1:N de `chamados_suporte`, `remetente` `LOJISTA`/`ADMIN`, `tipo_mensagem` `TEXTO`/`AUDIO`) e adiciona `chamados_suporte.atualizado_em` (`NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` — seguro com linhas existentes). Sem backfill; aplicar com `docker exec sae_api npx prisma migrate deploy` depois do rebuild/recreate de `api` e `web` (backup antes, como sempre). Runbook completo em `NOTAS_IMPORTANTES.md`.

**✅ Resolvido no Passo 2 (ver 2.12) — era uma pendência de infraestrutura pro áudio**: os áudios do chat vão ser salvos **em disco** pela API (não em base64 no banco — decisão pra não inchar a tabela). Antes desse passo ir pra produção, o serviço `api` do `docker-compose.yml` precisa de um **volume nomeado persistente** montado na pasta de uploads — sem isso, todo `--force-recreate` do container `api` (o fluxo normal de deploy via Portainer) **apaga todos os áudios já enviados**, e as mensagens no banco passam a apontar pra arquivos inexistentes.

**⚠️ `prisma migrate dev` recusa rodar no banco local**: acusa que `20260922222219_saas_modular_pricing_supra_admin_catchup` foi modificada depois de aplicada (checksum diferente) e pede `migrate reset` (apaga tudo). **Não rodar o reset.** Gerar migrations novas via `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <SHADOW_DATABASE_URL> --script` e aplicar com `migrate deploy` (que não confere checksum de migration antiga). Lição: **nunca editar o `migration.sql` de uma migration que já foi aplicada em algum banco**.

**Comportamento novo do login a saber**: o frontend grava o objeto `usuario` no `localStorage` só no login — antes desta correção, uma sessão aberta antes de um campo novo existir (ex.: `codigoUsuario`) ficava sem ele até novo login ("Seu ID" = `-----` no Suporte). Agora `AuthContext` chama `GET /auth/me` a cada boot e reidrata o usuário. Se "Seu ID" continuar `-----` em produção depois do deploy, o problema é dado, não código: o usuário não tem `codigo_usuario` no banco — rodar `scripts/backfillCodigoUsuario.js`.

### 2.11 Incidente: deploy "idêntico ao anterior" — Portainer reaproveitava a imagem antiga (2026-09-23)

**Sintoma**: commit novo (`465d846`) enviado ao GitHub, redeploy feito no Portainer, e **nenhuma mudança visual** no sistema; o servidor tratou o deploy como idêntico ao anterior.

**Causa raiz**: `api` e `web` no `docker-compose.yml` usam `build:` sem `pull_policy`. Nesse caso, `docker compose up -d` **só builda a imagem se ela ainda não existir** — como `sae-api`/`sae-web` já existiam, o Portainer recriava os containers com a imagem antiga. O código do commit nunca era compilado. Agravante: `web/nginx.conf` não mandava `Cache-Control`, então mesmo uma imagem nova podia ser mascarada por um `index.html` antigo em cache (navegador/Cloudflare).

**Correção**:
- `pull_policy: build` em `api` e `web` (força rebuild a cada `up`; o cache de camadas continua, então rebuild sem mudança é rápido).
- `web/nginx.conf`: `index.html`/rotas SPA → `no-cache, no-store, must-revalidate`; `/assets/` (nomes com hash) → `max-age=31536000, immutable`.
- Carimbo de versão do build (`__BUILD_ID__` no `vite.config.js`), visível no rodapé de `/suporte` e no console — prova objetiva de que o deploy chegou ao navegador.

**Se acontecer de novo** (carimbo não mudou após redeploy): via SSH no host, `docker compose build --no-cache api web && docker compose up -d --force-recreate api web`, depois Ctrl+F5 no navegador. Se o carimbo mudou mas a tela não, suspeitar de regra de cache "Cache Everything" no Cloudflare (purge em Caching > Configuration > Purge Everything).

### 2.12 Chat de Suporte (Passo 2): áudios em disco no volume `sae_uploads` (2026-09-24)

O chat lojista ↔ Supra Admin (texto + áudio gravado no navegador) guarda os **arquivos de áudio em disco**, não no banco — a tabela `mensagens_chamado` só tem o caminho relativo. Consequências operacionais:

- **Volume nomeado `sae_uploads` montado em `/app/uploads` do container `api`** (`UPLOADS_DIR` no `environment:`). Criado automaticamente pelo Compose no primeiro `up`. **Nunca remover esse volume nem o mapeamento** — sem ele, todo recreate do `api` apaga os áudios, e as mensagens passam a responder `410 "Áudio indisponível no servidor"`.
- **Backup**: o `mysqldump` sozinho **não** cobre os áudios. Pra backup completo do suporte, copiar também o volume: `docker run --rm -v sae_sae_uploads:/dados -v "$PWD":/bkp alpine tar czf /bkp/uploads.tgz -C /dados .` (o nome real do volume leva o prefixo do projeto Compose — conferir com `docker volume ls | grep uploads`).
- **Limite de corpo**: só `POST .../chamados/:id/mensagens` aceita até 8 MB (áudio em base64 no JSON); o resto da API segue no 1 MB padrão do Fastify. Se um proxy na frente (Nginx/Cloudflare) tiver limite menor que ~8 MB, o envio de áudio longo falha antes de chegar na API — hoje o `web` (Nginx) não fica no caminho da API, e o Cloudflare aceita 100 MB no plano gratuito.
- **Microfone exige HTTPS**: `getUserMedia` só funciona em contexto seguro. Em produção o Cloudflare Tunnel já entrega HTTPS; acessar o sistema por `http://<ip>:8081` direto desativa o botão de gravar (texto continua funcionando).
- **Tempo real = polling a cada 5 s** (`GET ...?apos=<ultimoId>`, só mensagens novas) — sem WebSocket, nada a configurar no túnel.
- **Player de áudio é customizado** (`CustomAudioPlayer.jsx`, 2026-09-24), não o `<audio controls>` do navegador. Se um áudio aparecer com tempo total "0:00" ou com o botão girando pra sempre, suspeitar do cálculo de duração de webm do MediaRecorder (ver 4.3) antes de suspeitar do arquivo/servidor — o arquivo em si se confere direto na rota `GET .../mensagens/:id/audio`.
- Excluir empresa/chamado apaga as mensagens (cascade), mas **não** os arquivos — ficam órfãos no volume (sem impacto hoje; não há exclusão de chamado pela UI).

---

## 3. Configurações de Ambiente (`.env`)

### 3.1 Por que os `.env` não sobem pro Git

Todo `.gitignore` do repositório (raiz, `api/`, `web/`) ignora `.env` explicitamente — só os `.env.example` (com placeholders tipo `troque_esta_senha_root`) são versionados. Isso é deliberado: os `.env` reais carregam senhas de banco, `JWT_SECRET` e o `TUNNEL_TOKEN` do Cloudflare.

**Isso já foi violado uma vez neste projeto.** Um `TUNNEL_TOKEN` real (não um placeholder) foi colado diretamente em `docker-compose.yml` e commitado (`commit a22b87f "token cloudflare"`), chegando a ser enviado ao GitHub antes de ser corrigido — nesse momento o token já estava público no histórico do repositório remoto, e reescrever o arquivo depois **não** apaga isso do histórico do Git. Regra prática: **nunca cole um segredo real direto no `docker-compose.yml` ou em qualquer arquivo versionado** — sempre `${VARIAVEL}` interpolada a partir do `.env` ignorado. Se isso acontecer de novo, o segredo exposto deve ser tratado como **comprometido e rotacionado** (revogado/recriado na origem — no caso do Cloudflare, em Zero Trust > Networks > Tunnels), reescrever o arquivo sozinho não resolve.

Cuidado adicional já documentado: na forma de **lista** do `environment:` do Compose (`- VAR=valor`), não existe parsing de shell — aspas duplas coladas no valor (`TUNNEL_TOKEN="abc123"`) viram **parte literal** da string da variável, não delimitadores. Sempre `VAR=${VAR}` sem aspas nessa sintaxe.

### 3.2 `.dockerignore` — por que existe separadamente em `api/` e `web/`, com regras diferentes

- **`api/.dockerignore`** exclui `node_modules` **e `.env`** — o `Dockerfile` da API faz `COPY . .` depois do `npm install`; sem esse `.dockerignore`, o `.env` local do desenvolvedor (com segredos reais) e o `node_modules` compilado para o SO do host (não para o Linux da imagem) seriam copiados para dentro da imagem Docker — risco de segurança (segredo gravado numa camada da imagem, potencialmente extraível) e de bug (binários nativos errados sobrescrevendo os instalados no container).
- **`web/.dockerignore`** exclui `node_modules`/`dist` mas **propositalmente NÃO exclui `.env`** — o Vite precisa do `.env` presente **durante** `npm run build` (estágio `builder` do multi-stage Dockerfile) para embutir `VITE_API_URL` no bundle final. Não há risco de segredo vazando pra imagem final porque o estágio `builder` inteiro é descartado no multi-stage build (só o `dist/` resultante é copiado para o estágio `nginx:alpine`).

### 3.3 `VITE_API_URL` no frontend — a pegadinha de build-time vs. runtime

Já causou incidente real neste projeto (`ERR_CONNECTION_REFUSED` em produção, sessão de 2026-09-12): sem um `web/.env` presente no momento do build, o Vite cai no fallback hardcoded em `web/src/services/api.js`. Se esse fallback apontar para `localhost`, qualquer navegador externo tentando acessar o sistema vai tentar conectar em `localhost` **da própria máquina do usuário**, não no servidor — dando erro de conexão recusada.

Regras:
- `web/.env` **precisa existir e estar correto antes de rodar `npm run build`** (ou antes de buildar a imagem Docker, que roda o build internamente).
- Qualquer troca de domínio/IP/porta da API em produção **exige rebuildar a imagem `web`** — reiniciar o container sozinho não pega a mudança, porque o valor já está congelado dentro do JavaScript gerado.
- Confirme a porta certa: a API roda na porta **3001** (não 3000 — já foi motivo de confusão numa correção anterior, o `docker-compose.yml` mapeia `"3001:3001"`).

### 3.4 Credenciais reais só existem no Portainer / no `.env` do host de produção

Nenhum valor real de produção (senha de banco, `JWT_SECRET`, `TUNNEL_TOKEN`, eventual `AI_API_KEY`) deve ser copiado para este repositório, para os arquivos `.env.example`, ou para qualquer documentação — inclusive este arquivo. Ao configurar um ambiente novo:
1. Copie cada `.env.example` (raiz, `api/`, `web/`) para `.env` no mesmo diretório.
2. Gere segredos novos e aleatórios para produção (`JWT_SECRET`: `openssl rand -hex 32`; senhas do MySQL: geradas por um gerenciador de senhas) — **nunca reaproveite os valores de exemplo**.
3. `TUNNEL_TOKEN` real vem do painel Cloudflare Zero Trust > Networks > Tunnels > (seu túnel) > Configure.
4. No Portainer, esses valores entram como variáveis de ambiente da Stack — nunca hardcoded no `docker-compose.yml` versionado (ver 3.1).

### 3.5 Variáveis específicas de cada `.env` — referência rápida

| Arquivo | Variáveis | Observação |
|---|---|---|
| `.env` (raiz) | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `TUNNEL_TOKEN` | Consumido pelo `docker-compose.yml` para interpolar `${...}` nos 4 serviços. |
| `api/.env` | `NODE_ENV`, `PORT`, `DATABASE_URL`, `SHADOW_DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `WHATSAPP_PROVIDER`, `META_*` | Usado só para **rodar a API fora do Docker** (`npm run dev`/`npm start` local) — em container, quem define essas variáveis é o `environment:` do `docker-compose.yml`. `SHADOW_DATABASE_URL` só é necessária para `prisma migrate dev` (precisa de credenciais com permissão de `CREATE DATABASE` — por isso usa `root`, só em dev). |
| `web/.env` | `VITE_API_URL` | Só essa. Lida em **build time** (ver 3.3), não runtime do Nginx. |

---

## 4. Avisos de Segurança e Troubleshoot

### 4.1 O que verificar primeiro se o sistema "cair"

1. **`docker ps` / Portainer → todos os 4 containers `Up`?** Se `mysql` não estiver `healthy` (o compose define um healthcheck via `mysqladmin ping`), `api` nunca sobe de verdade (`depends_on: condition: service_healthy`).
2. **Logs do `api`** (Pino, JSON estruturado) — procure por erros `5xx` (nível `error`) vs. `4xx` (nível `warn`, esperados no fluxo normal, não indicam bug).
3. **Lentidão específica de banco** → ver seção 2.1 (`DATABASE_URL`/`localhost`).
4. **500 genérico em várias rotas ao mesmo tempo** → ver seção 2.2 (drift de schema).
5. **Site inacessível de fora, containers `Up`** → suspeite do container `cloudflare`/configuração do túnel antes de mexer em `api`/`web`.
6. **Frontend conectando no lugar errado** (`ERR_CONNECTION_REFUSED`, chamadas indo para `localhost`) → `web/.env` errado no momento do build, ou imagem `web` desatualizada (precisa rebuild, não restart) — ver seção 3.3.

### 4.2 Segurança — pontos abertos conhecidos (ver também `direcionamento.md`, seção 6)

- **CORS totalmente aberto** (`origin: '*'`) em `api/src/app.js` — comentado no próprio código como decisão só para desenvolvimento, nunca revisitada para produção. Qualquer origem pode chamar a API hoje.
- **Sem autorização por `role`** — o JWT carrega `role` (admin/gerente/vendedor) mas nenhuma rota do backend a consulta. Qualquer usuário autenticado de uma empresa pode executar qualquer ação dessa empresa (trocar plano, adicionar usuário, excluir produto), independente do cargo.
- **JWT em `localStorage`** (não cookie `httpOnly`) — padrão aceito mas exposto a roubo de token via XSS, caso algum dia surja um vetor de injeção no frontend.
- **`TUNNEL_TOKEN` já vazou uma vez no histórico do Git** (ver 3.1) — se a rotação mencionada ali ainda não foi confirmada como feita, trate como pendência de segurança ativa, não como incidente encerrado.
- **⚠️ Senha root do MySQL de produção igual ao placeholder de dev (`dev_root_change_me`)** — achado em 2026-09-23 durante o diagnóstico do incidente 2.9 acima, ao ver o comando `docker exec sae_mysql mysql -uroot -p'dev_root_change_me' ...` colado pelo usuário. Se essa senha ainda não foi trocada em produção, é uma pendência de segurança ativa e grave — qualquer pessoa que já tenha visto esse valor (documentado como exemplo em `api/.env.example`/`.env.example` da raiz) tem acesso root ao banco de produção. Trocar via `MYSQL_ROOT_PASSWORD` no Portainer/`.env` de produção + reiniciar o container `mysql`, atualizando qualquer script/serviço que dependa da senha antiga.

### 4.3 Comportamentos específicos de dependências (não são bugs, são esperados)

- **`node:20-slim` precisa de `openssl` instalado manualmente** (`apt-get install -y openssl` no `api/Dockerfile`) — sem isso, o Prisma emite o aviso "Prisma failed to detect the libssl/openssl version" no boot (não impede o funcionamento, mas polui o log).
- **`$queryRaw` do Prisma devolve coluna `UNSIGNED INT` como `BigInt` cru**, mesmo o Prisma Client "normal" mapeando `INT UNSIGNED` para `number` em todo o resto do código — qualquer query bruta nova precisa converter manualmente (`Number(...)`) antes de serializar em JSON, senão quebra com "Do not know how to serialize a BigInt" (já corrigido em `dashboard.service.js`, mas é uma pegadinha recorrente para qualquer `$queryRaw` novo).
- **Prisma exige banco "shadow" para `migrate dev`** (não para `db push` nem `migrate deploy`) — o usuário de aplicação (`sae_app`) só tem grants no banco `sae`, sem `CREATE DATABASE`; por isso `SHADOW_DATABASE_URL` usa credenciais de `root`, e só é relevante em desenvolvimento local.
- **Content-Type `application/json` com corpo vazio** — o Fastify por padrão rejeita isso com 400; a API tem um parser customizado em `app.js` para tratar como `undefined` (necessário porque o Axios do frontend sempre manda esse header, inclusive em `DELETE` sem corpo).
- **Nginx padrão (`nginx:alpine`) não serve SPA** — sem o `web/nginx.conf` customizado (`try_files $uri $uri/ /index.html;`), qualquer F5 numa rota client-side do React Router (ex.: `/configuracoes`) retorna 404 do Nginx, porque esse arquivo não existe fisicamente no disco.
- **Windows/NTFS é case-insensitive** — dois arquivos no repositório cujo nome só difere em maiúsculas/minúsculas (`NOTAS_IMPORTANTES.md` vs. `notas_importantes.md`) são o **mesmo arquivo físico** nesta máquina; escrever num sobrescreve o outro silenciosamente. Ver o incidente completo na seção 2.3.
- **Um painel/lista scrollável dentro de um `flex flex-col` de altura fixa precisa de `min-h-0`, não só `overflow-y-auto`** — um filho `flex-1` tem `min-height: auto` por padrão (o "automatic minimum size" dos flex items), então ele cresce pra caber todo o conteúdo em vez de respeitar o espaço disponível e ativar o próprio scroll. Já causou um bug real na Sidebar (`web/src/components/Sidebar.jsx`) — o último item do menu ficava cortado atrás do rodapé sempre que a lista de links era mais alta que a tela, mesmo com `overflow-y-auto` já presente. Corrigido adicionando `min-h-0` junto com `flex-1`/`h-full` (2026-09-22, ver `NOTAS_IMPORTANTES.md`). Vale a mesma checagem em qualquer painel scrollável novo dentro de um flex container de altura fixa.

- **Áudio webm gravado pelo MediaRecorder (Chrome) chega com `duration === Infinity`** — o arquivo não traz a duração no cabeçalho. Não é arquivo corrompido: o `CustomAudioPlayer.jsx` do chat contorna pulando pra `currentTime = 1e101` no `loadedmetadata` (força o cálculo) e voltando pra 0. Qualquer player novo de áudio gravado no navegador precisa do mesmo truque, senão mostra "0:00" de duração.

### 4.4 Onde olhar para reconstruir o contexto de uma decisão antiga

Este arquivo é um resumo. Para o raciocínio completo por trás de qualquer decisão passada (o que foi tentado, o que foi descartado e por quê, exatamente qual foi o teste de validação rodado), consulte [`NOTAS_IMPORTANTES.md`](NOTAS_IMPORTANTES.md) — é um diário cronológico por tarefa, com cabeçalhos `##` datados. Vale a pena abrir e buscar (`Ctrl+F`) pela palavra-chave do problema antes de investigar do zero — boa chance de já ter acontecido antes.
