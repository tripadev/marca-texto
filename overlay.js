'use strict';
/*
 * Camada de desenho do Marca Texto.
 *
 * Cada traco vive enquanto o botao do mouse estiver pressionado; ao soltar,
 * ele entra na lista "sumindo" e desaparece com um fade rapido.
 *
 * Truque importante: um traco de marca-texto desenhado direto com alpha fica
 * com manchas escuras onde a linha cruza consigo mesma. Por isso cada traco e
 * desenhado OPACO num canvas fora da tela e so depois composto no canvas
 * visivel com a opacidade da ferramenta.
 */

const tela = document.getElementById('tela');
const ctx = tela.getContext('2d');
const fora = document.createElement('canvas');
const ctxFora = fora.getContext('2d');
const dica = document.getElementById('dica');

let cfg = null;
let ativo = false;
let ferramenta = 'marcaTexto';

let tracoAtual = null;      // traco sendo desenhado agora
const sumindo = [];         // tracos ja soltos, desaparecendo
let mouse = { x: -1, y: -1, dentro: false };
let quadroPedido = false;
let dicaTimer = null;
let larg = 0;
let alt = 0;
let dpr = 1;

/* ------------------------------------------------------------ dimensionar */

function dimensionar() {
  dpr = window.devicePixelRatio || 1;
  larg = window.innerWidth;
  alt = window.innerHeight;
  for (const c of [tela, fora]) {
    c.width = Math.round(larg * dpr);
    c.height = Math.round(alt * dpr);
  }
  tela.style.width = larg + 'px';
  tela.style.height = alt + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctxFora.setTransform(dpr, 0, 0, dpr, 0, 0);
  pedirQuadro();
}
window.addEventListener('resize', dimensionar);

/* ----------------------------------------------------------------- estilo */

function estilo() {
  const base = (cfg && cfg[ferramenta]) || { cor: '#ffe000', espessura: 26, opacidade: 0.45 };
  return {
    ferramenta: ferramenta,
    cor: base.cor,
    espessura: base.espessura,
    opacidade: base.opacidade
  };
}

function nomeFerramenta() {
  return ferramenta === 'caneta' ? 'Caneta' : 'Marca-texto';
}

function mostrarDica(texto, cor) {
  dica.innerHTML = '';
  if (cor) {
    const bolinha = document.createElement('span');
    bolinha.className = 'bolinha';
    bolinha.style.background = cor;
    dica.appendChild(bolinha);
  }
  dica.appendChild(document.createTextNode(texto));
  dica.classList.add('aparecer');
  clearTimeout(dicaTimer);
  dicaTimer = setTimeout(function () { dica.classList.remove('aparecer'); }, 900);
}

/* ---------------------------------------------------------------- desenho */

function novoTraco(x, y) {
  const e = estilo();
  return {
    pontos: [{ x: x, y: y }],
    cor: e.cor,
    espessura: e.espessura,
    opacidade: e.opacidade,
    minX: x, minY: y, maxX: x, maxY: y,
    t0: 0
  };
}

function acrescentarPonto(traco, x, y) {
  const ultimo = traco.pontos[traco.pontos.length - 1];
  if (Math.hypot(x - ultimo.x, y - ultimo.y) < 1.2) return; // ignora tremidas minimas
  traco.pontos.push({ x: x, y: y });
  if (x < traco.minX) traco.minX = x;
  if (y < traco.minY) traco.minY = y;
  if (x > traco.maxX) traco.maxX = x;
  if (y > traco.maxY) traco.maxY = y;
}

function tracarCaminho(c, pontos, espessura) {
  if (pontos.length === 1) { // clique sem arrastar: um pingo redondo
    c.beginPath();
    c.arc(pontos[0].x, pontos[0].y, espessura / 2, 0, Math.PI * 2);
    c.fill();
    return;
  }
  c.beginPath();
  c.moveTo(pontos[0].x, pontos[0].y);
  for (let i = 1; i < pontos.length - 1; i++) {
    // curva suave passando pelos pontos medios: tira o serrilhado do mouse
    const mx = (pontos[i].x + pontos[i + 1].x) / 2;
    const my = (pontos[i].y + pontos[i + 1].y) / 2;
    c.quadraticCurveTo(pontos[i].x, pontos[i].y, mx, my);
  }
  const fim = pontos[pontos.length - 1];
  c.lineTo(fim.x, fim.y);
  c.stroke();
}

function desenharTraco(traco, fade) {
  const margem = traco.espessura / 2 + 3;
  const bx = Math.max(0, traco.minX - margem);
  const by = Math.max(0, traco.minY - margem);
  const bl = Math.min(larg, traco.maxX + margem) - bx;
  const ba = Math.min(alt, traco.maxY + margem) - by;
  if (bl <= 0 || ba <= 0) return;

  // 1) traco opaco no canvas fora da tela (so a area util)
  ctxFora.clearRect(bx, by, bl, ba);
  ctxFora.strokeStyle = traco.cor;
  ctxFora.fillStyle = traco.cor;
  ctxFora.lineWidth = traco.espessura;
  ctxFora.lineCap = 'round';
  ctxFora.lineJoin = 'round';
  tracarCaminho(ctxFora, traco.pontos, traco.espessura);

  // 2) composicao com a opacidade da ferramenta e o fade
  ctx.globalAlpha = Math.max(0, Math.min(1, traco.opacidade * fade));
  ctx.drawImage(fora, bx * dpr, by * dpr, bl * dpr, ba * dpr, bx, by, bl, ba);
  ctx.globalAlpha = 1;
}

function desenharCursor() {
  if (!mouse.dentro || tracoAtual) return;
  const e = estilo();
  const r = Math.max(3, e.espessura / 2);
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = e.cor;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function desenhar() {
  ctx.clearRect(0, 0, larg, alt);
  if (!ativo) return;

  const agora = performance.now();
  const duracao = cfg ? cfg.fadeMs : 300;

  for (let i = sumindo.length - 1; i >= 0; i--) {
    const traco = sumindo[i];
    const k = duracao > 0 ? 1 - (agora - traco.t0) / duracao : 0;
    if (k <= 0) { sumindo.splice(i, 1); continue; }
    desenharTraco(traco, k * k); // fade com aceleracao no fim
  }
  if (tracoAtual) desenharTraco(tracoAtual, 1);
  desenharCursor();
}

function quadro() {
  quadroPedido = false;
  desenhar();
  if (sumindo.length) pedirQuadro(); // continua animando enquanto houver fade
}

function pedirQuadro() {
  if (quadroPedido) return;
  quadroPedido = true;
  requestAnimationFrame(quadro);
}

/* --------------------------------------------------------------- ponteiro */

let ultimoPedidoFoco = 0;

tela.addEventListener('pointerdown', function (e) {
  if (!ativo || e.button !== 0) return;
  tela.setPointerCapture(e.pointerId);
  mouse.dentro = true;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  tracoAtual = novoTraco(e.clientX, e.clientY);
  pedirQuadro();
});

tela.addEventListener('pointermove', function (e) {
  if (!ativo) return;
  mouse.dentro = true;
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  if (tracoAtual) {
    // usa os eventos intermediarios do mouse: traco liso mesmo movendo rapido
    const brutos = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    if (brutos.length) {
      for (const p of brutos) acrescentarPonto(tracoAtual, p.clientX, p.clientY);
    } else {
      acrescentarPonto(tracoAtual, e.clientX, e.clientY);
    }
  } else if (!document.hasFocus() && performance.now() - ultimoPedidoFoco > 500) {
    // o mouse passou para este monitor: pede o foco para o teclado funcionar aqui
    ultimoPedidoFoco = performance.now();
    window.marcaTexto.pedirFoco();
  }
  pedirQuadro();
});

function soltar() {
  if (!tracoAtual) return;
  tracoAtual.t0 = performance.now();
  sumindo.push(tracoAtual); // aqui comeca o sumico
  tracoAtual = null;
  pedirQuadro();
}
tela.addEventListener('pointerup', soltar);
tela.addEventListener('pointercancel', soltar);

tela.addEventListener('pointerleave', function () {
  mouse.dentro = false;
  pedirQuadro();
});

tela.addEventListener('wheel', function (e) {
  if (!ativo) return;
  e.preventDefault();
  const passo = e.deltaY < 0 ? 2 : -2;
  const atual = estilo();
  const nova = Math.max(2, Math.min(140, Math.round(atual.espessura + passo)));
  if (nova === atual.espessura) return;
  const parcial = {};
  parcial[ferramenta] = { espessura: nova };
  cfg[ferramenta].espessura = nova;
  window.marcaTexto.salvarConfig(parcial);
  mostrarDica(nomeFerramenta() + ' - ' + nova + ' px', atual.cor);
  pedirQuadro();
}, { passive: false });

// Botao direito tambem sai do modo pincel.
window.addEventListener('contextmenu', function (e) {
  e.preventDefault();
  if (ativo) window.marcaTexto.sair();
});

/* ---------------------------------------------------------------- teclado */

window.addEventListener('keydown', function (e) {
  if (!ativo) return;

  if (e.key === 'Escape') {
    window.marcaTexto.sair();
    return;
  }
  const tecla = e.key.toLowerCase();

  if (tecla === 'm' || tecla === 'c') {
    ferramenta = tecla === 'm' ? 'marcaTexto' : 'caneta';
    window.marcaTexto.salvarConfig({ ferramenta: ferramenta });
    mostrarDica(nomeFerramenta() + ' - ' + estilo().espessura + ' px', estilo().cor);
    pedirQuadro();
    return;
  }
  if (tecla >= '1' && tecla <= '9') {
    const indice = Number(tecla) - 1;
    const paleta = (cfg && cfg.paleta) || [];
    if (indice < paleta.length) {
      const cor = paleta[indice];
      cfg[ferramenta].cor = cor;
      const parcial = {};
      parcial[ferramenta] = { cor: cor };
      window.marcaTexto.salvarConfig(parcial);
      mostrarDica(nomeFerramenta(), cor);
      pedirQuadro();
    }
  }
});

/* -------------------------------------------------------------- do processo principal */

window.marcaTexto.aoEstado(function (dados) {
  cfg = dados.cfg;
  ferramenta = cfg.ferramenta || 'marcaTexto';
  ativo = dados.ativo;
  if (!ativo) { // desligou: limpa tudo na hora
    tracoAtual = null;
    sumindo.length = 0;
    mouse.dentro = false;
    dica.classList.remove('aparecer');
  }
  document.body.style.cursor = ativo ? 'none' : 'default';
  pedirQuadro();
});

window.marcaTexto.aoConfig(function (nova) {
  cfg = nova;
  ferramenta = cfg.ferramenta || ferramenta;
  pedirQuadro();
});

dimensionar();
