'use strict';
/* Janela de configuracoes: le e grava a config pelo processo principal. */

const PADRAO = {
  atalho: 'F8',
  ferramenta: 'marcaTexto',
  marcaTexto: { cor: '#ffe000', espessura: 26, opacidade: 0.45 },
  caneta: { cor: '#ff2d2d', espessura: 5, opacidade: 1 },
  fadeMs: 300,
  paleta: ['#ffe000', '#ff2d2d', '#22c55e', '#3b82f6', '#ffffff'],
  todosMonitores: true,
  iniciarComWindows: false
};

let cfg = JSON.parse(JSON.stringify(PADRAO));
let gravandoTecla = false;

const $ = function (id) { return document.getElementById(id); };

/* ----------------------------------------------------------------- previa */

const previa = $('previa');
const ctx = previa.getContext('2d');
const fora = document.createElement('canvas');
const ctxFora = fora.getContext('2d');
fora.width = previa.width;
fora.height = previa.height;

function ondulado(x0, y0, x1, largura) {
  const pontos = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
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

  // texto de fundo, para dar para julgar a transparencia do marca-texto
  ctx.fillStyle = '#1c1c1c';
  ctx.font = '600 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('texto da sua tela por baixo', 40, 62);
  ctx.fillStyle = '#4a4a4a';
  ctx.font = '400 28px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('e uma segunda linha de exemplo', 40, 132);

  tracarPrevia(ondulado(40, 52, 640), cfg.marcaTexto.cor, cfg.marcaTexto.espessura, cfg.marcaTexto.opacidade);
  tracarPrevia(ondulado(40, 124, 560), cfg.caneta.cor, cfg.caneta.espessura, cfg.caneta.opacidade);
}

/* ------------------------------------------------------------------ salvar */

let pendente = null;
let timer = null;
function salvar(parcial) {
  const anterior = pendente || {};
  const combinado = Object.assign({}, anterior, parcial);
  // mescla os objetos internos em vez de trocar: sem isto, mexer na cor e logo
  // depois na espessura (dentro da mesma janela de 120 ms) perderia a cor
  for (const chave of ['marcaTexto', 'caneta']) {
    if (anterior[chave] && parcial[chave]) {
      combinado[chave] = Object.assign({}, anterior[chave], parcial[chave]);
    }
  }
  pendente = combinado;
  clearTimeout(timer);
  timer = setTimeout(function () {
    const envio = pendente;
    pendente = null;
    window.marcaTexto.salvarConfig(envio).then(function (nova) { cfg = nova; });
  }, 120); // junta arrastos do slider numa gravacao so
}

/* ------------------------------------------------------------- ferramentas */

function montarPaleta(ferramenta, elemento) {
  elemento.innerHTML = '';
  cfg.paleta.forEach(function (cor) {
    const botao = document.createElement('button');
    botao.className = 'amostra' + (cor.toLowerCase() === cfg[ferramenta].cor.toLowerCase() ? ' escolhida' : '');
    botao.style.background = cor;
    botao.title = cor;
    botao.addEventListener('click', function () {
      cfg[ferramenta].cor = cor;
      const parcial = {};
      parcial[ferramenta] = { cor: cor };
      salvar(parcial);
      preencher();
    });
    elemento.appendChild(botao);
  });
}

function ligarFerramenta(ferramenta, sufixo) {
  const cor = $('cor' + sufixo);
  const esp = $('esp' + sufixo);
  const op = $('op' + sufixo);

  cor.addEventListener('input', function () {
    cfg[ferramenta].cor = cor.value;
    const parcial = {};
    parcial[ferramenta] = { cor: cor.value };
    salvar(parcial);
    preencher();
  });
  esp.addEventListener('input', function () {
    cfg[ferramenta].espessura = Number(esp.value);
    const parcial = {};
    parcial[ferramenta] = { espessura: Number(esp.value) };
    salvar(parcial);
    preencher();
  });
  op.addEventListener('input', function () {
    cfg[ferramenta].opacidade = Number(op.value) / 100;
    const parcial = {};
    parcial[ferramenta] = { opacidade: Number(op.value) / 100 };
    salvar(parcial);
    preencher();
  });
}

/* ---------------------------------------------------------------- preencher */

function preencher() {
  $('gravarTecla').textContent = gravandoTecla ? 'Aperte a tecla...' : cfg.atalho;

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

  const radios = document.getElementsByName('ferramenta');
  for (const r of radios) r.checked = (r.value === cfg.ferramenta);

  $('todosMonitores').checked = !!cfg.todosMonitores;
  $('iniciarComWindows').checked = !!cfg.iniciarComWindows;

  desenharPrevia();
}

/* -------------------------------------------------------------- atalho */

function aceleradorDoEvento(e) {
  const mods = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey) mods.push('Super');

  const codigo = e.code || '';
  let tecla = null;

  if (/^F\d{1,2}$/.test(e.key)) tecla = e.key;
  else if (codigo.indexOf('Key') === 0) tecla = codigo.slice(3);
  else if (codigo.indexOf('Digit') === 0) tecla = codigo.slice(5);
  else if (codigo.indexOf('Numpad') === 0) tecla = 'num' + codigo.slice(6).toLowerCase();
  else if (e.key === ' ') tecla = 'Space';
  else if (['Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Delete', 'Backspace', 'Tab'].indexOf(e.key) >= 0) tecla = e.key;
  else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) tecla = e.key.slice(5);
  else if (['Control', 'Alt', 'Shift', 'Meta'].indexOf(e.key) >= 0) return null; // so modificador
  else if (e.key.length === 1) tecla = e.key.toUpperCase();

  if (!tecla) return null;
  return mods.concat([tecla]).join('+');
}

$('gravarTecla').addEventListener('click', function () {
  gravandoTecla = true;
  $('gravarTecla').classList.add('gravando');
  $('avisoTecla').textContent = 'Aperte agora a tecla (ou combinacao) que vai ligar o pincel. Esc cancela.';
  $('avisoTecla').className = 'aviso ok';
  preencher();
});

window.addEventListener('keydown', function (e) {
  if (!gravandoTecla) return;
  e.preventDefault();

  if (e.key === 'Escape') {
    gravandoTecla = false;
    $('gravarTecla').classList.remove('gravando');
    $('avisoTecla').textContent = '';
    preencher();
    return;
  }

  const acelerador = aceleradorDoEvento(e);
  if (!acelerador) return; // ainda so segurando Ctrl/Alt/Shift

  window.marcaTexto.testarAtalho(acelerador).then(function (livre) {
    if (!livre) {
      $('avisoTecla').className = 'aviso';
      $('avisoTecla').textContent = acelerador + ' esta ocupada por outro programa. Tente outra.';
      return;
    }
    gravandoTecla = false;
    $('gravarTecla').classList.remove('gravando');
    cfg.atalho = acelerador;
    salvar({ atalho: acelerador });
    $('avisoTecla').className = 'aviso ok';
    $('avisoTecla').textContent = 'Pronto: ' + acelerador + ' liga e desliga o pincel.';
    preencher();
  });
});

$('restaurarTecla').addEventListener('click', function () {
  gravandoTecla = false;
  $('gravarTecla').classList.remove('gravando');
  cfg.atalho = PADRAO.atalho;
  salvar({ atalho: PADRAO.atalho });
  $('avisoTecla').className = 'aviso ok';
  $('avisoTecla').textContent = 'Atalho de volta para F8.';
  preencher();
});

/* --------------------------------------------------------- outros campos */

$('fade').addEventListener('input', function () {
  cfg.fadeMs = Number($('fade').value);
  salvar({ fadeMs: cfg.fadeMs });
  preencher();
});

for (const r of document.getElementsByName('ferramenta')) {
  r.addEventListener('change', function () {
    if (!r.checked) return;
    cfg.ferramenta = r.value;
    salvar({ ferramenta: r.value });
    preencher();
  });
}

$('todosMonitores').addEventListener('change', function () {
  cfg.todosMonitores = $('todosMonitores').checked;
  salvar({ todosMonitores: cfg.todosMonitores });
});

$('iniciarComWindows').addEventListener('change', function () {
  cfg.iniciarComWindows = $('iniciarComWindows').checked;
  salvar({ iniciarComWindows: cfg.iniciarComWindows });
});

$('restaurar').addEventListener('click', function () {
  cfg = JSON.parse(JSON.stringify(PADRAO));
  salvar(JSON.parse(JSON.stringify(PADRAO)));
  $('avisoTecla').className = 'aviso ok';
  $('avisoTecla').textContent = 'Configuracoes restauradas.';
  preencher();
});

$('fechar').addEventListener('click', function () { window.close(); });

/* ------------------------------------------------------------------ inicio */

ligarFerramenta('marcaTexto', 'MarcaTexto');
ligarFerramenta('caneta', 'Caneta');

window.marcaTexto.obterConfig().then(function (nova) {
  cfg = nova;
  preencher();
});

window.marcaTexto.aoConfigAtualizada(function (nova) {
  cfg = nova; // mudou pelo overlay (M/C, roda do mouse, 1-5)
  preencher();
});
