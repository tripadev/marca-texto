# Marca Texto — extensão para o navegador

O mesmo pincel do aplicativo, só que dentro das páginas do navegador. Você aperta **Alt+C**, risca o
que quer destacar, e **ao soltar o botão do mouse a marcação some sozinha**.

Funciona no **Chrome** e no **Edge**.

## Como instalar

Como a extensão não veio da loja, ela é instalada em modo desenvolvedor. É definitivo, não expira:

1. Abra `chrome://extensions` (no Edge: `edge://extensions`).
2. Ligue o **Modo do desenvolvedor**, no canto da página.
3. Clique em **Carregar sem compactação** e escolha a pasta `extensao-navegador`
   (a que contém o `manifest.json`).
4. Pronto. O ícone amarelo aparece na barra do navegador — clique no alfinete para deixá-lo fixo.

Não precisa recarregar as abas que já estavam abertas.

## Como usar

| Ação | O que faz |
| --- | --- |
| **Alt+C** | Liga e desliga o pincel na aba atual |
| Clique no ícone da extensão | Mesma coisa que o Alt+C |
| **Arrastar** com o botão esquerdo | Marca a página |
| **Soltar** o botão | A marcação some com um fade rápido |
| **M** / **C** | Marca-texto / caneta |
| **1** a **5** | Trocam a cor |
| **Roda do mouse** | Muda a espessura |
| **Esc** ou **botão direito** | Desligam o pincel |

Enquanto o pincel está ligado a **página não rola** (a roda está regulando a espessura) e os
cliques não chegam ao site. Aperte `Esc` para voltar ao normal.

Para as opções: botão direito no ícone da extensão > **Opções**.

## Por que Alt+C e não F8

O aplicativo de desktop registra o **F8** no Windows inteiro — ele captura a tecla antes de o
navegador enxergar. Por isso os dois usam teclas diferentes:

- **F8** → pincel do sistema, marca por cima de qualquer programa
- **Alt+C** → pincel da extensão, marca dentro da página

Para mudar o atalho da extensão: `chrome://extensions/shortcuts` (tem um botão para lá na página
de opções). O do aplicativo muda nas configurações dele, pela bandeja.

## Onde não funciona

O navegador proíbe extensões de rodar em algumas páginas, e não há como contornar:

- páginas do próprio navegador (`chrome://`, `edge://`, configurações, nova aba)
- a Chrome Web Store
- PDFs abertos no visualizador interno
- arquivos locais (`file://`), a menos que você marque "Permitir acesso a URLs de arquivo" na
  página da extensão

Nesses casos o ícone mostra um selo vermelho `!` por alguns segundos, e aí o jeito é usar o
aplicativo de desktop, que desenha por cima de qualquer coisa.

## Privacidade

A extensão usa a permissão **`activeTab`**: ela só enxerga a página no instante em que você
aciona o pincel, e nenhuma outra. Por isso o Chrome **não** pede "ler e alterar todos os seus
dados em todos os sites". Nada é enviado para lugar nenhum — as preferências ficam na sua conta
do navegador (`chrome.storage.sync`).

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `manifest.json` | Declaração da extensão, permissões e o atalho Alt+C |
| `fundo.js` | Service worker: injeta o pincel na aba e manda ligar/desligar |
| `conteudo.js` | O pincel dentro da página (canvas em shadow DOM, traço, fade, teclas) |
| `conteudo.css` | Único estilo aplicado na página: o posicionamento do elemento raiz |
| `opcoes.html` / `opcoes.js` / `estilo.css` | Página de opções |
| `icones/` | Ícones 16/32/48/128 (gerados por `npm run icone`) |
