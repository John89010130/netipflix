# 📺 INSTALAÇÃO SAMSUNG TV - GUIA VISUAL PASSO A PASSO

## ⚡ MÉTODO MAIS SIMPLES (sem instalar programas)

### PARTE 1: Criar o arquivo .wgt

#### Opção A: Usando o script (recomendado)

No Windows:
```cmd
build-tizen.bat
```

No Mac/Linux:
```bash
chmod +x build-tizen.sh
./build-tizen.sh
```

Pronto! O arquivo `Netipflix.wgt` será criado automaticamente.

---

#### Opção B: Manualmente (sem scripts)

1. **Abra a pasta `tizen/`** do projeto

2. **Selecione TODOS os arquivos dentro dela:**
   ```
   ✅ config.xml
   ✅ index.html
   ✅ icon.png (ou icon.svg)
   ✅ .tproject
   ✅ README.txt
   ```

3. **Compacte em ZIP:**
   - Windows: Botão direito → "Enviar para" → "Pasta compactada"
   - Mac: Botão direito → "Comprimir"
   - Linux: `zip -r Netipflix.zip *`

4. **Renomeie de `.zip` para `.wgt`:**
   - `Netipflix.zip` → `Netipflix.wgt`

✅ **Pronto! Você tem seu app Tizen!**

> ⚠️ **ATENÇÃO:** Os arquivos devem estar na RAIZ do arquivo, NÃO dentro de uma pasta!

---

### PARTE 2: Instalar na Samsung TV

#### Passo 1: Ativar Developer Mode 🔓

1. Na sua **Samsung Smart TV**, pressione o botão **Home**
2. Vá em **Apps** (ícone de 4 quadrados)
3. **Digite rapidamente: 1 2 3 4 5** no controle remoto
4. Uma janela "Developer Mode" aparecerá
5. Configure:
   - **Developer Mode** = **ON** ✅
   - **Host PC IP** = IP do seu computador (ex: 192.168.1.100)
6. Clique em **OK**
7. **Reinicie a TV** quando solicitado

> 💡 **Dica:** Para descobrir o IP do seu PC:
> - Windows: `ipconfig` no CMD
> - Mac/Linux: `ifconfig` no Terminal

---

#### Passo 2: Preparar o Pendrive 💾

1. **Formate** o pendrive em formato **FAT32**
   - Windows: Botão direito no pendrive → Formatar → FAT32
   - Mac: Utilitário de Disco → Apagar → MS-DOS (FAT)

2. Na **raiz do pendrive**, crie uma pasta chamada: **`userwidget`**

3. **Copie** o arquivo `Netipflix.wgt` para dentro da pasta `userwidget`

**Estrutura final do pendrive:**
```
PENDRIVE (F:)
└── userwidget/
    └── Netipflix.wgt
```

---

#### Passo 3: Instalar o App 📲

1. **Conecte** o pendrive em qualquer porta USB da TV

2. A TV **detectará automaticamente** e mostrará uma mensagem:
   ```
   "Deseja instalar este aplicativo?"
   ```

3. Selecione **"Instalar"** ou **"Yes"**

4. Aguarde a instalação (5-15 segundos)

5. Quando concluir, aparecerá: **"Instalação concluída"**

6. **RETIRE O PENDRIVE** - o app já está instalado na TV! ✅

---

#### Passo 4: Usar o App 🎉

1. Pressione **Home** no controle

2. Vá em **Apps**

3. Procure pelo ícone **Netipflix** (pode estar no final da lista)

4. Pressione **Enter** para abrir

5. Pronto! O app irá carregar 📺✨

---

## 🎮 Controles na TV

Ao usar o app:

| Botão | Ação |
|-------|------|
| **Setas** ↑↓←→ | Navegar |
| **Enter** | Selecionar / Play/Pause |
| **Voltar (Back)** | Fechar player |
| **Exit** | Sair do app |

---

## ⚙️ Configurações Importantes

### Alterar a URL do App

Antes de criar o .wgt, você pode alterar para onde o app aponta:

1. Abra o arquivo: `tizen/index.html`

2. Procure pela linha:
   ```javascript
   const APP_URL = 'https://netipflix.pages.dev';
   ```

3. Altere para sua URL:
   ```javascript
   const APP_URL = 'https://meu-dominio.com';
   ```

4. Salve e recrie o .wgt

---

## 🔧 Solução de Problemas

### ❌ "Não consigo ativar Developer Mode"

**Soluções:**
- Certifique-se que a TV está **conectada à internet**
- Digite **12345 bem rápido** no controle
- Tente em diferentes telas (Home, Apps, Smart Hub)
- Modelo muito antigo? Verifique se suporta Tizen 3.0+

---

### ❌ "Pendrive não é reconhecido"

**Soluções:**
- Formate em **FAT32** (não NTFS ou exFAT)
- Verifique se a pasta se chama exatamente **`userwidget`** (minúsculas)
- Pasta deve estar na **raiz** do pendrive
- Tente outra **porta USB** da TV
- Use pendrive **menor que 32GB** (melhor compatibilidade)

---

### ❌ "App instalou mas não abre / tela preta"

**Soluções:**
- Verifique se a TV está **conectada à internet**
- Confirme se a **URL no index.html** está correta e acessível
- Aguarde 30 segundos - primeiro load pode demorar
- Tente **desinstalar e reinstalar** o app
- Verifique se o site está online (acesse no PC primeiro)

---

### ❌ "App desapareceu após desligar a TV"

**Explicação:**
Isso é **normal** quando se usa Developer Mode. Apps instalados via Developer Mode podem ser removidos quando:
- TV é desligada da tomada
- Developer Mode é desativado automaticamente
- Atualização de firmware

**Solução:**
- Reative **Developer Mode** (digite 12345)
- **Reinstale** o app via pendrive
- Para instalação permanente, seria necessário publicar na Samsung Store (requer conta de desenvolvedor)

---

### ❌ "Como remover o app?"

1. Vá em **Apps**
2. Encontre **Netipflix**
3. **Segure o botão Enter** por 2-3 segundos
4. Selecione **"Excluir"** ou **"Delete"**

---

## 💡 Dicas Extras

### Melhor Desempenho
- Use conexão **Ethernet (cabo)** em vez de Wi-Fi
- Feche outros apps rodando em background
- Reinicie a TV se estiver lenta

### Primeira Execução
- Pode demorar 30-60 segundos para carregar na primeira vez
- Depois fica mais rápido

### Atualizar o App
1. Crie novo .wgt com alterações
2. **Desinstale** o app antigo na TV
3. **Reinstale** via pendrive

---

## 📋 Checklist Rápido

Antes de instalar, verifique:

- [ ] TV Samsung com Tizen 3.0+ (2016 ou mais nova)
- [ ] TV conectada à internet
- [ ] Developer Mode ativado (digite 12345)
- [ ] Pendrive formatado em FAT32
- [ ] Pasta `userwidget` criada na raiz
- [ ] Arquivo `Netipflix.wgt` dentro de `userwidget`
- [ ] URL configurada corretamente em `index.html`

---

## 🎯 Resumo Ultra-Rápido

```
1. Execute: build-tizen.bat
2. TV: Digite 12345 → Ative Developer Mode → Reinicie
3. Pendrive: Formate FAT32 → Crie pasta userwidget → Copie .wgt
4. TV: Conecte pendrive → Confirme instalação → Retire pendrive
5. Abra: Apps → Netipflix ✨
```

---

## 📞 Mais Informações

- Detalhes técnicos: [README-TIZEN.md](./README-TIZEN.md)
- Dúvidas? Veja os arquivos de documentação do projeto

**Boa sorte! 📺✨**
