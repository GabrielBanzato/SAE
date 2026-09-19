# Direcionamento — SAE (Sistema de Apoio Empresarial)

> Guia de arquitetura de ponta a ponta. Escrito para que qualquer desenvolvedor (humano ou IA) que nunca viu este repositório consiga entender o sistema inteiro só lendo este arquivo + [`dossie-infraestrutura.md`](dossie-infraestrutura.md).

---

## 1. Visão Geral e Arquitetura

### 1.1 O que é o SAE

SAE ("Sistema de Apoio Empresarial") é um **SaaS multi-tenant de gestão para pequenos negócios** (padarias, lojas de varejo, prestadores de serviço) em português brasileiro. Um único deploy do sistema atende **múltiplas empresas (tenants)** isoladas logicamente no mesmo banco de dados. Cada empresa cadastrada é dona de seus próprios usuários, produtos, vendas, clientes, lançamentos financeiros etc.

Módulos cobertos hoje (ver seção 2 para detalhe arquivo-a-arquivo):

- **Autenticação** (cadastro self-service de empresa + login JWT).
- **PDV / Vendas** (carrinho multi-item, baixa de estoque, geração automática de lançamento no caixa).
- **Produtos** (CRUD, estoque, "sob demanda", Ficha Técnica de ingredientes para o segmento alimentício).
- **Precificação** (calculadora de markup, modo direto e modo reverso).
- **Estoque** (ajuste rápido de produtos + estoque de ingredientes/insumos com cálculo de "autonomia de produção").
- **Clientes** (cadastro simples).
- **Lançamentos / Controle Financeiro** (contas a pagar/receber, CRUD completo, dashboards agregados em memória).
- **Agenda** (calendário mensal que unifica Lançamentos e Tarefas).
- **Relatórios** (resumo simples para todo mundo; DRE + gráfico de vendas por dia exclusivo do plano pago).
- **Configurações** (dados da loja, equipe, assinatura/plano).
- **Módulos** (vitrine comercial de add-ons pagos — hoje só maquetes/mocks: IA no WhatsApp, Notas Fiscais).

### 1.2 Stack tecnológica exata

| Camada | Tecnologia | Versão (package.json) |
|---|---|---|
| Frontend | React | ^19.2.8 |
| Frontend | React Router DOM | ^7.18.3 |
| Frontend | Vite (bundler/dev server) | ^8.2.2 |
| Frontend | Tailwind CSS (CSS-first, sem `tailwind.config.js`) | ^4.3.3 |
| Frontend | Axios (cliente HTTP) | ^1.20.0 |
| Frontend | Recharts (gráfico de barras do DRE) | ^3.10.1 |
| Frontend | lucide-react (ícones) | ^1.41.0 |
| Frontend | oxlint (linter) | ^1.79.0 |
| Backend | Node.js | 20 (imagem `node:20-slim`) |
| Backend | Fastify (framework HTTP) | ^5.1.0 |
| Backend | `@fastify/jwt` (autenticação) | ^10.2.2 |
| Backend | `@fastify/cors` | ^11.3.0 |
| Backend | Prisma (ORM + migrations) | ^6.19.3 |
| Backend | bcryptjs (hash de senha) | ^2.4.3 |
| Backend | `openai` SDK (módulo IA, ver 2.3.10) | ^7.15.0 |
| Banco | MySQL | 8.0 (imagem oficial `mysql:8.0`) |
| Infra | Docker Compose | orquestra 4 serviços (ver 1.3) |
| Infra | Nginx (`nginx:alpine`) | serve o build estático do frontend |
| Infra | Cloudflare Tunnel (`cloudflared`) | expõe a stack à internet sem abrir portas |
| Infra (produção) | Portainer | gerencia os containers no host de produção — ver `dossie-infraestrutura.md` |

### 1.3 Como o ecossistema funciona (visão de containers)

```
                                    ┌─────────────────────────┐
                                    │   Cloudflare Tunnel      │
                                    │   (container cloudflare) │
                                    └─────────────┬────────────┘
                                                   │
                       Internet ───────────────────┘
                                                   │
        ┌──────────────────────────────────────────────────────────┐
        │                      docker network: sae_net              │
        │                                                            │
        │  ┌────────────┐       ┌────────────┐       ┌────────────┐ │
        │  │  web        │ HTTP  │  api        │ TCP   │  mysql      │ │
        │  │  (nginx)    │──────▶│ (Fastify)   │──────▶│ (MySQL 8)   │ │
        │  │  porta 8081 │ fetch │  porta 3001 │ Prisma│ porta 3306  │ │
        │  │  →  80      │ axios │             │       │             │ │
        │  └────────────┘       └────────────┘       └────────────┘ │
        └──────────────────────────────────────────────────────────┘
```

- **`web`**: build estático do React (Vite `npm run build` → `dist/`) servido por Nginx. O frontend **não fala com o backend em runtime via nome de serviço interno** — ele roda no navegador do usuário final, então a URL da API (`VITE_API_URL`) é **embutida no JavaScript no momento do build** (ver 4.7). Container exposto na porta `8081:80` do host.
- **`api`**: servidor Fastify standalone, escuta na porta `3001` (dentro e fora do container — mapeamento `3001:3001`). Conecta ao MySQL via Prisma Client usando `DATABASE_URL`.
- **`mysql`**: instância MySQL 8 com volume nomeado `sae_mysql_data` (persistência) e diretório `db/init/` montado em `/docker-entrypoint-initdb.d` (hoje vazio — reservado para scripts de inicialização SQL, se um dia forem necessários).
- **`cloudflare`**: túnel Cloudflare que expõe a stack à internet sem precisar abrir portas no roteador/firewall do host. Não depende de porta mapeada; usa `TUNNEL_TOKEN` para autenticar.
- Todos os 4 serviços compartilham a rede bridge definida pelo usuário `sae_net` — o Compose cria automaticamente DNS interno para cada serviço pelo **nome do serviço** (`mysql`, `api`, `web`) e também pelo **`container_name`** (`sae_mysql`, `sae_api`, `sae_web`), já que é uma rede *user-defined* (não a bridge padrão do Docker). Isso é relevante para o troubleshooting de `DATABASE_URL` — ver `dossie-infraestrutura.md`.

### 1.4 Multi-tenant: como o isolamento funciona

O sistema usa **um único banco de dados compartilhado** entre todos os tenants (não schema-per-tenant, não banco-per-tenant). O isolamento é feito por uma coluna `empresa_id` presente em praticamente toda tabela de negócio (`Usuario`, `Produto`, `Venda`, `Cliente`, `Lancamento`, `Tarefa`, `Ingrediente`).

O mecanismo de confiança é **inteiramente centrado no JWT**:

1. No login/registro, o backend assina um JWT contendo `{ sub: usuario.id, empresa_id: usuario.empresaId, role: usuario.role }` (`api/src/services/auth.service.js#gerarToken`).
2. Um hook global `onRequest` (`api/src/plugins/auth.js`) roda **antes de toda rota**, decodifica esse token e injeta `request.tenantId`, `request.userId`, `request.userRole` no objeto da requisição.
3. **Toda** service usa `request.tenantId` (nunca um `empresa_id` vindo do `body`/`query`/`params`) em todo `where` do Prisma — inclusive em `updateMany`/`deleteMany`, que combinam `id` + `empresaId` no mesmo filtro para garantir atomicidade (um `id` de outro tenant simplesmente não bate com nenhuma linha, gerando `count: 0` em vez de vazar/alterar dado de outra empresa).

Rotas que não passam por essa checagem precisam declarar explicitamente `config: { public: true }` (hoje: `GET /health`, `POST /auth/register`, `POST /auth/login`).

---

## 2. Raio-X de Diretórios e Arquivos (Milímetro por Milímetro)

```
SAE/
├── docker-compose.yml        # Orquestra os 4 containers (mysql, api, web, cloudflare)
├── Dockerfile                # ⚠️ ÓRFÃO — não referenciado pelo compose, ver débito técnico 6.9
├── .env / .env.example       # Variáveis usadas pelo docker-compose (raiz)
├── NOTAS_IMPORTANTES.md      # Diário de desenvolvimento cronológico (histórico bruto de tarefas)
├── direcionamento.md         # Este arquivo
├── dossie-infraestrutura.md      # Dossiê de infra/troubleshooting curado
├── db/
│   └── init/                 # Montado em /docker-entrypoint-initdb.d do MySQL — hoje VAZIO
├── api/                      # Backend (Fastify + Prisma)
└── web/                      # Frontend (React + Vite)
```

### 2.1 `api/` — Backend

```
api/
├── Dockerfile              # Imagem de produção: node:20-slim + openssl + prisma generate
├── .dockerignore           # Exclui node_modules/.env da imagem (segredo não vaza pro build)
├── .env / .env.example     # DATABASE_URL, JWT_SECRET, variáveis do módulo IA/WhatsApp
├── package.json            # Scripts (dev/start/prisma:*) e dependências
├── prisma/
│   ├── schema.prisma       # Fonte da verdade do modelo de dados (ver 2.1.1)
│   ├── seed.js             # Popula 1 empresa + 2 usuários + 2 produtos de teste
│   └── migrations/         # Histórico de migrations (só 4 — ver dossie-infraestrutura.md sobre drift)
└── src/
    ├── app.js              # Monta a instância Fastify: parser JSON custom, CORS, plugins, rotas, error handler
    ├── server.js            # Entry point: carrega .env, chama buildApp(), escuta na porta, trata SIGTERM/SIGINT
    ├── plugins/
    │   ├── prisma.js       # Decora fastify.prisma com um PrismaClient único, conecta no boot
    │   └── auth.js         # Registra @fastify/jwt + hook onRequest global de tenant (núcleo do isolamento)
    ├── routes/              # 1 arquivo por recurso — só declara verbo+path, delega ao controller
    ├── controllers/         # Parsing/validação de formato do request, chama a service, monta a resposta HTTP
    ├── services/            # Regra de negócio real + toda chamada ao Prisma
    │   ├── ai/              # Módulo "IA no WhatsApp" — camada de IA (mock/arquitetura, ver 2.3.10)
    │   └── whatsapp/        # Módulo "IA no WhatsApp" — camada de conexão (mock/arquitetura, ver 2.3.10)
    └── utils/
        ├── AppError.js      # Exceção de negócio com statusCode — capturada pelo error handler global
        └── datas.js         # Helpers de limite de mês/dia (UTC vs. fuso local — ver 4.5)
```

#### 2.1.1 `prisma/schema.prisma` — o modelo de dados

Convenção: campos em **camelCase** no Prisma Client, mapeados via `@map`/`@@map` para colunas/tabelas em **snake_case** no MySQL. IDs são `INT UNSIGNED AUTO_INCREMENT` (não `BIGINT UNSIGNED` — ver 4.2 sobre o motivo).

Modelos e como se conectam:

| Model | Tabela | Papel |
|---|---|---|
| `Empresa` | `empresas` | **Raiz do multi-tenant** — `Empresa.id` é o `tenant_id` referenciado por quase tudo. Carrega `plano` (gratuito/apoiador), `segmento` (alimenticio/varejo/servicos/outros — decide features condicionais), `tipoPessoa`+`documento` (CPF/CNPJ). |
| `Usuario` | `usuarios` | Pertence a 1 `Empresa`. `email` único **só dentro da empresa** (`@@unique([empresaId, email])`), não globalmente. `role` (admin/gerente/vendedor) existe no schema mas **não é usado para autorização em lugar nenhum do backend** — ver débito técnico 6.1. |
| `Produto` | `produtos` | Catálogo de venda. `sobDemanda` pula controle de estoque. Relaciona com `VendaItem` (não mais direto com `Venda`) e `FichaTecnica`. |
| `Venda` | `vendas` | Cabeçalho da venda (quem, quando, forma de pagamento). Itens vivem em `VendaItem` (extraído de dentro de `Venda` numa evolução de schema — ver `dossie-infraestrutura.md`, tarefa "Segmentação da Empresa + Venda multi-item"). |
| `VendaItem` | `venda_itens` | 1 produto + quantidade + preço **congelado no momento da venda** (não lê `Produto.precoVenda` depois — histórico financeiro não muda se o preço for reajustado). |
| `Cliente` | `clientes` | Cadastro simples (nome/telefone/email). Vinculado opcionalmente a uma `Venda`. |
| `Tarefa` | `tarefas` | Motor da Agenda — lembretes/eventos manuais. **Só tem rota de leitura** (agregada dentro de `GET /agenda/:mes_ano`); não existe `POST /tarefas` no backend. |
| `Lancamento` | `lancamentos` | Receitas/despesas avulsas do caixa — base do módulo financeiro. CRUD completo desde o início. |
| `Ingrediente` | `ingredientes` | Matéria-prima (só relevante para empresas `segmento === 'alimenticio'`). Estoque próprio, separado do estoque de `Produto`. |
| `FichaTecnica` | `ficha_tecnica` | Tabela associativa `Produto` ↔ `Ingrediente` com `quantidadeUsada` — a "receita" de um produto. |

Enums: `RoleUsuario`, `PlanoEmpresa`, `TipoPessoa`, `TipoTarefa`, `FormaPagamento`, `TipoLancamento` (**MAIÚSCULO** — inconsistência de convenção proposital, registrada no schema), `StatusLancamento` (também maiúsculo).

`Empresa.segmento` é `String` solto (não enum) — validado só na aplicação (`SEGMENTOS_VALIDOS` em `empresa.service.js`), pois o conjunto de valores aceitos pode crescer sem migration.

#### 2.1.2 `src/app.js` — montagem da aplicação

Pontos centrais:
- **Parser de `application/json` customizado**: por padrão o Fastify rejeita corpo vazio com esse Content-Type (400). Como o Axios do frontend sempre manda `Content-Type: application/json`, inclusive em `DELETE` sem corpo, isso é comum — corrigido para tratar corpo vazio como `undefined`.
- **CORS**: `origin: '*'`, métodos `GET/HEAD/POST/PUT/PATCH/DELETE` liberados. **Aberto de propósito para desenvolvimento** — ver débito técnico 6.2.
- **Ordem de registro dos plugins importa**: `prisma` → `auth` → `routes` (rotas dependem de auth, que decora `request`; services dependem de `fastify.prisma`).
- **`setErrorHandler` global**: todo erro lançado em qualquer handler (síncrono ou assíncrono) cai aqui. Erros com `statusCode < 500` (negócio, ex.: `AppError`) são logados como `warn` e devolvem a mensagem real; `statusCode >= 500` são logados como `error` e devolvem `"Erro interno do servidor."` genérico (nunca vaza stack trace pro cliente).

#### 2.1.3 `src/plugins/auth.js` — coração do isolamento multi-tenant

Ver seção 1.4. Tecnicamente: registra `@fastify/jwt` com `secret: process.env.JWT_SECRET`, decora `request` com `tenantId`/`userId`/`userRole` (default `null`), e um hook `onRequest` que verifica o JWT (`request.jwtVerify()`) em toda rota que não tenha `config.public === true`.

#### 2.1.4 Rotas → Controllers → Services (padrão do projeto)

Todo recurso segue o mesmo padrão de 3 camadas:

```
routes/x.routes.js     → só declara fastify.get/post/put/patch/delete(path, controller.metodo)
controllers/x.controller.js → le request.body/params, valida FORMATO (tipo, obrigatoriedade), chama a service, define status code
services/x.service.js       → regra de negócio real, toda chamada ao Prisma, sempre recebe tenantId explícito
```

Nenhuma rota usa prefixo `/api` — todas ficam na raiz (`/auth`, `/produtos`, `/vendas` etc., registradas em `src/routes/index.js`).

Recursos e endpoints:

| Recurso | Arquivo de rota | Endpoints |
|---|---|---|
| Auth | `auth.routes.js` | `POST /auth/register` (público), `POST /auth/login` (público) |
| Produtos | `produtos.routes.js` | `GET/POST /produtos`, `POST /produtos/calcular-preco`, `PUT /produtos/:id`, `PATCH /produtos/:id/estoque`, `DELETE /produtos/:id` |
| Precificação | `precificacao.routes.js` | `POST /precificacao/simular` (cálculo puro, não toca banco) |
| Vendas | `vendas.routes.js` | `GET /vendas`, `GET /vendas/:id`, `POST /vendas` (sem DELETE — preserva histórico) |
| Empresa | `empresa.routes.js` | `GET/PUT /empresa/dados`, `GET/POST /empresa/usuarios`, `PUT /empresa/assinatura` |
| Agenda | `agenda.routes.js` | `GET /agenda/:mes_ano` (formato `MM-AAAA`) |
| Clientes | `clientes.routes.js` | `GET/POST /clientes` (sem PUT/DELETE ainda) |
| Lançamentos | `lancamentos.routes.js` | `GET/POST /lancamentos`, `GET/PUT/DELETE /lancamentos/:id` |
| Relatórios | `relatorios.routes.js` | `GET /relatorios/resumo` (todo plano), `GET /relatorios/dre` (só plano apoiador) |
| Dashboard | `dashboard.routes.js` | `GET /dashboard` |
| Ingredientes | `ingredientes.routes.js` | `GET/POST /ingredientes`, `PUT/DELETE /ingredientes/:id` |

#### 2.1.5 Services — regra de negócio (arquivo a arquivo)

- **`auth.service.js`**: `register` cria `Empresa`+`Usuario` (role `admin`) numa `$transaction` atômica (se o usuário falhar, a empresa também é desfeita — nunca sobra tenant órfão). `login` faz `findFirst` por email (não `findUnique` — email só é único por empresa, não globalmente, ver 4.2) + `bcrypt.compare`.
- **`empresa.service.js`**: dados cadastrais, listagem/adição de usuários (respeitando `LIMITE_USUARIOS_POR_PLANO = { gratuito: 2, apoiador: 5 }`), e troca de plano (`atualizarAssinatura` — "simulada", sem gateway de pagamento real).
- **`produtos.service.js`**: CRUD + `sincronizarFichaTecnica` (substitui a receita inteira a cada update, não faz diff incremental) + `validarSegmentoAlimenticio` (só empresas `alimenticio` podem vincular ingredientes).
- **`vendas.service.js`**: `registrarVenda` é a rotina mais complexa do sistema — dentro de uma `$transaction`: valida forma de pagamento (inclusive as exclusivas do segmento alimentício), usa `SELECT ... FOR UPDATE` por item do carrinho (trava a linha do produto, evita *overselling* em vendas concorrentes), calcula `precoUnitario`/`subtotal`/`total` sempre a partir do `Produto.precoVenda` **atual no banco** (nunca aceita preço vindo do cliente), cria `Venda`+`VendaItem[]`, gera um `Lancamento` automático (exceto para `consumo_interno`/`doacao`, que nunca viram dinheiro no caixa), debita estoque e coleta alertas de estoque baixo (hoje só logados via `fastify.log.warn` — não há notificação real, ver TODO no código).
- **`precificacao.service.js`**: fórmula do "markup divisor" (ver 4.3) em dois modos — simples (`calcularPrecoVenda`) e avançado (`calcularPrecoVendaAvancado`, com 3 sub-modos: percentual, fixo, reverso).
- **`ingredientes.service.js`** / **`clientes.service.js`** / **`lancamentos.service.js`**: CRUD padrão com isolamento de tenant via `updateMany`/`deleteMany` (nunca `update`/`delete` só com `id`).
- **`agenda.service.js`**: unifica `Lancamento` (traduzido: `SAIDA`→`pagamento`, `ENTRADA`→`recebimento`) e `Tarefa` (tipos já batem 1:1) num único array de "Eventos" ordenado por data, com IDs prefixados (`lancamento-{id}`/`tarefa-{id}`) para não colidir entre as duas sequências de auto-increment.
- **`dashboard.service.js`**: 3 queries em paralelo (`Promise.all`) — vendas de hoje (aggregate), estoque baixo (`$queryRaw` cru, porque comparar duas colunas da mesma linha — `estoque_atual <= estoque_minimo` — não é expressável no filtro fluente do Prisma), contas pendentes nos próximos 7 dias.
- **`relatorios.service.js`**: `obterResumo` (livre) e `obterDre` (gate de plano **dentro da service**, não no controller — convenção do projeto para regra ligada a plano).

#### 2.1.6 `src/services/ai/` e `src/services/whatsapp/` — módulo "IA no WhatsApp"

Arquitetura **Strategy/Adapter** pronta, mas **sem integração real** — ver débito técnico 6.6.

- `ai/AiProvider.js`: interface abstrata (`generateResponse(systemPrompt, userMessage)`).
- `ai/OpenAiCompatibleProvider.js`: implementação única que atende tanto a OpenAI real quanto qualquer servidor compatível (Ollama, LM Studio, Groq) via `baseURL` customizável — decidido via env (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`).
- `ai/index.js`: fábrica que expõe `generateResponse` já ligado ao provider configurado.
- `whatsapp/WhatsAppProvider.js`: interface abstrata (`initialize`, `sendMessage`, `onMessageReceived`).
- `whatsapp/BaileysProvider.js` / `whatsapp/MetaApiProvider.js`: **mocks** (só `console.log`, nenhuma biblioteca real instalada) para as duas modalidades anunciadas na página `/modulos` do frontend.
- `whatsapp/index.js`: fábrica (`getWhatsAppProvider`) decidida por `WHATSAPP_PROVIDER` (`baileys`|`meta`) no `.env`.

#### 2.1.7 `src/utils/datas.js`

Dois conjuntos de helpers de limite de mês/dia porque o sistema tem **dois tipos de campo de data com semânticas diferentes**:
- Campos "só calendário" (`dataVencimento`, `dataPagamento`) — gravados como meia-noite **UTC** do dia escolhido. Limites comparados também em UTC.
- Timestamps de verdade (`Venda.data`, `criadoEm`) — hora real do evento, comparados no **fuso local do processo**.

Essa distinção tem um espelho exato no frontend (`web/src/utils/datas.js#dataCalendario`) — ver 4.5.

### 2.2 `web/` — Frontend

```
web/
├── Dockerfile              # Multi-stage: build (node:20-slim + vite build) → runtime (nginx:alpine)
├── nginx.conf              # try_files fallback pra SPA (sem isso, F5 numa rota client-side dá 404)
├── vite.config.js          # plugins: @vitejs/plugin-react + @tailwindcss/vite
├── .env / .env.example     # VITE_API_URL (embutida no bundle em BUILD TIME, não runtime)
├── index.html              # Script inline que aplica o tema salvo ANTES do React montar (evita flash)
└── src/
    ├── main.jsx             # Monta <App/> dentro de AuthProvider > ThemeProvider > ToastProvider
    ├── App.jsx              # Define todas as rotas (react-router-dom)
    ├── index.css            # @import "tailwindcss" + @custom-variant dark (Tailwind v4 é CSS-first)
    ├── services/
    │   └── api.js           # Instância Axios central + apiFetch() (wrapper estilo fetch) + interceptors
    ├── context/
    │   ├── AuthContext.jsx  # usuário/empresa logados, login/register/logout, sincroniza com localStorage
    │   ├── ThemeContext.jsx # tema claro/escuro, aplica classe .dark em <html>
    │   └── ToastContext.jsx # sistema de notificações toast (pilha, auto-dismiss)
    ├── utils/
    │   └── datas.js          # dataCalendario() (corrige deslocamento de fuso) + gerarGradeDoMes()
    ├── components/           # Compartilhados entre páginas (ver 2.2.1)
    └── pages/                # 1 componente por rota (ver 2.2.2)
```

#### 2.2.1 `src/services/api.js` — cliente HTTP central

- `API_BASE_URL` vem de `import.meta.env.VITE_API_URL` (fallback hardcoded para produção).
- Interceptor de **request**: injeta `Authorization: Bearer <token>` lido de `localStorage` em toda chamada — nenhuma tela precisa lembrar de mandar o header manualmente.
- Interceptor de **response**: um `401` só dispara logout global (`sae:unauthorized` — um `CustomEvent`, para evitar import circular com `AuthContext`) se **já existia** um token salvo (senão um 401 de credenciais erradas na própria tela de login também deslogaria).
- `apiFetch(path, options)`: wrapper de compatibilidade com assinatura estilo `fetch` (`{ method, body, headers }`), usado pela maioria das páginas (herança de uma versão anterior que usava `fetch` puro).

#### 2.2.2 `src/context/*`

- **`AuthContext`**: guarda `usuario` (espelhado em `localStorage['sae_usuario']`) e `empresa` (buscada via `GET /empresa/dados` sempre que `usuario` muda — inclui `plano` e `segmento`, lidos por quase todo o resto do app para gating condicional). Expõe `login`, `register`, `logout`, `refreshEmpresa` (chamado manualmente após qualquer PUT que altere dados da empresa, para não esperar um novo login).
- **`ThemeContext`**: tema claro/escuro, persistido em `localStorage['sae_theme']`, aplica/remove a classe `.dark` em `<html>`.
- **`ToastContext`**: pilha de notificações (`mostrarToast(mensagem, tipo, duracaoMs)`), única biblioteca de notificação do projeto (criada do zero, sem dependência nova).

#### 2.2.3 `src/components/` — compartilhados

| Componente | Papel |
|---|---|
| `Layout.jsx` | Casca visual: Sidebar fixa + `<main>` com margem esquerda condicional (`isExpanded`), drawer mobile abaixo do `md`. |
| `Sidebar.jsx` | Menu lateral com 2 categorias em accordion (Operacional, Administração) + itens diretos (Dashboard, Módulos, Suporte) + tema/config/logout no rodapé. |
| `PrivateRoute.jsx` | Guard de rota — redireciona pra `/login` se `!estaAutenticado`. |
| `AuthLayout.jsx` | Casca visual compartilhada por Login/Cadastro (painel de marca + formulário). |
| `CampoTexto.jsx` | Input de texto padronizado (label, ícone, erro, slot para adorno). |
| `CampoData.jsx` | **Date picker custom** (substitui `<input type="date">` nativo — o popup nativo não respeita o tema escuro do app). |
| `Placeholder.jsx` | Esqueleto "Em construção" genérico para telas sem funcionalidade ainda. |
| `Switch.jsx` | Toggle booleano reutilizável. |
| `TipoPessoaToggle.jsx` | Pílula PF/PJ (usado no Cadastro e em Configurações, disabled). |
| `produtos/ModalProduto.jsx` | Modal de criar/editar produto — inclui Ficha Técnica (só segmento alimentício) e botão que abre `ModalCalculadoraLucros`. |
| `produtos/CalculadoraLucros.jsx` | Núcleo da calculadora — bidirecional (editar lucro → calcula preço; editar preço → calcula lucro reverso), reaproveitado em `/precificacao` e no modal embutido. |
| `produtos/ModalCalculadoraLucros.jsx` | Wrapper de modal para `CalculadoraLucros` em modo embutido. |
| `vendas/SeletorCliente.jsx` | Dropdown custom para atrelar cliente a uma venda no PDV. |
| `vendas/ModalDetalhesVenda.jsx` | Modal somente-leitura com itens de uma venda. |
| `clientes/ModalClienteRapido.jsx` | Modal de cadastro rápido de cliente (reaproveitado no PDV e na tela de Clientes). |
| `lancamentos/ModalLancamento.jsx` | Modal de criar/editar lançamento (rótulo do campo de data muda dinamicamente conforme tipo/status). |
| `agenda/ModalLembrete.jsx` | Modal de criar lembrete — **só grava em memória local**, não persiste (ver débito técnico 6.4). |
| `estoque/EstoqueProdutos.jsx` | Aba "Produtos" de `/estoque` — ajuste rápido via `PATCH /produtos/:id/estoque`. |
| `estoque/EstoqueIngredientes.jsx` | Aba "Ingredientes" (só segmento alimentício) — lista + cálculo de "Autonomia de Produção" (menor `estoqueAtual / quantidadeUsada` entre os ingredientes da Ficha Técnica). Sem UI de criar/editar ingrediente — ver débito técnico 6.5. |
| `configuracoes/DadosDaLoja.jsx` | Formulário de dados cadastrais (`PUT /empresa/dados`). |
| `configuracoes/UsuariosEquipe.jsx` | Lista de equipe + contador de limite do plano — bloqueada inteira para plano `gratuito`. Convite ainda é só visual. |
| `configuracoes/Assinatura.jsx` | Upgrade/downgrade de plano real (`PUT /empresa/assinatura`). |
| `relatorios/RelatoriosSimples.jsx` | Variante do plano gratuito (totais do mês + banner de upsell). |
| `relatorios/RelatoriosAvancados.jsx` | Variante do plano apoiador (DRE + gráfico Recharts). |

#### 2.2.4 `src/pages/` — 1 por rota

| Página | Rota | Backend consumido |
|---|---|---|
| `Login.jsx` | `/login` | `POST /auth/login` |
| `Cadastro.jsx` | `/cadastro` | `POST /auth/register` |
| `Dashboard.jsx` | `/` | `GET /dashboard` |
| `Vendas.jsx` | `/vendas` | `GET /produtos`, `GET /clientes`, `GET /empresa/usuarios`, `POST /vendas`, `POST /clientes` |
| `HistoricoVendas.jsx` | `/historico-vendas` | `GET /vendas` |
| `Produtos.jsx` | `/produtos` | `GET/POST/PUT/DELETE /produtos` |
| `CalculadoraPrecificacao.jsx` | `/precificacao` | (delega para `CalculadoraLucros`, que chama `POST /produtos/calcular-preco`) |
| `Estoque.jsx` | `/estoque` | (delega para `EstoqueProdutos`/`EstoqueIngredientes`) |
| `Clientes.jsx` | `/clientes` | `GET/POST /clientes` |
| `Lancamentos.jsx` | `/lancamentos` | `GET/POST/PUT /lancamentos` (**sem** botão de excluir na UI, embora `DELETE` exista no backend — débito 6.3) |
| `ControleFinanceiro.jsx` | `/financeiro` | `GET /lancamentos` (agrega tudo em memória no frontend) |
| `Notas.jsx` | `/notas` | nenhum (página bloqueada, módulo fiscal não implementado) |
| `Agenda.jsx` | `/agenda` | `GET /agenda/:mes_ano`, `PUT /lancamentos/:id` (dar baixa) |
| `Relatorios.jsx` | `/relatorios` | decide entre `RelatoriosSimples`/`RelatoriosAvancados` conforme `empresa.plano` |
| `Configuracoes.jsx` | `/configuracoes` | `GET /empresa/dados`, `GET /empresa/usuarios` (lazy por aba, com cache em estado) |
| `Modulos.jsx` | `/modulos` | nenhum (vitrine comercial, "Tenho Interesse" só muda estado local) |
| `Suporte.jsx` | `/suporte` | nenhum (formulário sem backend, só simula envio) |

---

## 3. Fluxos e Regras de Negócio

### 3.1 Ciclo de vida de uma requisição autenticada

```
Cliente (axios) ──▶ Rota Fastify ──▶ Hook onRequest (auth.js)
                                         │
                          JWT válido? ───┼─── Não ──▶ 401 { error: "Token ausente, inválido ou expirado." }
                                         │
                                        Sim
                                         │
                          request.tenantId/userId/userRole populados
                                         │
                                         ▼
                                    Controller
                          (valida formato do body/params, 400 se inválido)
                                         │
                                         ▼
                                     Service
                    (regra de negócio, SEMPRE filtrando por tenantId,
                     lança AppError(mensagem, statusCode) se algo é inválido)
                                         │
                                         ▼
                                Prisma Client → MySQL
                                         │
                          ┌──────────────┴──────────────┐
                          │ sucesso                     │ erro (AppError ou outro)
                          ▼                              ▼
                 Controller monta resposta      setErrorHandler global (app.js)
                 reply.code(2xx).send(dados)    reply.code(err.statusCode||500).send({error})
```

### 3.2 Fluxo de Venda (PDV) — o mais crítico do sistema

1. `Vendas.jsx` monta um carrinho **em memória** (estado local React) a partir do catálogo (`GET /produtos`).
2. "Finalizar Venda" dispara **uma única** `POST /vendas` com `{ itens: [{produto_id, quantidade}], forma_pagamento, data, cliente_id?, funcionario_id? }`.
3. `vendas.service.js#registrarVenda` roda tudo dentro de **uma transação Prisma**:
   - Valida `forma_pagamento` (inclusive gate de segmento para `consumo_interno`/`doacao`).
   - Para cada item: `SELECT ... FOR UPDATE` (trava a linha do produto — impede overselling em concorrência), confere estoque (pula se `sobDemanda`), calcula preço a partir do banco (nunca do cliente).
   - Cria `Venda` + `VendaItem[]`.
   - Gera `Lancamento` automático de `ENTRADA` (status `PAGO` se a forma paga no ato, `PENDENTE` se `pendente`) — **exceto** para `consumo_interno`/`doacao`.
   - Debita estoque de cada item (produtos não-`sobDemanda`) e coleta alertas de estoque baixo (só logados, sem notificação real).
4. Resposta inclui `venda` (com itens/cliente/vendedor populados), `lancamento` (ou `null`) e `alertasEstoqueBaixo`.

### 3.3 Fluxo de Precificação (markup divisor)

A fórmula central do sistema (usada tanto em `/precificacao` quanto no modal embutido do cadastro de produto):

```
precoVenda = custo / (1 - taxaMaquininha% - margemLucro%)
```

Importante: taxa e margem são percentuais do **preço de venda final**, não do custo — por isso a divisão, não uma soma simples (`custo * (1 + taxa + margem)` subestimaria o preço necessário). O modo avançado (`POST /produtos/calcular-preco`) tem 3 variantes: `percentual` (igual à fórmula acima), `fixo` (lucro em R$, não %) e `reverso` (usuário digita o preço final, sistema calcula o lucro resultante).

### 3.4 Gating por plano e por segmento

- **Plano `gratuito` vs `apoiador`**: controla limite de usuários da equipe (2 vs 5), acesso ao DRE/gráfico avançado (`GET /relatorios/dre` — 403 se não for apoiador), e acesso à aba inteira de "Equipe" em Configurações.
- **`Empresa.segmento === 'alimenticio'`**: desbloqueia Ficha Técnica de ingredientes em Produto, e as formas de pagamento `consumo_interno`/`doacao` em Venda, e a aba "Ingredientes" em Estoque.
- Em **ambos os casos**, a regra é validada no **backend** (nunca só escondida na UI) — um request forjado contra um plano/segmento errado recebe `403` de verdade.

### 3.5 Fluxo da Agenda

`GET /agenda/:mes_ano` (`agenda.service.js`) busca `Lancamento` e `Tarefa` do mês em paralelo, traduz cada um para um formato unificado de "Evento" (`{id, titulo, descricao, dataVencimento, tipo, statusConcluida, valor}`), concatena e reordena por data. "Dar baixa" num evento de Lançamento dispara `PUT /lancamentos/:id` de verdade; num evento de Tarefa/lembrete local, só atualiza o estado em memória do React (sem persistência — ver 6.4).

---

## 4. Decisões de Engenharia

### 4.1 Por que Prisma (e não Knex, que o projeto usou antes)

O histórico do projeto (`NOTAS_IMPORTANTES.md`, seção "Migração de Knex para Prisma") mostra que o sistema **começou com Knex** e migrou para Prisma no mesmo dia. Motivos práticos capturados no schema: tipagem automática do client, migrations versionadas, e um schema declarativo único como fonte da verdade (`schema.prisma`), evitando SQL espalhado em query builders.

### 4.2 Convenções de schema

- **`INT UNSIGNED` em vez de `BIGINT UNSIGNED`** para todo PK/FK: o Prisma mapeia `BIGINT` para o tipo `BigInt` do JavaScript, que **não serializa em JSON por padrão** (quebra `JSON.stringify`/`reply.send` com "Do not know how to serialize a BigInt"), exigindo conversão manual em toda rota. `INT UNSIGNED` já mapeia para `number` comum e suporta ~4,29 bilhões de linhas — de sobra para o domínio (SaaS de pequenos negócios).
- **`Decimal`, nunca `Float`, para dinheiro** (`custo`, `precoVenda`, `valor`, `valorContribuicao` etc.) — evita os erros clássicos de ponto flutuante binário (`0.1 + 0.2 !== 0.3`).
- **`@map`/`@@map`** em todo campo/tabela: Prisma Client usa `camelCase` (idiomático em JS), MySQL usa `snake_case` (convenção já estabelecida no projeto antes da migração).
- **Enums em MAIÚSCULO** só em `TipoLancamento`/`StatusLancamento` — inconsistência **proposital**, registrada como tal no schema (foi um valor pedido explicitamente numa tarefa específica, não um esquecimento).
- **Campos como `segmento` são `String` solto, não `enum`**: a validação do conjunto de valores aceitos mora na aplicação (`SEGMENTOS_VALIDOS`), não no banco — permite adicionar um segmento novo sem migration.

### 4.3 Isolamento multi-tenant via `tenantId` explícito (não Row-Level Security do MySQL)

MySQL não tem RLS nativo (diferente de Postgres). A decisão de engenharia foi **disciplina de código**: toda service recebe `tenantId` como parâmetro explícito e o inclui em **todo** `where`. Updates/deletes usam `updateMany`/`deleteMany` com `{id, empresaId}` combinados no filtro em vez de `update`/`delete` só com `id`, para que o isolamento seja garantido **atomicamente pelo próprio banco** (um id de outro tenant não bate com nenhuma linha), não por uma checagem separada sujeita a race condition ou esquecimento.

### 4.4 `AppError` + `setErrorHandler` centralizado

Em vez de `try/catch` espalhado em cada controller, services lançam `AppError(mensagem, statusCode)` para qualquer situação de negócio inválida, e um único `setErrorHandler` em `app.js` decide status/log/formato de resposta para **toda** a API. Fastify já captura automaticamente qualquer exceção síncrona/assíncrona de um handler — replicar try/catch manual seria código morto duplicando isso.

### 4.5 Dois tratamentos de data diferentes, de propósito

O sistema distingue explicitamente:
- **Campos "só calendário"** (`dataVencimento`, `dataPagamento`, `dataCadastro`) — gravados como meia-noite **UTC** do dia escolhido pelo usuário (`new Date('2026-09-08')` no Node sempre vira meia-noite UTC). Lidos de volta no frontend via `dataCalendario()` (`web/src/utils/datas.js`), que reconstrói a data a partir dos **componentes UTC**, ancorados na meia-noite **local** — evitando que o dia "vaze" para o dia anterior em fusos atrás de UTC (ex.: Brasília).
- **Timestamps de verdade** (`Venda.data`, `criadoEm`, `atualizadoEm`) — hora real do evento, tratados no fuso local sem nenhum truque.

Essa distinção existe **em espelho** no backend (`api/src/utils/datas.js`, duas famílias de helpers de limite de mês) e no frontend — qualquer novo campo de data precisa ser classificado corretamente num dos dois grupos.

### 4.6 Autenticação via JWT stateless + `localStorage`

Token JWT (`@fastify/jwt`) assinado com `JWT_SECRET`, `expiresIn` configurável (`JWT_EXPIRES_IN`, default `8h`). Carrega `sub` (id do usuário), `empresa_id` (tenant) e `role`. Guardado em `localStorage` no frontend (chaves `sae_token`/`sae_usuario`), injetado automaticamente pelo interceptor do Axios. Trade-off conhecido: `localStorage` é acessível via JavaScript (risco de XSS) — ver 6.7.

### 4.7 Variáveis `VITE_*` são resolvidas em **build time**, não runtime

Diferente do backend (que lê `process.env` em runtime), o Vite **embute** o valor de `VITE_API_URL` diretamente no JavaScript gerado por `npm run build`. Isso significa que o `web/.env` precisa existir **antes** do build (não em runtime do container Nginx), e qualquer mudança de endereço da API **exige rebuildar a imagem `web`**, não só reiniciar o container. Documentado em detalhe em `dossie-infraestrutura.md`.

### 4.8 Tailwind v4 "CSS-first" — sem `tailwind.config.js`

O projeto não tem arquivo de config JS do Tailwind porque a v4 move a configuração para CSS (`@import "tailwindcss"` + `@custom-variant dark (&:where(.dark, .dark *))` em `index.css`). O modo escuro responde a uma classe `.dark` em `<html>` (controlada por `ThemeContext`), não a `prefers-color-scheme` diretamente — embora a preferência do sistema seja usada como fallback inicial.

### 4.9 Sem biblioteca de datas (date-fns, dayjs etc.)

Decisão explícita registrada no código: toda manipulação de calendário necessária (grade de mês, formatação `dd/mm/aaaa`, navegação de mês) é trivial com `Date` nativo — uma lib traria pouco ganho para o escopo atual. Se o escopo crescer (fusos múltiplos, recorrência de eventos), essa decisão deve ser revisitada.

### 4.10 Padrão Strategy/Adapter para integrações externas (IA e WhatsApp)

Mesmo sem implementação real ainda, os módulos `services/ai/` e `services/whatsapp/` já isolam o consumidor por trás de uma interface abstrata (`AiProvider`, `WhatsAppProvider`). Trocar de provedor (ex.: Ollama → OpenAI real; Baileys → API oficial Meta) é uma mudança de variável de ambiente, não de código-cliente — arquitetura pronta para a próxima etapa (implementação real), documentada como tal nos próprios arquivos.

### 4.11 CSV export sem biblioteca

`Lancamentos.jsx#gerarCsv` monta o CSV manualmente (separador `;` por causa do padrão decimal brasileiro em Excel, BOM UTF-8 para acentuação correta) e dispara o download via `Blob` + link temporário — nenhuma dependência nova instalada para uma necessidade pontual.

---

## 5. Convenções de Código Observadas

- **Nomes de variáveis, comentários e mensagens de erro em português** (o domínio e o público são brasileiros) — inclusive nomes de arquivo em `snake_case`/`dot-case` no backend (`agenda.controller.js`, não `agendaController.js`).
- **Body em `snake_case` na API** (`nome_empresa`, `forma_pagamento`, `data_vencimento`), desestruturado para `camelCase` logo no controller — o contrato HTTP é snake_case, o código interno é camelCase.
- **Atualização parcial em todo endpoint de update** (`PUT` se comporta como `PATCH` na prática): só os campos presentes no body são alterados.
- **Todo componente de modal segue o mesmo esqueleto**: overlay `fixed inset-0` + `role="dialog"` + fecha com `Escape`/clique fora + `onClick={stopPropagation}` no conteúdo.
- **Estados "carregando"/"erro" replicados manualmente em cada página** — não há biblioteca de data-fetching (React Query, SWR); todo fetch usa `useEffect` + `apiFetch` + 3 `useState` (dado, carregando, erro) com uma flag `ativo` para evitar `setState` após unmount.

---

## 6. Roadmap e Débitos Técnicos

Levantamento feito a partir de comentários `TODO` no código, funcionalidades visivelmente mockadas, e lacunas identificadas comparando schema/backend/frontend:

1. **`RoleUsuario` (admin/gerente/vendedor) não é aplicado em nenhum lugar da API.** `request.userRole` é decodificado do JWT e injetado em toda requisição, mas **nenhuma rota o consulta** para restringir ações. Hoje, qualquer usuário autenticado — inclusive `vendedor` — pode chamar `PUT /empresa/assinatura`, `POST /empresa/usuarios`, `DELETE /produtos/:id` etc. Implementar um middleware/decorator de autorização por role é o débito mais crítico de segurança do sistema.
2. **CORS totalmente aberto (`origin: '*'`)** em `api/src/app.js`, comentado no próprio código como "só para desenvolvimento" — precisa virar uma allowlist de origens confiáveis (ex.: via `CORS_ORIGIN` no `.env`) antes de qualquer deploy que leve a sério a superfície de ataque.
3. **`Lancamentos.jsx` não tem botão de excluir**, embora `DELETE /lancamentos/:id` exista e funcione no backend (controller/service/rota completos) — funcionalidade pronta e não exposta na UI.
4. **`ModalLembrete.jsx` (Agenda) não persiste nada** — o model `Tarefa` existe no schema e é lido via `GET /agenda/:mes_ano`, mas não existe `POST /tarefas` no backend. Lembretes criados pelo usuário vivem só no estado React da sessão atual e desaparecem no reload.
5. **Não existe UI para criar/editar/excluir `Ingrediente`** — o backend tem CRUD completo (`POST/PUT/DELETE /ingredientes`), mas `EstoqueIngredientes.jsx` só lista (leitura). Hoje não há nenhuma forma de cadastrar um ingrediente pela interface.
6. **Módulo "IA no WhatsApp" é arquitetura pura, sem integração real** — `BaileysProvider`/`MetaApiProvider` só logam no console (`console.log`), nenhuma biblioteca de WhatsApp foi instalada, e `OpenAiCompatibleProvider` funciona mas não é consumido por nenhuma rota/fluxo de produto ainda. A página `/modulos` vende essa funcionalidade como "Em breve".
7. **Módulo Fiscal (NFe/NFCe) não existe** — página `/notas` é deliberadamente uma "página bloqueada", sem nenhum código de emissão fiscal.
8. **Página `/suporte` não tem backend** — formulário "envia" só mudando estado local, nada é persistido nem realmente enviado a lugar nenhum.
9. **Exportação de Relatórios é mock** — botão "Exportar Dados" em `Relatorios.jsx` simula 2s de "Gerando arquivo..." sem gerar nada; o filtro de período (`dataInicial`/`dataFinal`) fica guardado em estado mas não é usado por `RelatoriosSimples`/`RelatoriosAvancados` nem enviado à API.
10. **Coluna "Total Comprado" em `Clientes.jsx`** é permanentemente "Em breve" — não existe endpoint de agregação de vendas por cliente.
11. **Convite de usuário em `UsuariosEquipe.jsx` é só visual** — `POST /empresa/usuarios` existe e funciona no backend, mas o botão "Convidar Usuário" no frontend só mostra um aviso, sem formulário real conectado.
12. **`Dockerfile` na raiz do repositório é órfão** — não é referenciado por `docker-compose.yml` (que builda a partir de `./api` e `./web`) e está **dessincronizado** do `api/Dockerfile` real (falta `apt-get install openssl` e `npx prisma generate`, que existem no Dockerfile usado de verdade). Risco de confusão para quem tentar buildar a partir da raiz manualmente. Candidato a remoção.
13. **`login` usa `findFirst` por email, não `findUnique`** — porque `Usuario.email` só é único por empresa (`@@unique([empresaId, email])`), não globalmente. Em teoria, dois tenants diferentes podem ter usuários com o mesmo e-mail, e o login sempre pega a primeira ocorrência. Documentado como aceitável no código atual, mas é uma limitação estrutural do fluxo self-service de cadastro.
14. **Sem paginação em nenhuma listagem** (`/produtos`, `/vendas`, `/lancamentos`, `/clientes`, `/ingredientes`) — assume-se volume pequeno (loja de pequeno porte). Filtros em `Lancamentos.jsx`/`ControleFinanceiro.jsx` são calculados **inteiramente no frontend** sobre a lista completa trazida da API.
15. **Nenhum teste automatizado encontrado no repositório** (sem diretório `test/`, sem `jest`/`vitest` nas dependências) — toda validação histórica documentada em `NOTAS_IMPORTANTES.md` foi manual (Playwright ad-hoc ou chamadas HTTP diretas durante a sessão de desenvolvimento, não testes que rodam em CI).
16. **Migrations do Prisma fora de sincronia com o schema em produção** (histórico de *drift* corrigido localmente via `prisma db push --accept-data-loss` — ver `dossie-infraestrutura.md`, seção 2.2) — o ambiente de produção precisa da mesma correção aplicada e confirmada antes de se considerar resolvido lá.
17. **Alertas de estoque baixo só são logados (`fastify.log.warn`)**, nunca notificados de verdade — há um `TODO` explícito no código (`vendas.service.js`) para substituir por e-mail/push/webhook.
18. **JWT em `localStorage`** (não em cookie `httpOnly`) — decisão simples de implementar, mas exposta a XSS se algum dia um vetor de injeção de script aparecer no frontend.
