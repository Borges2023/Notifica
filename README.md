# Notifica

Sistema automático de notificação de proximidade com mapa, voz e painel de administração.

## Funcionamento

O sistema detecta automaticamente quando o usuário se aproxima de qualquer empresa cadastrada (dentro de 150 metros) e dispara notificações por voz e notificação do navegador. Não é necessário selecionar uma empresa — todas as empresas são monitoradas continuamente.

## Páginas

- `index.html` — página principal do usuário com mapa e notificações automáticas.
- `admin.html` — painel do administrador para cadastrar empresas e ver histórico de notificações.
- `user.html` — redireciona para `index.html`.

## GitHub Pages

O site está publicado em:

- `https://borges2023.github.io/Notifica/`

## Como usar

1. Abra a aplicação no navegador
2. Conceda permissões de geolocalização
3. O sistema monitorará automaticamente sua proximidade de todas as empresas cadastradas
4. Quando você se aproximar de uma empresa, receberá uma notificação por voz e uma notificação do navegador
5. Todas as notificações são registradas no histórico

## Como rodar localmente

Execute um servidor local na pasta do projeto, por exemplo:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000` no navegador.
