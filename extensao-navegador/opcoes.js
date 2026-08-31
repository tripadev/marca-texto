'use strict';
/* Pagina de opcoes da extensao: le e grava em chrome.storage.sync. */

const PADRAO = {
  ferramenta: 'marcaTexto',
  marcaTexto: { cor: '#ffe000', espessura: 26, opacidade: 0.45 },
  caneta: { cor: '#ff2d2d', espessura: 5, opacidade: 1 },
  fadeMs: 300,
  paleta: ['#ffe000', '#ff2d2d', '#22c55e', '#3b82f6', '#ffffff']
};

let cfg = JSON.parse(JSON.stringify(PADRAO));

const $ = function (id) { return document.getElementById(id); };

/* ----------------------------------------------------------------- previa */

const previa = $('previa');
const ctx = previa.getContext('2d');
const fora = document.createElement('canvas');
const ctxFora = fora.getContext('2d');
fora.width = previa.width;
fora.height = previa.height;

function ondulado(x0, y0, x1) {
  const pontos = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pontos.push({ x: x0 + (x1 - x0) * t, y: y0 + Math.sin(t * Math.PI * 2) * 4 });
  }
  return pontos;
}

function tracarPrevia(pontos, cor, espessura, opacidade) {
  ctxFora.clearRect(0, 0, fora.width, fora.height);
  ctxFora.strokeStyle = cor;
  ctxFora.lineWidth = espessura * 2; // a previa esta em escala 2x
  ctxFora.lineCap = 'round';
  ctxFora.lineJoin = 'round';
  ctxFora.beginPath();
  ctxFora.moveTo(pontos[0].x, pontos[0].y);
  for (let i = 1; i < pontos.length; i++) ctxFora.lineTo(pontos[i].x, pontos[i].y);
  ctxFora.stroke();

  ctx.globalAlpha = opacidade;
  ctx.drawImage(fora, 0, 0);
  ctx.globalAlpha = 1;
}

function desenharPrevia() {
  ctx.clearRect(0, 0, previa.width, previa.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, previa.width, previa.height);
  ctx.fillStyle = '#1c1c1c';
  ctx.font = '600 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('texto da pagina por baixo', 40, 62);
  ctx.fillStyle = '#4a4a4a';
  ctx.font = '400 28px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('e uma segunda linha de exemplo', 40, 132);

  tracarPrevia(ondulado(40, 52, 640), cfg.marcaTexto.cor, cfg.marcaTexto.espessura, cfg.marcaTexto.opacidade);
  tracarPrevia(ondulado(40, 124, 560), cfg.caneta.cor, cfg.caneta.espessura, cfg.caneta.opacidade);
}

/* ------------------------------------------------------------------ salvar */

let timer = null;
function salvar() {
  clearTimeout(timer);
  timer = setTimeout(function () {
    chrome.storage.sync.set({ config: cfg }, function () {
      $('salvo').textContent = 'Salvo';
      setTimeout(function () { $('salvo').textContent = ''; }, 1200);
    });
  }, 150); // junta os arrastos do slider numa gravacao so (cota do Chrome)
}

/* ------------------------------------------------------------- ferramentas */

function montarPaleta(ferramenta, elemento) {
  elemento.textContent = '';
  cfg.paleta.forEach(function (cor) {
    const botao = document.createElement('button');
    botao.className = 'amostra' + (cor.toLowerCase() === cfg[ferramenta].cor.toLowerCase() ? ' escolhida' : '');
    botao.style.background = cor;
    botao.title = cor;
    botao.addEventListener('click', function () {
      cfg[ferramenta].cor = cor;
      salvar();
      preencher();
    });
    elemento.appendChild(botao);
  });
}

function ligarFerramenta(ferramenta, sufixo) {
  $('cor' + sufixo).addEventListener('input', function () {
    cfg[ferramenta].cor = this.value;
    salvar();
    preencher();
  });
  $('esp' + sufixo).addEventListener('input', function () {
    cfg[ferramenta].espessura = Number(this.value);
    salvar();
    preencher();
  });
  $('op' + sufixo).addEventListener('input', function () {
    cfg[ferramenta].opacidade = Number(this.value) / 100;
    salvar();
    preencher();
  });
}

/* --------------------------------------------------------------- preencher */

function preencher() {
  montarPaleta('marcaTexto', $('paletaMarcaTexto'));
  montarPaleta('caneta', $('paletaCaneta'));

  $('corMarcaTexto').value = cfg.marcaTexto.cor;
  $('espMarcaTexto').value = cfg.marcaTexto.espessura;
  $('vEspMarcaTexto').textContent = cfg.marcaTexto.espessura + ' px';
  $('opMarcaTexto').value = Math.round(cfg.marcaTexto.opacidade * 100);
  $('vOpMarcaTexto').textContent = Math.round(cfg.marcaTexto.opacidade * 100) + '%';

  $('corCaneta').value = cfg.caneta.cor;
  $('espCaneta').value = cfg.caneta.espessura;
  $('vEspCaneta').textContent = cfg.caneta.espessura + ' px';
  $('opCaneta').value = Math.round(cfg.caneta.opacidade * 100);
  $('vOpCaneta').textContent = Math.round(cfg.caneta.opacidade * 100) + '%';

  $('fade').value = cfg.fadeMs;
  $('vFade').textContent = cfg.fadeMs === 0 ? 'na hora' : (cfg.fadeMs / 1000).toFixed(2) + ' s';

  for (const r of document.getElementsByName('ferramenta')) r.checked = (r.value === cfg.ferramenta);

  desenharPrevia();
}

/* ----------------------------------------------------------- outros campos */

$('fade').addEventListener('input', function () {
  cfg.fadeMs = Number(this.value);
  salvar();
  preencher();
});

for (const r of document.getElementsByName('ferramenta')) {
  r.addEventListener('change', function () {
    if (!this.checked) return;
    cfg.ferramenta = this.value;
    salvar();
    preencher();
  });
}

$('abrirAtalhos').addEventListener('click', function () {
  // Uma pagina de extensao nao pode abrir chrome:// por link, so pelo chrome.tabs.
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

$('restaurar').addEventListener('click', function () {
  cfg = JSON.parse(JSON.stringify(PADRAO));
  salvar();
  preencher();
});

/* ------------------------------------------------------------------ inicio */

ligarFerramenta('marcaTexto', 'MarcaTexto');
ligarFerramenta('caneta', 'Caneta');

chrome.storage.sync.get('config', function (guardado) {
  cfg = Object.assign({}, PADRAO, guardado.config || {});
  cfg.marcaTexto = Object.assign({}, PADRAO.marcaTexto, cfg.marcaTexto);
  cfg.caneta = Object.assign({}, PADRAO.caneta, cfg.caneta);
  preencher();
});
