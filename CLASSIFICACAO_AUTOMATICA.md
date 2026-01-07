# 📊 Sistema de Classificação Automática de Conteúdo

## 🎯 Visão Geral

O Netipflix agora possui um **sistema inteligente de classificação automática** que analisa canais de listas M3U e os organiza automaticamente em:

- 📺 **TV ao Vivo** - Canais de transmissão ao vivo
- 🎬 **Filmes** - Conteúdo cinematográfico VOD
- 📺 **Séries** - Episódios de séries e temporadas

## 🔍 Como Funciona

O sistema usa **análise em múltiplas camadas** para determinar o tipo de conteúdo:

### 1. Análise de URL (Maior Peso - 90 pontos)
O sistema primeiro analisa a estrutura da URL:

```
✅ /live/        → TV ao Vivo
✅ /movie/       → Filme
✅ /series/      → Série
✅ .m3u8         → TV ao Vivo
✅ .mp4, .mkv    → Filme
```

**Exemplo:**
- `http://server.com/live/cnn/playlist.m3u8` → **TV ao Vivo**
- `http://server.com/movie/vingadores.mp4` → **Filme**
- `http://server.com/series/friends/s01e01.mkv` → **Série**

### 2. Análise do Nome (Peso Alto - 85 pontos)
Detecta padrões no nome do canal:

**Séries:**
```
✅ "Friends T01|EP01"
✅ "Breaking Bad S05E08"
✅ "The Office 1x03"
✅ "Game of Thrones Temporada 3 Episodio 4"
```

**Filmes:**
```
✅ "Vingadores Dublado"
✅ "Avatar Legendado"
✅ "Titanic Dual Audio BluRay"
```

**TV ao Vivo:**
```
✅ "Globo HD 24h"
✅ "ESPN FHD"
✅ "CNN Brasil"
```

### 3. Análise de Categoria (Peso Médio - 75 pontos)
Verifica a categoria do canal:

**Séries:**
- Série, Seriado, Novela, Minissérie

**Filmes:**
- Filme, Cinema, Ação, Comédia, Drama, Terror, etc.

**TV:**
- Canal, TV, Notícias, Esporte, Entretenimento, etc.

## 📈 Sistema de Pontuação

O classificador atribui pontos para cada tipo baseado nas análises:

```
TV Score: 90 (URL /live/) + 30 (nome "HD") + 65 (cat "Entretenimento") = 185 pts
Movie Score: 0
Series Score: 0

Resultado: TV ao Vivo ✅
```

**O tipo com maior pontuação vence!**

## 🎨 Recursos do Sistema

### 1. Classificação em Tempo Real
Durante a importação, você verá estatísticas em tempo real:

```
✓ 1247 canais encontrados
  • TV ao Vivo: 856 canais
  • Filmes: 234 canais  
  • Séries: 157 canais
```

### 2. Confiança da Classificação
O sistema calcula um nível de confiança (0-100%) para cada classificação:

- **Alta (80-100%)**: Classificação muito confiável
- **Média (60-79%)**: Classificação razoável
- **Baixa (<60%)**: Pode precisar de revisão manual

### 3. Detecção de Séries Melhorada
Detecta automaticamente:
- Título da série
- Número da temporada
- Número do episódio

**Exemplo:**
```
Nome: "Breaking Bad T05|EP08 - Gliding Over All"

Extraído:
├─ Título: "Breaking Bad"
├─ Temporada: 5
└─ Episódio: 8
```

### 4. Suporte a Múltiplos Padrões

O sistema reconhece diversos formatos de nomenclatura:

| Padrão | Exemplo |
|--------|---------|
| T##\|EP## | `Friends T01|EP05` |
| S##E## | `Breaking Bad S05E08` |
| S## E## | `The Office S03 E12` |
| #x## | `Lost 4x08` |
| Temporada/Episódio | `GOT Temporada 1 Episodio 3` |

## 🚀 Como Usar

### Importar Nova Lista

1. **Cole a URL ou conteúdo M3U** no campo de importação
2. O sistema automaticamente:
   - Analisa cada canal
   - Classifica em TV/Filme/Série
   - Extrai informações de séries
   - Mostra estatísticas em tempo real
3. Confira o relatório de classificação
4. Clique em **Importar**

### Reclassificar Canais Existentes

Se você já tem canais importados e quer reclassificá-los com o novo sistema:

```sql
-- Execute no Supabase SQL Editor
SELECT * FROM reclassify_all_channels();
```

Resultado:
```json
{
  "updated_count": 1247,
  "by_type": {
    "TV": 856,
    "MOVIE": 234,
    "SERIES": 157
  }
}
```

## 🛠️ Casos Especiais

### Listas Xtream Codes
Listas de provedores Xtream Codes são **automaticamente detectadas** pela estrutura da URL:

```
http://provider.com:8080/live/user/pass/12345.m3u8    → TV
http://provider.com:8080/movie/user/pass/12345.mkv    → Filme
http://provider.com:8080/series/user/pass/12345.mkv   → Série
```

### Séries sem Título
Se uma série vier com padrão genérico tipo `"T01|EP01"` sem nome:

```
Antes: "T01|EP01"
Depois: "Friends T01|EP01" (usando pltv-subgroup)
```

O sistema usa o campo `pltv-subgroup` do M3U quando disponível.

### Canais Ambíguos
Para canais que não se encaixam claramente:

- Default: **TV ao Vivo**
- Você pode editar manualmente depois

## 📊 Estatísticas e Monitoramento

### Card de Estatísticas
Após importação, veja:

- Total de canais importados
- Distribuição por tipo (TV/Filme/Série)
- Gráfico visual de distribuição
- Confiança média da classificação
- Quantidade de classificações com baixa confiança

### Logs de Debug (Dev)
Em modo de desenvolvimento, o sistema loga classificações com baixa confiança:

```javascript
[Classificação] Canal XYZ: {
  type: 'MOVIE',
  confidence: 45,
  reasons: [
    'Categoria de filme (70%)',
    'Nome contém "dublado" (60%)'
  ]
}
```

## ✅ Melhores Práticas

1. **Use listas M3U bem formatadas** com categorias claras
2. **Verifique estatísticas** após importação
3. **Reclassifique periodicamente** quando atualizar a lógica
4. **Revise canais com baixa confiança** (<60%)
5. **Use nomenclaturas padrão** para séries (S01E01)

## 🔧 Personalização

### Adicionar Novos Padrões

Edite o arquivo `src/utils/contentClassifier.ts`:

```typescript
const MOVIE_KEYWORDS = {
  categories: [
    'filme', 'movie', 'cinema',
    'sua-nova-categoria-aqui'  // Adicione aqui
  ]
};
```

### Ajustar Pesos

No arquivo SQL `20260107030000_improve_content_classification.sql`:

```sql
-- Aumentar peso de URLs
IF url_lower LIKE '%/live/%' THEN
  tv_score := tv_score + 100;  -- Era 90
END IF;
```

## 🐛 Troubleshooting

### Problema: Muitos canais classificados errado

**Solução:**
1. Verifique se as listas M3U têm categorias corretas
2. Ajuste os pesos no classificador
3. Execute reclassificação após ajustes

### Problema: Séries sem título da série

**Solução:**
1. Verifique se o M3U tem campo `pltv-subgroup`
2. Delete séries sem título: Admin → Ferramentas → Deletar séries sem título
3. Reimporte o M3U

### Problema: Baixa confiança geral

**Solução:**
1. Adicione mais palavras-chave específicas
2. Melhore as categorias no M3U original
3. Use listas de provedores Xtream Codes (maior precisão)

## 📝 Exemplo Completo

### Entrada M3U:
```m3u
#EXTINF:-1 tvg-logo="logo.png" group-title="Séries Netflix" pltv-subgroup="Stranger Things",T01|EP01 - The Vanishing of Will Byers
http://server.com/series/st/s01e01.mkv

#EXTINF:-1 tvg-logo="logo.png" group-title="Filmes Ação",Vingadores Ultimato Dublado
http://server.com/movie/vingadores.mp4

#EXTINF:-1 tvg-logo="logo.png" group-title="Canais",Globo HD
http://server.com/live/globo/stream.m3u8
```

### Resultado:
```
✅ Stranger Things T01|EP01 - The Vanishing of Will Byers
   Tipo: SÉRIE
   Confiança: 95%
   Série: Stranger Things | Temp: 1 | Ep: 1

✅ Vingadores Ultimato Dublado
   Tipo: FILME
   Confiança: 88%

✅ Globo HD
   Tipo: TV
   Confiança: 92%
```

## 🎓 Conclusão

O sistema de classificação automática do Netipflix usa IA baseada em regras para organizar seu conteúdo de forma inteligente e precisa. Com análise em múltiplas camadas e sistema de pontuação ponderado, você pode importar listas M3U com confiança de que o conteúdo será organizado corretamente.

---

**Desenvolvido com ❤️ para facilitar a gestão do seu conteúdo!**
