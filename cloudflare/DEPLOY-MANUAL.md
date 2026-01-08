# Deploy Manual do Worker (Sem CLI)

## Opção 1: Pelo Dashboard do Cloudflare

1. Acesse: https://dash.cloudflare.com
2. Vá em **Workers & Pages** → **Create Application**
3. Escolha **Create Worker**
4. Nome: `netipflix-proxy`
5. Clique em **Deploy**
6. Clique em **Edit Code**
7. Apague tudo e cole o código de `worker.js`
8. Clique em **Save and Deploy**
9. Copie a URL que aparecer (tipo: `https://netipflix-proxy.YOURNAME.workers.dev`)

## Opção 2: Atualizar Node.js e usar CLI

```bash
# Baixe Node.js 20+ de: https://nodejs.org
# Depois:
npm install -g wrangler
wrangler login
wrangler deploy
```

---

**Depois de obter a URL do Worker:**

Me envie a URL e vou configurar o app para usar ela automaticamente.
