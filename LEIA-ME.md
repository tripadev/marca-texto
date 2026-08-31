# Marca Texto

Pincel de anotação temporária por cima da tela, para usar durante gravações e apresentações.

Você aperta uma tecla, risca com o mouse o que quer destacar, e **quando solta o botão a marcação some sozinha**.

## Como abrir

Dê dois cliques em **`Marca Texto.bat`**.

O app não abre janela: ele fica na **bandeja do Windows**, ao lado do relógio (ícone de um traço amarelo).
Se o ícone estiver escondido, clique na setinha `^` da bandeja.

Pelo terminal, o equivalente é:

```bash
npm start
```

## Como usar

| Ação | O que faz |
| --- | --- |
| **F8** | Liga e desliga o pincel (dá para trocar essa tecla nas configurações) |
| **Arrastar** com o botão esquerdo | Marca a tela |
| **Soltar** o botão | A marcação some com um fade rápido |
| **M** | Marca-texto (grosso e translúcido) |
| **C** | Caneta (fina e sólida) |
| **1** a **5** | Trocam a cor da ferramenta atual |
| **Roda do mouse** | Aumenta e diminui a espessura |
| **Esc** ou **botão direito** | Desligam o pincel |

Enquanto o pincel está **ligado**, o mouse desenha e **não clica** nos programas atrás — isso é
esperado. Aperte `Esc` ou `F8` para voltar ao normal.

Clique com o botão direito no ícone da bandeja para abrir as **Configurações**: tecla de atalho,
cor, espessura, opacidade, tempo do sumiço, uso em vários monitores e iniciar junto com o Windows.

## Para gravar no OBS

Use **captura de tela / display**, e não captura de uma janela específica. A captura de janela
pega só o programa escolhido e não enxerga o overlay.

## Se algo não funcionar

**A tecla F8 não liga o pincel.**
Provavelmente o programa que está em primeiro plano roda como administrador — o Windows não
entrega o atalho para apps comuns nesse caso. Abra o Marca Texto como administrador também
(botão direito no `Marca Texto.bat` > Executar como administrador). Outra possibilidade é a tecla
estar ocupada por outro programa: troque nas configurações (o app avisa quando a tecla está em uso).

**A tela pisca ao arrastar janelas.**
Com o pincel **desligado** isso não deve mais acontecer: a camada de desenho fica escondida, não
existe janela transparente por cima da tela. Se a piscada aparecer **enquanto o pincel está
ligado**, é o driver de vídeo com janela transparente. Abra `main.js` e descomente a linha:

```js
// app.disableHardwareAcceleration();
```

Depois feche o app pela bandeja e abra de novo.

**Troquei a resolução ou pluguei um monitor e o pincel sumiu.**
O app se refaz sozinho depois de meio segundo. Se não voltar, saia pela bandeja e abra de novo.

## Versão portátil (.exe)

Já existe um executável pronto em `dist`, que roda sem Node e sem instalação — dá para copiar
para um pendrive ou para outro PC com Windows 64 bits.

Na primeira vez o Windows pode mostrar a tela azul **"O Windows protegeu o computador"**: é o
SmartScreen avisando que o arquivo não tem assinatura digital (assinatura custa uma certificação
paga por ano). Clique em **Mais informações > Executar assim mesmo**. Só acontece uma vez.

Para gerar o executável de novo depois de mexer no código:

```bash
npm run empacotar
```

## Extensão para o navegador

Existe também uma versão que roda dentro do Chrome/Edge, na pasta `extensao-navegador`.
Ela usa **Alt+C** (o F8 fica com o aplicativo, que captura a tecla no Windows inteiro).
As instruções de instalação estão em [extensao-navegador/LEIA-ME.md](extensao-navegador/LEIA-ME.md).

Qual usar: o **aplicativo** marca por cima de qualquer programa (OBS, editor, slides, navegador);
a **extensão** só marca dentro das páginas, mas não toma o mouse do sistema e não depende de
janela transparente.

## Onde ficam as configurações

`%APPDATA%\marca-texto\config.json` — dá para editar na mão com o app fechado, mas o normal é
usar a janela de configurações.

## Estrutura do projeto

| Arquivo | Papel |
| --- | --- |
| `main.js` | Processo principal: janelas por monitor, atalho global, bandeja, config em disco |
| `preload.js` | Ponte segura entre as janelas e o processo principal |
| `overlay.html` / `overlay.js` | A camada de desenho: traço, fade, atalhos do pincel |
| `config.html` / `config.js` / `estilo.css` | Janela de configurações |
| `ferramentas/criar-icone.js` | Gera `assets/icone.png` (rode com `npm run icone`) |
