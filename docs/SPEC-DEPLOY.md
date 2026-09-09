# Publicação e tela branca

## Como publica

```
cd C:\Users\renat\orbi
git push
npx vercel --prod
```

O push é sempre manual. O Vercel (projeto `orbi-pouk`) roda `vite build`, que
gera `dist/assets/index-<hash>.js` — **o hash muda a cada build**.

O backend (`vicke-backend`, Railway) publica no push para `main`:

```
cd C:\Users\renat\vicke-backend
git add server.js
git commit -m "<mensagem>"
git push
```

**Os comandos vão sempre agrupados num único bloco**, um por linha, para o
usuário colar de uma vez — nunca um comando por bloco. Quando as duas pontas
mudam, o backend vai primeiro (o frontend novo depende dos endpoints novos).

## A tela branca depois de publicar

Sintoma: publica, atualiza a página e o site fica em branco, sem mensagem.

Causa: o navegador reaproveita o `index.html` da versão anterior, que aponta
para um `/assets/index-<hash antigo>.js` que não existe mais no deploy novo.
Com a regra de SPA `"/(.*)" → "/index.html"`, o Vercel respondia **200 com o
próprio HTML** nessa URL; o navegador tentava executar HTML como JavaScript,
o script morria antes de montar o React e o `<div id="root">` ficava vazio —
tela branca, e nada nos logs do servidor, porque do lado dele deu 200.

Três defesas, todas em vigor:

1. **Cache-Control** em `/` e `/index.html`: `max-age=0, must-revalidate`
   (`vercel.json`) — o HTML nunca fica velho de propósito.
2. **A regra de SPA ignora `/assets/`**: `"/((?!assets/).*)" → "/index.html"`.
   Um arquivo de build que não existe mais devolve 404 honesto em vez de HTML
   disfarçado de script.
3. **Guarda no `index.html`**: 8 segundos depois do `load`, se o app não tiver
   montado e o `#root` estiver vazio, recarrega **uma vez** sem cache. A marca
   `sessionStorage["vicke-recarga-branca"]` impede laço; `main.jsx` marca
   `window.__vickeMontou = true` e limpa a marca quando o React sobe.

Para o usuário, a saída imediata continua sendo **Ctrl + Shift + R**.

Se a tela branca voltar **com o bundle certo**, aí é erro de execução: abrir o
console (F12) e ler o primeiro erro em vermelho. Um crash de render no React
desmonta a árvore inteira e também deixa a tela branca — a diferença é que o
console mostra a exceção, não um `SyntaxError: Unexpected token '<'`.

## Repro fora do navegador

`AppCombined.jsx` roda inteiro em jsdom, com `fetch` e token falsos, o que
permite abrir as telas e ver o erro sem precisar publicar. Foi assim que se
confirmou que o bundle publicado montava e navegava sem crash — apontando o
dedo para o carregamento do arquivo, não para o código.
