# Deploy do Cloudflare Worker

## 1. Instalar Wrangler CLI
```bash
npm install -g wrangler
```

## 2. Login no Cloudflare
```bash
wrangler login
```

## 3. Deploy do Worker
```bash
cd cloudflare
wrangler deploy
```

Isso vai gerar uma URL tipo:
`https://netipflix-proxy.YOURNAME.workers.dev`

## 4. Anotar a URL do Worker

Copie a URL que aparecer após o deploy e me envie.
Vou configurar o app para usar essa URL.

---

**Depois:**
- Deploy do app no Cloudflare Pages
- Usuário acessa direto a URL
- Tudo funciona automaticamente
