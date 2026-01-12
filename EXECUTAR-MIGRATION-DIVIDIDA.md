# 🚀 Execução da Migration em 3 Partes (Sem Timeout!)

## ⚡ Por que 3 partes?

A migration original é muito grande e causa timeout. Dividindo em 3 partes pequenas, executa rapidamente!

---

## 📝 Passo a Passo

### **Parte 1: Estrutura** (5-10 segundos)

1. Abra: https://supabase.com/dashboard/project/xvawnchhkcykqsbzpfhg
2. Vá em: **SQL Editor** → **New query**
3. Abra o arquivo: `supabase\migrations\20260112000001_organize_part1_structure.sql`
4. Copie TODO o conteúdo
5. Cole no SQL Editor
6. Clique em **RUN**
7. ✅ Aguarde mensagem: "Parte 1 concluída!"

---

### **Parte 2: Dados** (20-60 segundos)

1. No mesmo SQL Editor
2. **Limpe** o conteúdo anterior
3. Abra o arquivo: `supabase\migrations\20260112000002_organize_part2_data.sql`
4. Copie TODO o conteúdo
5. Cole no SQL Editor
6. Clique em **RUN**
7. ✅ Aguarde mensagem: "Parte 2 concluída!"

---

### **Parte 3: Triggers** (5 segundos)

1. No mesmo SQL Editor
2. **Limpe** o conteúdo anterior
3. Abra o arquivo: `supabase\migrations\20260112000003_organize_part3_triggers.sql`
4. Copie TODO o conteúdo
5. Cole no SQL Editor
6. Clique em **RUN**
7. ✅ Veja as estatísticas finais!

---

## ✨ O que cada parte faz?

### Parte 1 - Estrutura:
- ✅ Adiciona colunas `is_adult_category` e `category_order`
- ✅ Cria índices para performance
- ✅ Cria funções de detecção e normalização
- ✅ Cria views otimizadas

### Parte 2 - Dados:
- ✅ Marca categorias adultas
- ✅ Normaliza títulos de séries
- ✅ Atribui ordem às categorias

### Parte 3 - Triggers:
- ✅ Ativa detecção automática para novos conteúdos
- ✅ Mostra estatísticas finais

---

## 🎯 Resultado Final

Após executar as 3 partes:

✅ **Categorias adultas por último** - TV, Filmes e Séries
✅ **Séries agrupadas corretamente** - Sem episódios duplicados
✅ **Automático** - Novos conteúdos já são organizados
✅ **Rápido** - Cada parte executa em segundos

---

## ❓ Problemas?

### ❌ Timeout na Parte 2
**Solução**: É a parte mais pesada. Se der timeout:
1. Aguarde 1 minuto
2. Execute novamente
3. Se persistir, execute linha por linha

### ❌ "Column already exists"
**OK!** Significa que já foi executado. Pule para próxima parte.

### ❌ "Function already exists"  
**OK!** Está apenas atualizando. Continue normalmente.

---

**Tempo total**: 30-90 segundos para as 3 partes
**Última atualização**: 12/01/2026
