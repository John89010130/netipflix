# 🔍 Busca Otimizada na TV ao Vivo

## O que foi corrigido?

A busca na lista de TV ao vivo agora funciona corretamente:

### ✅ Antes vs Depois

**ANTES:**
- ❌ Buscava apenas pela primeira palavra
- ❌ Limitado a ~1000 registros em memória
- ❌ Não buscava em todos os campos
- ❌ Ordem das palavras importava

**DEPOIS:**
- ✅ Busca por múltiplas palavras independente da ordem
- ✅ Busca em até 5000 registros no banco
- ✅ Busca em: name, category, country, clean_title
- ✅ Ordem das palavras não importa

### 🔍 Exemplos de Busca

Agora você pode buscar de qualquer forma:

```
"Globo HD"     → Encontra canais Globo em HD
"HD Globo"     → Mesmo resultado!
"Sport Brasil" → Encontra canais de esporte do Brasil
"Brasil Sport" → Mesmo resultado!
"Noticia CNN"  → Encontra canais de notícia da CNN
```

## Como Aplicar a Correção

### Passo 1: Aplicar a Migration no Banco

**Opção A - Via Script (Recomendado):**

1. Execute o arquivo: `aplicar-busca-otimizada.bat`
2. Cole a SERVICE ROLE KEY quando solicitado
3. Aguarde a confirmação

**Opção B - Manual no Supabase:**

1. Acesse: https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new
2. Copie o conteúdo do arquivo: `supabase/migrations/20260118000000_add_search_tv_channels_function.sql`
3. Cole no SQL Editor e execute (RUN)

### Passo 2: Verificar

Após aplicar a migration:

1. Abra o app/site
2. Vá em "TV ao Vivo"
3. Teste buscar por: "Globo HD" e depois "HD Globo"
4. Ambos devem retornar os mesmos resultados

## Arquivos Modificados

- ✅ `src/pages/TV.tsx` - Implementa busca otimizada
- ✅ `supabase/migrations/20260118000000_add_search_tv_channels_function.sql` - Função RPC
- ✅ `apply-search-migration.mjs` - Script de aplicação
- ✅ `aplicar-busca-otimizada.bat` - Executável Windows

## Detalhes Técnicos

### Função RPC Criada

```sql
search_tv_channels(
  search_words text[],           -- Array de palavras para buscar
  selected_category text,         -- Categoria selecionada (opcional)
  max_results integer DEFAULT 5000
)
```

### Como Funciona

1. Recebe um array de palavras
2. Faz CONCAT de todos os campos: name + category + country + clean_title
3. Verifica se TODAS as palavras estão presentes (usando ILIKE)
4. Retorna até 5000 resultados ordenados (BR primeiro, depois alfabético)

### Implementação no Frontend

```typescript
// Quando há busca:
const words = searchQuery.split(' ');
const { data } = await supabase.rpc('search_tv_channels', {
  search_words: words,
  selected_category: category,
  max_results: 5000
});
```

## Troubleshooting

### Migration não aplica

Se o script não funcionar:
1. Vá manualmente no SQL Editor do Supabase
2. Cole o SQL da migration
3. Execute

### Busca ainda não funciona

1. Verifique se a migration foi aplicada:
   - No Supabase, vá em Database > Functions
   - Deve aparecer `search_tv_channels`

2. Limpe o cache do navegador (Ctrl + Shift + Delete)

3. Recarregue a página (F5)

### Performance

A função busca até 5000 registros, mas:
- A paginação ainda funciona (200 por página)
- Resultados são filtrados em memória após busca no banco
- Performance é boa mesmo com muitos resultados

## Próximos Passos

Considerar aplicar a mesma otimização em:
- [ ] Busca de Filmes
- [ ] Busca de Séries
- [ ] Busca Global

---

**Data da Correção:** 18/01/2026
