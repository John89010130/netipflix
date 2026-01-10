# 📺 Netipflix para Samsung TV (Tizen)

## Como Instalar o App na Samsung TV via Pendrive

### Pré-requisitos
- Samsung Smart TV (modelo 2016 ou superior)
- Pendrive formatado em FAT32
- TV conectada à internet

---

## 📦 Método 1: Usando Build Automático (Recomendado)

### 1. Gerar o arquivo .wgt

Execute o script de build:

```bash
build-tizen.bat
```

Isso criará o arquivo `Netipflix.wgt` na pasta `tizen-build/`.

---

## 📦 Método 2: Build Manual (Sem Tizen Studio)

### 1. Preparar arquivos

1. Abra a pasta `tizen-build/`
2. Selecione **TODOS os arquivos** dentro dela:
   - config.xml
   - index.html
   - icon.png
3. Clique com botão direito → **Enviar para** → **Pasta compactada**
4. Renomeie o arquivo `.zip` para `Netipflix.wgt`

> **Importante:** Os arquivos devem estar na RAIZ do .wgt, não dentro de uma pasta!

---

## 📱 Instalação na Samsung TV

### Passo 1: Ativar Developer Mode

1. Na sua Samsung TV, vá em **Apps**
2. Digite **12345** no controle remoto (rapidamente)
3. Uma janela "Developer Mode" aparecerá
4. Ative **Developer Mode** = ON
5. Digite o **IP do seu computador** no campo "Host PC IP"
6. Clique em **OK** e **reinicie a TV**

### Passo 2: Copiar para Pendrive

1. Formate o pendrive em **FAT32**
2. Crie uma pasta chamada `userwidget` na raiz do pendrive
3. Copie o arquivo `Netipflix.wgt` para dentro da pasta `userwidget`

Estrutura final:
```
PENDRIVE:\
└── userwidget\
    └── Netipflix.wgt
```

### Passo 3: Instalar na TV

1. Conecte o pendrive na porta USB da TV
2. A TV detectará automaticamente e perguntará se deseja instalar
3. Confirme a instalação
4. Aguarde a instalação concluir
5. **Retire o pendrive** - o app fica instalado na TV!

### Passo 4: Abrir o App

1. Vá em **Apps** na TV
2. Procure por **Netipflix**
3. Abra o app normalmente

---

## ⚙️ Configuração Importante

### Alterar URL do App

Por padrão, o app carrega de `https://netipflix.pages.dev`. Para alterar:

1. Abra `tizen/index.html`
2. Localize a linha:
   ```javascript
   const APP_URL = 'https://netipflix.pages.dev';
   ```
3. Altere para sua URL (ex: `https://seu-dominio.com`)
4. Recrie o .wgt e reinstale

---

## 🎮 Controles

- **Setas direcionais**: Navegação
- **Enter**: Selecionar/Play/Pause
- **Voltar (Back)**: Fechar player ou voltar
- **Exit**: Sair do app

---

## 🔧 Solução de Problemas

### "Não consigo ativar Developer Mode"

- Certifique-se de que a TV está conectada à internet
- Digite 12345 rapidamente
- Tente em diferentes telas (Apps, Smart Hub)

### "Pendrive não é reconhecido"

- Formate em FAT32 (não NTFS ou exFAT)
- Certifique-se da pasta `userwidget` estar na raiz
- Tente outra porta USB da TV

### "App não abre ou tela preta"

- Verifique se a TV está conectada à internet
- Confirme se a URL no `index.html` está correta
- Abra o app novamente (pode demorar no primeiro carregamento)

### "App desapareceu após desligar TV"

- Isso pode acontecer se Developer Mode desativar
- Reative Developer Mode e reinstale
- Para instalação permanente, seria necessário assinatura Samsung

---

## 📋 Método Alternativo: Tizen Studio (Avançado)

Se preferir usar ferramentas oficiais:

1. Instale [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)
2. Configure certificado de desenvolvedor
3. Use `tizen package` e `tizen install` via CLI
4. Permite debug e instalação via rede (sem pendrive)

---

## 📝 Notas

- O app é um **web wrapper** que carrega seu site dentro de um iframe
- Requer internet para funcionar
- Developer Mode pode desativar após desligar a TV (comportamento normal)
- Para distribuição na Samsung App Store, seria necessário conta de desenvolvedor

---

## 🎯 Resumo Rápido

1. Execute `build-tizen.bat` (ou crie .wgt manualmente)
2. Ative Developer Mode na TV (digite 12345)
3. Copie .wgt para `PENDRIVE:\userwidget\`
4. Conecte pendrive na TV e instale
5. Abra o app em Apps → Netipflix

**Pronto! Seu app está instalado na Samsung TV! 📺✨**
