# Organização do Banco de Dados - Netipflix

## 📋 O que foi feito?

Este update reorganiza completamente o banco de dados para melhorar a experiência do usuário:

### 1. **Categorias Adultas sempre por último** 🔞
- Todas as categorias adultas (+18) agora aparecem automaticamente no final das listas
- Funciona para TV ao Vivo, Filmes e Séries
- A senha continua sendo obrigatória para acessar

### 2. **Séries Agrupadas Corretamente** 📺
- Episódios da mesma série agora ficam agrupados
- Título normalizado para evitar duplicatas
- Temporadas e episódios ordenados corretamente
- Cada série aparece uma vez, com todos os episódios dentro

### 3. **Estrutura do Banco Melhorada** 🗄️

#### Novas Colunas:
- `is_adult_category` - Flag booleana para identificar conteúdo adulto
- `category_order` - Número de ordem para exibição (adultas têm número maior)

#### Novas Views:
- `categories_ordered` - Lista categorias já ordenadas (adultas por último)
- `series_grouped` - Séries agrupadas com estatísticas

#### Novas Funções:
- `is_adult_category(text)` - Detecta se categoria é adulta
- `assign_category_order()` - Atribui ordem às categorias
- `normalize_series_title(text)` - Normaliza título de séries
- `reorder_categories()` - Re-processa ordenação (útil após importações)

#### Triggers Automáticos:
- Quando um canal novo é inserido, automaticamente detecta se é adulto
- Mantém a organização sempre atualizada

## 🚀 Como Aplicar

### Opção 1: Usando o Script Batch (Recomendado)
```bash
organize-database.bat
```

### Opção 2: Manualmente via Node
```bash
node apply-organization.mjs
```

### Opção 3: Direto no Supabase
1. Acesse o Dashboard do Supabase
2. Vá em SQL Editor
3. Cole o conteúdo de `supabase/migrations/20260112000000_organize_adult_content_and_series.sql`
4. Execute

## 📊 Resultados Esperados

Após aplicar a migration, você verá:

### TV ao Vivo:
```
✅ Categorias regulares (Esportes, Notícias, Entretenimento...)
...
🔞 Categoria Adulto (sempre por último)
```

### Filmes:
```
✅ Ação, Comédia, Drama, Terror...
...
🔞 Adulto (sempre por último)
```

### Séries:
```
✅ Breaking Bad (5 temporadas, 62 episódios) ✓ Agrupado
✅ Game of Thrones (8 temporadas, 73 episódios) ✓ Agrupado
...
🔞 Séries Adultas (sempre por último)
```

## 🔍 Verificação

Execute estes comandos SQL para verificar:

```sql
-- Ver categorias ordenadas
SELECT * FROM categories_ordered;

-- Ver séries agrupadas
SELECT * FROM series_grouped;

-- Contar canais adultos vs regulares
SELECT 
  content_type,
  is_adult_category,
  COUNT(*) as count
FROM channels
WHERE active = true
GROUP BY content_type, is_adult_category
ORDER BY content_type, is_adult_category;
```

## 🛠️ Manutenção

### Após importar novos canais M3U:

Execute para reorganizar:
```sql
SELECT reorder_categories();
```

Ou via batch:
```bash
organize-database.bat
```

### Se precisar resetar a ordenação:
```sql
-- Re-detectar categorias adultas
UPDATE channels
SET is_adult_category = is_adult_category(category);

-- Re-ordenar tudo
SELECT assign_category_order();
```

## 📝 Notas Técnicas

### Detecção de Conteúdo Adulto
A função `is_adult_category()` detecta:
- Palavras: adult, adulto, +18, 18+, xxx, porn, erotico
- Categorias específicas: onlyfans, bella da semana, campur

### Normalização de Títulos
A função `normalize_series_title()`:
- Remove informações de temporada/episódio
- Remove anos (1999, 2020, etc)
- Remove qualidade de vídeo (720p, 1080p, 4K)
- Limpa espaços e caracteres duplicados

### Performance
- Índices criados para queries rápidas
- Views materializadas para consultas otimizadas
- Triggers leves que não impactam inserções

## ⚠️ Compatibilidade

Esta migration é **COMPATÍVEL** com:
- ✅ Todas as migrations anteriores
- ✅ Código frontend existente
- ✅ Active_channels view
- ✅ Sistema de autenticação
- ✅ Controle de senha adulta

**NÃO QUEBRA** nada existente, apenas adiciona novas funcionalidades!

## 🎯 Benefícios

1. **Melhor UX**: Conteúdo adulto sempre no final, não misturado
2. **Séries organizadas**: Fácil encontrar e assistir episódios em ordem
3. **Automático**: Novos conteúdos já são categorizados corretamente
4. **Performático**: Queries otimizadas com índices adequados
5. **Manutenível**: Funções SQL para fácil manutenção

## 🐛 Troubleshooting

### Erro: "function exec_sql does not exist"
**Solução**: Execute a migration diretamente no SQL Editor do Supabase

### Séries não agrupando
**Solução**: Execute `SELECT reorder_categories();`

### Categorias adultas não indo pro final
**Solução**: 
```sql
UPDATE channels SET is_adult_category = is_adult_category(category);
SELECT assign_category_order();
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do script
2. Consulte o SQL diretamente no Supabase
3. Execute as funções de manutenção
4. Revise os índices criados

---

**Última atualização**: 12/01/2026
**Versão da Migration**: 20260112000000
