# Bolao da Galera

App web em React, Vite, Tailwind e Supabase para organizar bolões com convite, inscrição via PIX, confirmação de pagamento e ranking por pontuação.

## Rodar localmente

```bash
npm install
npm run dev
```

Sem variáveis do Supabase, o app usa `localStorage` para você testar a interface. Para ligar no Supabase, copie `.env.example` para `.env` e preencha:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Depois rode o SQL em `supabase/schema.sql` no editor do Supabase.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub com o nome que quiser.
2. Envie este projeto para o branch `main`.
3. No GitHub, abra `Settings > Pages` e selecione `GitHub Actions` como source.
4. A cada push no `main`, o workflow em [`.github/workflows/pages.yml`](.github/workflows/pages.yml) faz o deploy automático.

Se você preferir, também dá para hospedar em Vercel ou Netlify sem mudar o código do app.

## O que o MVP já faz

- Login simples com escolha de perfil: organizador ou jogador
- Criação de bolão com código de convite único
- Entrada em bolão por código
- Exibição de inscrição e chave PIX
- Status do participante com `Pagamento pendente` e `Pago`
- Confirmação de pagamento pelo organizador
- Lançamento manual de resultados dos jogos
- Pontuação por placar exato e vencedor
- Ranking liberado só após jogos finalizados
