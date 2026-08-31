'use strict';
/*
 * O pincel dentro da pagina.
 *
 * Mesmo motor de desenho do aplicativo de desktop: cada traco vive enquanto o
 * botao do mouse estiver pressionado e some com um fade rapido ao soltar.
 *
 * Dois cuidados especificos de navegador:
 *  - tudo mora dentro de um shadow DOM, para o CSS do site nao mexer no pincel
 *    (e o CSS do pincel nao mexer no site);
 *  - com o pincel desligado nao sobra NADA na pagina: o elemento e removido.
 */

(function () {
  if (window.__marcaTextoPincel) return; // ja injetado nesta aba

  const PADRAO = {
    ferramenta: 'marcaTexto',
    marcaTexto: { cor: '#ffe000', espessura: 26, opacidade: 0.45 },
    caneta: { cor: '#ff2d2d', espessura: 5, opacidade: 1 },
    fadeMs: 300,
    paleta: ['#ffe000', '#ff2d2d', '#22c55e', '#3b82f6', '#ffffff']
  };

  const ESTILO = [
    ':host { all: initial; }',
    '.camada { position: fixed; inset: 0; z-index: 2147483647; }',
    'canvas { display: block; width: 100%; height: 100%; cursor: none; }',
    '.dica {',
    '  position: fixed; left: 50%; bottom: 46px; transform: translateX(-50%);',
    '  padding: 7px 16px; border-radius: 999px; background: rgba(16,17,21,0.82);',
    '  color: #f2f3f5; font: 600 14px/1 "Segoe UI", system-ui, sans-serif;',
    '  box-shadow: 0 4px 18px rgba(0,0,0,0.45); opacity: 0;',
    '  transition: opacity 220ms ease; pointer-events: none;',
    '}',
    '.dica.aparecer { opacity: 1; }',
    '.bolinha { display: inline-block; width: 10px; height: 10px; border-radius: 50%;',
    '  margin-right: 8px; vertical-align: -1px; box-shadow: 0 0 0 1px rgba(255,255,255,0.35) inset; }'
  ].join('\n');

  let cfg = JSON.parse(JSON.stringify(PADRAO));
  let ferramenta = cfg.ferramenta;
  let ativo = false;

  let hospedeiro = null, raiz = null, tela = null, ctx = null, dica = null;
  const fora = document.createElement('canvas');
  const ctxFora = fora.getContext('2d');

  let tracoAtual = null;
  const sumindo = [];
  let mouse = { x: -1, y: -1, dentro: false };
  let quadroPedido = false;
  let dicaTimer = null;
  let larg = 0, alt = 0, dpr = 1;

  /* ------------------------------------------------------------- montagem */

  function montar() {
    hospedeiro = document.createElement('div');
    hospedeiro.id = 'marca-texto-pincel';
    raiz = hospedeiro.attachShadow({ mode: 'open' });

    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;

    const camada = document.createElement('div');
    camada.className = 'camada';

    tela = document.createElement('canvas');
    dica = document.createElement('div');
    dica.className = 'dica';

    camada.appendChild(tela);
    camada.appendChild(dica);
    raiz.appendChild(estilo);
    raiz.appendChild(camada);
    // no documentElement: um transform no <body> nao desloca o position:fixed
    document.documentElement.appendChild(hospedeiro);

    ctx = tela.getContext('2d');
    dimensionar();
    ligarEventos();
  }

  function desmontar() {
    desligarEventos();
    if (hospedeiro && hospedeiro.parentNode) hospedeiro.parentNode.removeChild(hospedeiro);
    hospedeiro = raiz = tela = ctx = dica = null;
    tracoAtual = null;
    sumindo.length = 0;
    mouse.dentro = false;
  }

  function dimensionar() {
    if (!tela) return;
    dpr = window.devicePixelRatio || 1;
    larg = window.innerWidth;
    alt = window.innerHeight;
    for (const c of [tela, fora]) {
      c.width = Math.round(larg * dpr);
      c.height = Math.round(alt * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxFora.setTransform(dpr, 0, 0, dpr, 0, 0);
    pedirQuadro();
  }

  /* --------------------------------------------------------------- estilo */

  function estilo() {
    const base = cfg[ferramenta] || PADRAO.marcaTexto;
    return { cor: base.cor, espessura: base.espessura, opacidade: base.opacidade };
  }

  function nomeFerramenta() {
    return ferramenta === 'caneta' ? 'Caneta' : 'Marca-texto';
  }

  function mostrarDica(texto, cor) {
    if (!dica) return;
    dica.textContent = '';
    if (cor) {
      const bolinha = document.createElement('span');
      bolinha.className = 'bolinha';
      bolinha.style.background = cor;
      dica.appendChild(bolinha);
    }
    dica.appendChild(document.createTextNode(texto));
    dica.classList.add('aparecer');
    clearTimeout(dicaTimer);
    dicaTimer = setTimeout(function () { if (dica) dica.classList.remove('aparecer'); }, 900);
  }

  /* -------------------------------------------------------------- desenho */

  function novoTraco(x, y) {
    const e = estilo();
    return {
      pontos: [{ x: x, y: y }],
      cor: e.cor, espessura: e.espessura, opacidade: e.opacidade,
      minX: x, minY: y, maxX: x, maxY: y, t0: 0
    };
  }

  function acrescentarPonto(traco, x, y) {
    const ultimo = traco.pontos[traco.pontos.length - 1];
    if (Math.hypot(x - ultimo.x, y - ultimo.y) < 1.2) return;
    traco.pontos.push({ x: x, y: y });
    if (x < traco.minX) traco.minX = x;
    if (y < traco.minY) traco.minY = y;
    if (x > traco.maxX) traco.maxX = x;
    if (y > traco.maxY) traco.maxY = y;
  }

  function tracarCaminho(c, pontos, espessura) {
    if (pontos.length === 1) {
      c.beginPath();
      c.arc(pontos[0].x, pontos[0].y, espessura / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    c.moveTo(pontos[0].x, pontos[0].y);
    for (let i = 1; i < pontos.length - 1; i++) {
      const mx = (pontos[i].x + pontos[i + 1].x) / 2;
      const my = (pontos[i].y + pontos[i + 1].y) / 2;
      c.quadraticCurveTo(pontos[i].x, pontos[i].y, mx, my);
    }
    const fim = pontos[pontos.length - 1];
    c.lineTo(fim.x, fim.y);
    c.stroke();
  }

  // Marca-texto opaco no canvas de fora e so depois composto: sem isto, onde a
  // linha cruza consigo mesma fica uma mancha mais escura.
  function desenharTraco(traco, fade) {
    const margem = traco.espessura / 2 + 3;
    const bx = Math.max(0, traco.minX - margem);
    const by = Math.max(0, traco.minY - margem);
    const bl = Math.min(larg, traco.maxX + margem) - bx;
    const ba = Math.min(alt, traco.maxY + margem) - by;
    if (bl <= 0 || ba <= 0) return;

    ctxFora.clearRect(bx, by, bl, ba);
    ctxFora.strokeStyle = traco.cor;
    ctxFora.fillStyle = traco.cor;
    ctxFora.lineWidth = traco.espessura;
    ctxFora.lineCap = 'round';
    ctxFora.lineJoin = 'round';
    tracarCaminho(ctxFora, traco.pontos, traco.espessura);

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
    if (!ctx) return;
    ctx.clearRect(0, 0, larg, alt);
    if (!ativo) return;

    const agora = performance.now();
    const duracao = cfg.fadeMs;
    for (let i = sumindo.length - 1; i >= 0; i--) {
      const traco = sumindo[i];
      const k = duracao > 0 ? 1 - (agora - traco.t0) / duracao : 0;
      if (k <= 0) { sumindo.splice(i, 1); continue; }
      desenharTraco(traco, k * k);
    }
    if (tracoAtual) desenharTraco(tracoAtual, 1);
    desenharCursor();
  }

  function quadro() {
    quadroPedido = false;
    desenhar();
    if (sumindo.length) pedirQuadro();
  }

  function pedirQuadro() {
    if (quadroPedido || !ctx) return;
    quadroPedido = true;
    requestAnimationFrame(quadro);
  }

  /* --------------------------------------------------------------- gravar */

  let gravacaoAgendada = null;
  function gravarConfig() {
    // A sincronizacao do Chrome tem cota de gravacoes por minuto: junta as
    // mudancas da roda do mouse numa gravacao so.
    clearTimeout(gravacaoAgendada);
    gravacaoAgendada = setTimeout(function () {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ config: cfg });
        }
      } catch (e) { /* pagina sem acesso ao storage: segue sem gravar */ }
    }, 400);
  }

  /* -------------------------------------------------------------- eventos */

  function aoPointerDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    try { tela.setPointerCapture(e.pointerId); } catch (erro) {}
    mouse.dentro = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    tracoAtual = novoTraco(e.clientX, e.clientY);
    pedirQuadro();
  }

  function aoPointerMove(e) {
    mouse.dentro = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (tracoAtual) {
      const brutos = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      if (brutos.length) {
        for (const p of brutos) acrescentarPonto(tracoAtual, p.clientX, p.clientY);
      } else {
        acrescentarPonto(tracoAtual, e.clientX, e.clientY);
      }
    }
    pedirQuadro();
  }

  function aoSoltar() {
    if (!tracoAtual) return;
    tracoAtual.t0 = performance.now(); // aqui comeca o sumico
    sumindo.push(tracoAtual);
    tracoAtual = null;
    pedirQuadro();
  }

  function aoSair() {
    mouse.dentro = false;
    pedirQuadro();
  }

  function aoWheel(e) {
    e.preventDefault(); // nao rola a pagina: a roda regula a espessura
    e.stopPropagation();
    const atual = estilo();
    const nova = Math.max(2, Math.min(140, Math.round(atual.espessura + (e.deltaY < 0 ? 2 : -2))));
    if (nova === atual.espessura) return;
    cfg[ferramenta].espessura = nova;
    gravarConfig();
    mostrarDica(nomeFerramenta() + ' - ' + nova + ' px', atual.cor);
    pedirQuadro();
  }

  function aoContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    desligar();
  }

  // Em captura e com stopPropagation: a pagina por baixo nao recebe estas teclas.
  function aoKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      desligar();
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return; // nao atrapalha atalhos do navegador

    const tecla = e.key.toLowerCase();
    if (tecla === 'm' || tecla === 'c') {
      e.preventDefault();
      e.stopPropagation();
      ferramenta = tecla === 'm' ? 'marcaTexto' : 'caneta';
      cfg.ferramenta = ferramenta;
      gravarConfig();
      mostrarDica(nomeFerramenta() + ' - ' + estilo().espessura + ' px', estilo().cor);
      pedirQuadro();
      return;
    }
    if (tecla >= '1' && tecla <= '9') {
      const indice = Number(tecla) - 1;
      if (indice < cfg.paleta.length) {
        e.preventDefault();
        e.stopPropagation();
        cfg[ferramenta].cor = cfg.paleta[indice];
        gravarConfig();
        mostrarDica(nomeFerramenta(), cfg.paleta[indice]);
        pedirQuadro();
      }
    }
  }

  function ligarEventos() {
    tela.addEventListener('pointerdown', aoPointerDown);
    tela.addEventListener('pointermove', aoPointerMove);
    tela.addEventListener('pointerup', aoSoltar);
    tela.addEventListener('pointercancel', aoSoltar);
    tela.addEventListener('pointerleave', aoSair);
    tela.addEventListener('wheel', aoWheel, { passive: false });
    tela.addEventListener('contextmenu', aoContextMenu, true);
    window.addEventListener('keydown', aoKeyDown, true);
    window.addEventListener('resize', dimensionar);
  }

  function desligarEventos() {
    window.removeEventListener('keydown', aoKeyDown, true);
    window.removeEventListener('resize', dimensionar);
  }

  /* ------------------------------------------------------------- controle */

  function ligar() {
    if (ativo) return true;
    ativo = true;
    montar();
    pedirQuadro();
    return true;
  }

  function desligar() {
    if (!ativo) return false;
    ativo = false;
    desmontar(); // desligado = nada na pagina
    return false;
  }

  function alternar() {
    return ativo ? desligar() : ligar();
  }

  function aplicarCfg(nova) {
    if (!nova) return;
    cfg = Object.assign({}, PADRAO, nova);
    cfg.marcaTexto = Object.assign({}, PADRAO.marcaTexto, nova.marcaTexto);
    cfg.caneta = Object.assign({}, PADRAO.caneta, nova.caneta);
    ferramenta = cfg.ferramenta || 'marcaTexto';
    pedirQuadro();
  }

  window.__marcaTextoPincel = {
    ligar: ligar,
    desligar: desligar,
    alternar: alternar,
    aplicarCfg: aplicarCfg,
    estaAtivo: function () { return ativo; }
  };

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, remetente, responder) {
      if (!msg || msg.tipo !== 'alternar') return;
      aplicarCfg(msg.cfg);
      responder({ ativo: alternar() });
      return true;
    });
  }

  // Mudou algo na pagina de opcoes: aplica na hora, sem precisar recarregar.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (mudancas, area) {
      if (area === 'sync' && mudancas.config && mudancas.config.newValue) {
        aplicarCfg(mudancas.config.newValue);
      }
    });
  }
})();
