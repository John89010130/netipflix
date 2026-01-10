#!/bin/bash
# Build script for Tizen (Linux/Mac)

echo "========================================"
echo " Netipflix - Build para Samsung TV Tizen"
echo "========================================"
echo ""

# Check if tizen CLI is installed
if ! command -v tizen &> /dev/null; then
    echo "[AVISO] Tizen Studio CLI não encontrado"
    echo "Você pode empacotar manualmente seguindo o README-TIZEN.md"
    echo ""
fi

echo "[1/4] Limpando build anterior..."
rm -rf tizen-build
mkdir -p tizen-build

echo "[2/4] Copiando arquivos Tizen..."
cp -r tizen/* tizen-build/

echo "[3/4] Criando ícone..."
if [ ! -f "tizen-build/icon.png" ]; then
    if [ -f "public/android-chrome-192x192.png" ]; then
        cp "public/android-chrome-192x192.png" "tizen-build/icon.png"
    else
        echo "[AVISO] Ícone não encontrado - usando placeholder"
    fi
fi

echo "[4/4] Tentando empacotar .wgt..."
if command -v tizen &> /dev/null; then
    cd tizen-build
    tizen package -t wgt -s NetipflixTizen
    cd ..
    echo ""
    echo "[OK] Build concluído! Arquivo .wgt gerado em: tizen-build/"
    echo ""
else
    echo ""
    echo "========================================"
    echo "  Build manual necessário"
    echo "========================================"
    echo ""
    echo "1. Instale o Tizen Studio:"
    echo "   https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html"
    echo ""
    echo "2. Ou crie o .wgt manualmente:"
    echo "   - Entre na pasta tizen-build/"
    echo "   - Compacte todos os arquivos em formato ZIP"
    echo "   - Renomeie de .zip para .wgt"
    echo "   - Instale via Developer Mode na TV"
    echo ""
    echo "3. Método mais simples (sem Tizen Studio):"
    echo "   cd tizen-build && zip -r ../Netipflix.wgt * && cd .."
    echo ""
    echo "Veja README-TIZEN.md para instruções completas"
    echo ""
fi

# Criar .wgt usando zip se disponível
if command -v zip &> /dev/null && [ ! -f "Netipflix.wgt" ]; then
    echo "Criando .wgt com zip..."
    cd tizen-build
    zip -r ../Netipflix.wgt *
    cd ..
    echo "[OK] Netipflix.wgt criado!"
    echo ""
    echo "Próximo passo:"
    echo "1. Copie Netipflix.wgt para PENDRIVE/userwidget/"
    echo "2. Conecte o pendrive na Samsung TV"
    echo "3. Confirme a instalação"
    echo ""
fi
