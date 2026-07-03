# 🐾 Pet Gestor — Guia de Configuração no VSCode

## Passo 1 — Abrir o projeto

```
Arquivo → Abrir Pasta → selecione a pasta pet-gestor
```

---

## Passo 2 — Instalar dependências

Abra o terminal no VSCode: `Ctrl + \`` (backtick)

```bash
npm install
```

---

## Passo 3 — Criar o banco no Supabase

1. Acesse https://supabase.com e crie uma conta gratuita
2. Clique em **New Project**
   - Nome: `pet-gestor`
   - Senha: crie uma senha forte (anote!)
   - Região: **South America (São Paulo)**
3. Aguarde ~2 minutos
4. Vá em **SQL Editor → New Query**
5. Cole o conteúdo de `supabase/schema_v1.sql` → clique **Run**
6. Crie outra query, cole `supabase/schema_v2.sql` → clique **Run**
7. Vá em **Authentication → Settings**
   - Desative **"Enable email confirmations"** (para facilitar testes)
   - Salve

---

## Passo 4 — Pegar as credenciais do Supabase

Em **Settings → API** copie:
- **Project URL** → ex: `https://abcxyz.supabase.co`
- **anon / public key** → começa com `eyJ...`
- **service_role key** → começa com `eyJ...` (diferente da anon)

Em **Authentication → Users** (após criar sua conta pelo app):
- Copie seu **User UID** (para o Admin Master)

---

## Passo 5 — Configurar o .env

No VSCode, copie o arquivo `.env.example` e renomeie para `.env`:

```bash
cp .env.example .env
```

Abra o `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_KEY=eyJ...sua_anon_key...
VITE_ADMIN_UID=uuid-do-seu-usuario
VITE_SUPABASE_SERVICE_KEY=eyJ...service_role_key...
```

---

## Passo 6 — Gerar os ícones do PWA

```bash
npm run icons
```

Isso cria a pasta `public/icons/` com todos os tamanhos necessários.

---

## Passo 7 — Rodar o projeto

```bash
npm run dev
```

Abra no navegador: http://localhost:5173

---

## Passo 8 — Criar sua conta no app

1. Acesse http://localhost:5173
2. Clique em **Criar conta**
3. Informe e-mail, senha e nome da loja
4. Clique em **Criar minha loja**
5. Configure as informações da loja na tela de setup

---

## Passo 9 — Verificar o Admin Master

Após criar sua conta:
1. Vá no Supabase → **Authentication → Users**
2. Copie seu **User UID**
3. Cole no `.env` em `VITE_ADMIN_UID`
4. Reinicie o servidor (`Ctrl+C` e `npm run dev`)
5. Vai aparecer a aba **👑 Admin** no menu

---

## Passo 10 — Deploy na Vercel (produção)

```bash
# Instala a CLI da Vercel
npm install -g vercel

# Sobe o projeto
vercel

# Siga o wizard e adicione as variáveis de ambiente quando pedido
```

**OU via GitHub:**
1. Suba o projeto no GitHub
2. Acesse vercel.com → New Project → importe o repositório
3. Em **Environment Variables** adicione as 4 variáveis do .env
4. Clique em Deploy

---

## Estrutura de arquivos

```
pet-gestor/
├── src/
│   ├── App.jsx              ← App principal (PDV, Estoque, Caixa, Auth)
│   ├── modules.jsx          ← Planos, CSV, Relatório, Admin, Funcionários
│   ├── main.jsx             ← Entry point + Service Worker
│   ├── components/
│   │   └── PWABanner.jsx    ← Banner instalar/offline/atualizar
│   └── hooks/
│       └── usePWA.js        ← Hook do PWA
├── supabase/
│   ├── schema_v1.sql        ← Tabelas base (rode primeiro)
│   └── schema_v2.sql        ← Assinaturas, movimentações (rode depois)
├── public/
│   └── icons/               ← Gerado pelo: npm run icons
├── index.html               ← Meta tags PWA
├── vite.config.js           ← Config Vite + PWA
├── package.json             ← Dependências
├── generate-icons.mjs       ← Script gerador de ícones
├── .env.example             ← Modelo das variáveis de ambiente
├── .env                     ← Suas credenciais (não commitar!)
└── .gitignore
```

---

## Problemas comuns

**"Invalid API key"**
→ Verifique se as variáveis no `.env` estão corretas e sem espaços

**Login não funciona**
→ Vá no Supabase → Authentication → Settings → desative confirmação de e-mail

**Produtos não aparecem**
→ Certifique-se de que rodou os dois schemas SQL (v1 e v2)

**PWA não instala**
→ O PWA só funciona com HTTPS. Em desenvolvimento use `npm run preview` ou deploy na Vercel

**Admin Master não aparece**
→ Confirme que o `VITE_ADMIN_UID` no `.env` é exatamente igual ao User UID no Supabase
