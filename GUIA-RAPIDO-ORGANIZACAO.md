# 🚀 Guia Rápido - Organização do Banco de Dados

## ⚡ Execução Simples (3 passos)

### **Passo 1: Copiar o SQL**

Abra o arquivo:
```
supabase/migrations/20260112000000_organize_adult_content_and_series.sql
```

Selecione todo o conteúdo (Ctrl+A) e copie (Ctrl+C)

---

### **Passo 2: Acessar o Supabase Dashboard**

1. Abra seu navegador
2. Acesse: https://supabase.com/dashboard
3. Entre no projeto: **netipflix** (xvawnchhkcykqsbzpfhg)
4. Clique em **"SQL Editor"** no menu lateral

---

### **Passo 3: Executar**

1. Cole o SQL copiado (Ctrl+V)
2. Clique em **"RUN"** (botão verde no canto inferior direito)
3. Aguarde a execução (pode levar 10-30 segundos)
4. ✅ Pronto! Veja as mensagens de sucesso

---

## 📊 Verificar Resultados

Execute este script para ver estatísticas:
```bash
node apply-organization.mjs
```

Ou execute esta query SQL no Supabase para confirmar:
```sql
-- Ver organização das categorias
SELECT 
  content_type,
  category,
  is_adult_category,
  category_order,
  COUNT(*) as count
FROM channels
WHERE active = true
GROUP BY content_type, category, is_adult_category, category_order
ORDER BY content_type, category_order
LIMIT 50;
```

---

## ✨ O que vai acontecer?

### Antes:
```
TV ao Vivo:
├─ Adulto XXX (misturado)
├─ Esportes
├─ Notícias
├─ +18 Filmes (misturado)
└─ Entretenimento
```

### Depois:
```
TV ao Vivo:
├─ Entretenimento
├─ Esportes
├─ Notícias
├─ ...
├─ 🔞 Adulto XXX (sempre por último)
└─ 🔞 +18 Filmes (sempre por último)
```

---

## 🔍 Troubleshooting

### ❌ Erro: "permission denied"
**Solução**: Use uma conta admin do Supabase

### ❌ Erro: "column already exists"
**Solução**: Está OK! Significa que já foi executado antes

### ❌ Erro: "syntax error"
**Solução**: Certifique-se de copiar TODO o conteúdo do arquivo SQL

---

## 📞 Suporte

Se algo der errado:
1. Tire print do erro
2. Verifique se copiou todo o SQL
3. Tente novamente
4. As colunas podem já existir (é normal)

---

**Última atualização**: 12/01/2026
