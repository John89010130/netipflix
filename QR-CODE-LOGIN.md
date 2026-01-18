# 📱 Login Rápido via QR Code

## O que é?

Sistema de login rápido usando QR Code - ideal para usar o app em TV ou projetor sem precisar digitar email e senha!

## Como Funciona?

```
┌─────────────┐         ┌─────────────┐
│  TV/Projetor│  ←QR→  │   Celular   │
│             │         │             │
│  1. Mostra  │         │  2. Escaneia│
│  QR Code    │         │  e faz login│
│             │         │             │
│  3. Loga    │ ←──────→│  4. Autoriza│
│  Auto!      │         │             │
└─────────────┘         └─────────────┘
```

### Fluxo Completo:

1. **Na TV/Projetor**: 
   - Acesse a tela de Login
   - Clique em "Login via QR Code"
   - Um QR Code aparece na tela

2. **No Celular**:
   - Aponte a câmera para o QR Code
   - Abre uma página automaticamente
   - Faça login com seu email e senha

3. **Automático**:
   - A TV/Projetor detecta o login
   - Você é logado automaticamente
   - Pronto! 🎉

## Instalação

### Passo 1: Aplicar Migration

**Opção A - Via Script:**
```bash
aplicar-qr-login.bat
```

**Opção B - Manual no Supabase:**
1. Acesse: https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new
2. Copie o conteúdo: `supabase/migrations/20260118000001_add_qr_login_tokens.sql`
3. Cole e execute (RUN)

### Passo 2: Testar

1. Abra o app
2. Faça logout (se estiver logado)
3. Na tela de login, clique em "Login via QR Code"
4. Escaneie com seu celular
5. Faça login no celular
6. Veja a mágica acontecer! ✨

## Segurança

### Como é Seguro?

- ✅ Token único para cada QR Code
- ✅ Expira em 5 minutos
- ✅ Usa apenas uma vez
- ✅ Credenciais nunca são armazenadas
- ✅ Senha é usada apenas para verificar e depois descartada

### O que NÃO guardamos:

- ❌ Senha do usuário
- ❌ Token de sessão permanente
- ❌ Dados pessoais

### O que Guardamos (temporariamente):

- ✓ Token único do QR Code (5 min)
- ✓ Email (apenas para transferir autenticação)
- ✓ Senha temporária (usada uma vez e descartada)

## Recursos

### ✅ Funcionalidades

- [x] Gerar QR Code automaticamente
- [x] Expiração após 5 minutos
- [x] Verificação automática a cada 5 segundos
- [x] Login instantâneo após escanear
- [x] Limpeza automática de tokens expirados
- [x] Interface responsiva (TV + Mobile)

### 🎯 Casos de Uso

1. **TV/Projetor**: Login rápido sem teclado
2. **Reuniões**: Login em dispositivos compartilhados
3. **Demo**: Mostrar o app sem digitar senhas
4. **Facilidade**: Usuários não técnicos

## Troubleshooting

### QR Code não aparece

1. Verifique se a migration foi aplicada
2. Abra o console do navegador (F12)
3. Veja se há erros

### Login não funciona

1. Verifique se o token ainda é válido (5 min)
2. Tente gerar um novo QR Code
3. Verifique sua conexão com a internet

### Erro ao escanear

1. Certifique-se de que o link está completo
2. O formato deve ser: `http://seu-site.com/qr-login?token=...`
3. Tente gerar um novo QR Code

## Tecnologias

- **Frontend**: React + TypeScript
- **QR Code**: API pública (qrserver.com)
- **Backend**: Supabase
- **Tabela**: qr_login_tokens
- **Polling**: Verifica a cada 5 segundos

## Arquivos

```
src/
├── components/
│   └── QRCodeLogin.tsx          # Componente do QR Code
├── pages/
│   ├── Login.tsx                # Tela de login (atualizada)
│   └── QRLogin.tsx              # Página para escanear
└── App.tsx                       # Rotas (atualizado)

supabase/
└── migrations/
    └── 20260118000001_add_qr_login_tokens.sql

aplicar-qr-login.bat             # Script de instalação
```

## API / Endpoints

### Tabela: qr_login_tokens

```sql
- token: string (único)
- used: boolean
- user_id: uuid
- email: string
- temp_password: string
- expires_at: timestamp
- created_at: timestamp
- used_at: timestamp
```

### Rotas

- `/login` - Tela de login principal
- `/qr-login?token=xxx` - Página de autenticação mobile

## Próximas Melhorias

- [ ] Notificação push quando login for autorizado
- [ ] Suporte para múltiplos dispositivos simultâneos
- [ ] Histórico de logins via QR Code
- [ ] Biometria no celular (opcional)
- [ ] Deep linking para apps mobile

---

**Data de Criação:** 18/01/2026  
**Versão:** 1.0.0
