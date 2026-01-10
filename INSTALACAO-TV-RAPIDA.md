# 🚀 Guia Rápido - Instalação Samsung TV

## Opção 1: Método Simples (SEM instalar nada)

### 1. Criar o arquivo .wgt manualmente

1. Abra a pasta `tizen/` deste projeto
2. Selecione TODOS os arquivos:
   - config.xml
   - index.html  
   - icon.png
   - README.txt
   - .tproject
3. **Compacte em ZIP** (clique direito → Compactar)
4. **Renomeie** de `.zip` para `.wgt`
5. Pronto! Você tem o `Netipflix.wgt`

> ⚠️ **IMPORTANTE:** Os arquivos devem estar na RAIZ do .wgt, não dentro de uma pasta!

---

## Opção 2: Usar Script Automático

Execute no PowerShell ou CMD:

```cmd
build-tizen.bat
```

Ou no Linux/Mac:

```bash
chmod +x build-tizen.sh
./build-tizen.sh
```

---

## 📱 Instalar na Samsung TV

### 1. Ativar Developer Mode

Na TV Samsung:
1. Abra **Apps**
2. Digite **12345** rapidamente no controle
3. Ative **Developer Mode** = ON
4. Digite o IP do seu PC
5. Reinicie a TV

### 2. Preparar Pendrive

1. Formate pendrive em **FAT32**
2. Crie pasta: `userwidget`
3. Copie `Netipflix.wgt` para dentro

```
PENDRIVE:\
└── userwidget\
    └── Netipflix.wgt
```

### 3. Instalar

1. Conecte pendrive na TV
2. TV detecta automaticamente
3. Confirme instalação
4. **Retire o pendrive** - app fica instalado!

### 4. Usar o App

1. Vá em **Apps** → **Netipflix**
2. Pronto! 📺

---

## ⚙️ Configurar sua URL

Antes de criar o .wgt, edite `tizen/index.html`:

```javascript
const APP_URL = 'https://seu-dominio.com'; // ← Altere aqui
```

---

## 🔄 Atualizar o App

Para atualizar depois de instalado:

1. Crie novo .wgt com as alterações
2. **Desinstale** o app antigo na TV (segure Enter no ícone)
3. Instale o novo .wgt via pendrive

---

## ❓ Problemas?

- **Developer Mode desativa:** Normal após desligar TV - reative
- **Pendrive não detecta:** Use FAT32 e verifique pasta `userwidget`
- **Tela preta:** Verifique conexão internet e URL no index.html

Veja **README-TIZEN.md** para detalhes completos!
