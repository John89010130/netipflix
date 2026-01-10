# 📺 Netipflix - Plataforma IPTV Multiplataforma

Plataforma completa de streaming IPTV com suporte para Web, Android, Desktop e Samsung TV.

## 🎯 Plataformas Suportadas

- 🌐 **Web** (Progressive Web App)
- 📱 **Android** (APK via Capacitor)
- 💻 **Desktop** (Windows/Linux/Mac via Electron)
- 📺 **Samsung TV** (Tizen Web App)

---

## 🚀 Instalação Rápida

### Web (Navegador)
Acesse: https://seu-dominio.com

### Android (APK)
1. Ative "Fontes desconhecidas" no Android
2. Instale o APK
3. Abra o app

### Desktop (Windows/Linux/Mac)
1. Execute o instalador para sua plataforma
2. Abra o Netipflix

### 📺 Samsung TV (Tizen)
Veja: [**INSTALACAO-TV-RAPIDA.md**](./INSTALACAO-TV-RAPIDA.md) ou [**README-TIZEN.md**](./README-TIZEN.md)

**Resumo:**
```bash
npm run tizen:build        # ou execute build-tizen.bat
# Copie Netipflix.wgt para PENDRIVE/userwidget/
# Conecte na TV e instale
```

---

## 🛠️ Desenvolvimento

### Pré-requisitos
- Node.js 18+ ([instalar com nvm](https://github.com/nvm-sh/nvm))
- npm ou bun

### Setup

### Setup

```sh
# Clone o repositório
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Instale dependências
npm install

# Inicie servidor de desenvolvimento
npm run dev
```

### Build para Produção

```sh
# Web
npm run build

# Android (APK)
cd android
./gradlew assembleDebug

# Desktop (Electron)
npm run electron:build:win   # Windows
npm run electron:build:linux # Linux
npm run electron:build:mac   # Mac

# Samsung TV (Tizen)
npm run tizen:build           # Windows
npm run tizen:build:unix      # Linux/Mac
```

---

## 📚 Documentação Adicional

- [Como Usar](./COMO-USAR.md) - Guia completo de uso
- [Samsung TV](./README-TIZEN.md) - Instalação detalhada na Samsung TV
- [Instalação Rápida TV](./INSTALACAO-TV-RAPIDA.md) - Guia rápido Samsung TV
- [Classificação Automática](./CLASSIFICACAO_AUTOMATICA.md)
- [Deploy Cloudflare](./cloudflare/README.md)

---

## 🔧 Tecnologias

- **Frontend:** React + TypeScript + Vite
- **Styling:** TailwindCSS + Shadcn/ui
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Video:** HLS.js + mpegts.js
- **Android:** Capacitor
- **Desktop:** Electron
- **Samsung TV:** Tizen Web App

---

## 📝 Licença

Projeto privado - Todos os direitos reservados
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
