# Bolao da Galera

App web em React, Vite, Tailwind e Supabase para organizar bolões com convite, inscrição via PIX, confirmação de pagamento, resultados manuais e ranking por pontuação.

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

Depois rode o SQL em [supabase/schema.sql](supabase/schema.sql) no editor do Supabase.

## Login com Supabase Auth

O app usa autenticação real com email e senha.

1. Em `Authentication > Providers`, habilite o provedor `Email`.
2. Para testes com amigos, vale desativar a confirmação de email no projeto de teste.
3. Rode novamente o schema para criar a tabela `profiles` e as policies.

## O que o MVP já faz

- Login com Supabase Auth
- Escolha de perfil: organizador ou jogador
- Criação de bolão com código de convite único
- Entrada em bolão por código
- Exibição de inscrição e chave PIX
- Status do participante com `Pagamento pendente` e `Pago`
- Confirmação de pagamento pelo organizador
- Cadastro manual de jogos pelo organizador
- Consulta de jogos em modo somente leitura para jogador
- Pontuação por placar exato e vencedor
- Ranking liberado só após jogos finalizados
