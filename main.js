'use strict';
/*
 * Marca Texto - pincel de anotacao temporaria sobre a tela.
 *
 * Processo principal: cria uma janela transparente por monitor, registra o
 * atalho global que liga/desliga o modo pincel, mantem o icone da bandeja e
 * guarda as configuracoes em disco.
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Se a janela transparente piscar ou ficar preta no seu driver de video,
// descomente a linha abaixo (desliga a aceleracao de hardware do Chromium).
// app.disableHardwareAcceleration();

const CAMINHO_ICONE = path.join(__dirname, 'assets', 'icone.png');

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
let ativo = false;
let bandeja = null;
let janelaConfig = null;
let atalhoRegistrado = null;
const overlays = new Map(); // id do monitor -> BrowserWindow

/* ------------------------------------------------------------------ config */

function arquivoConfig() {
  return path.join(app.getPath('userData'), 'config.json');
}

function mesclar(base, novo) {
  const saida = Object.assign({}, base);
  for (const chave of Object.keys(novo || {})) {
    const valor = novo[chave];
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      saida[chave] = Object.assign({}, base[chave], valor);
    } else if (valor !== undefined) {
      saida[chave] = valor;
    }
  }
  return saida;
}

function lerConfig() {
  try {
    cfg = mesclar(PADRAO, JSON.parse(fs.readFileSync(arquivoConfig(), 'utf8')));
  } catch (e) {
    cfg = JSON.parse(JSON.stringify(PADRAO)); // primeira execucao ou arquivo corrompido
  }
  return cfg;
}

function gravarConfig() {
  try {
    fs.writeFileSync(arquivoConfig(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Nao consegui salvar a configuracao:', e.message);
  }
}

function opcoesDeInicio(ligar) {
  const opcoes = { openAtLogin: !!ligar, args: [] };
  // No .exe portatil o programa roda a partir de uma pasta temporaria. Sem
  // apontar o caminho real, o Windows guardaria um atalho que some depois.
  if (process.env.PORTABLE_EXECUTABLE_FILE) opcoes.path = process.env.PORTABLE_EXECUTABLE_FILE;
  return opcoes;
}

function aplicarConfig(parcial, origem) {
  const antes = cfg;
  cfg = mesclar(cfg, parcial || {});
  gravarConfig();

  if (parcial && parcial.atalho && parcial.atalho !== antes.atalho) registrarAtalho();
  if (parcial && parcial.todosMonitores !== undefined && parcial.todosMonitores !== antes.todosMonitores) {
    criarOverlays();
  }
  if (parcial && parcial.iniciarComWindows !== undefined && parcial.iniciarComWindows !== antes.iniciarComWindows) {
    app.setLoginItemSettings(opcoesDeInicio(cfg.iniciarComWindows));
  }
  transmitirConfig(origem);
  atualizarBandeja();
}

function transmitirConfig(origem) {
  for (const win of overlays.values()) {
    if (win.isDestroyed() || win.webContents === origem) continue;
    win.webContents.send('overlay:config', cfg);
  }
  if (janelaConfig && !janelaConfig.isDestroyed() && janelaConfig.webContents !== origem) {
    janelaConfig.webContents.send('config:atualizada', cfg);
  }
}

/* ---------------------------------------------------------------- overlays */

function destruirOverlays() {
  for (const win of overlays.values()) if (!win.isDestroyed()) win.destroy();
  overlays.clear();
}

function criarOverlays() {
  destruirOverlays();
  const monitores = cfg.todosMonitores ? screen.getAllDisplays() : [screen.getPrimaryDisplay()];

  for (const monitor of monitores) {
    const { x, y, width, height } = monitor.bounds;
    const win = new BrowserWindow({
      x: x,
      y: y,
      width: width,
      height: height,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      hasShadow: false,
      enableLargerThanScreen: true,
      alwaysOnTop: true,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        // continua renderizando escondido: ao ligar o pincel a janela ja
        // aparece pronta, sem um quadro em branco
        paintWhenInitiallyHidden: true
      }
    });

    win.setAlwaysOnTop(true, 'screen-saver'); // acima ate de aplicativos em tela cheia
    win.setIgnoreMouseEvents(true, { forward: true }); // inativo: o clique atravessa
    win.setMenu(null);
    win.loadFile('overlay.html');

    win.once('ready-to-show', () => {
      win.setBounds({ x: x, y: y, width: width, height: height }); // reforca apos o DPI
      // Com o pincel desligado a janela fica ESCONDIDA. Uma janela transparente
      // sempre no topo faz o Windows redesenhar tudo o que passa por baixo dela,
      // e e isso que aparece como piscada ao arrastar outra janela.
      if (ativo) win.showInactive();
      win.webContents.send('overlay:estado', { ativo: ativo, cfg: cfg });
    });

    overlays.set(monitor.id, win);
  }
}

function overlaySobOCursor() {
  const ponto = screen.getCursorScreenPoint();
  const monitor = screen.getDisplayNearestPoint(ponto);
  return overlays.get(monitor.id) || overlays.values().next().value;
}

function alternar(ligar) {
  ativo = ligar === undefined ? !ativo : !!ligar;

  for (const win of overlays.values()) {
    if (win.isDestroyed()) continue;
    win.setIgnoreMouseEvents(!ativo, { forward: true });
    win.webContents.send('overlay:estado', { ativo: ativo, cfg: cfg });
    if (ativo) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.showInactive();
    } else {
      win.hide(); // some da tela: sem janela transparente por cima, sem piscada
    }
  }

  if (ativo) {
    const alvo = overlaySobOCursor();
    if (alvo && !alvo.isDestroyed()) alvo.focus(); // foco para receber M, C, 1-5 e Esc
  }

  atualizarBandeja();
}

/* ----------------------------------------------------------- atalho global */

function registrarAtalho() {
  if (atalhoRegistrado) {
    try { globalShortcut.unregister(atalhoRegistrado); } catch (e) {}
    atalhoRegistrado = null;
  }

  const tentar = function (acelerador) {
    try {
      if (globalShortcut.register(acelerador, function () { alternar(); })) {
        atalhoRegistrado = acelerador;
        return true;
      }
    } catch (e) {}
    return false;
  };

  if (tentar(cfg.atalho)) return true;

  // A tecla escolhida esta ocupada por outro programa: volta para o padrao.
  console.warn('Nao consegui registrar o atalho ' + cfg.atalho + '; tentando ' + PADRAO.atalho);
  if (cfg.atalho !== PADRAO.atalho && tentar(PADRAO.atalho)) {
    cfg.atalho = PADRAO.atalho;
    gravarConfig();
    transmitirConfig(null);
  }
  return false;
}

/* -------------------------------------------------------------- janela cfg */

function abrirConfig() {
  if (janelaConfig && !janelaConfig.isDestroyed()) {
    janelaConfig.show();
    janelaConfig.focus();
    return;
  }
  janelaConfig = new BrowserWindow({
    width: 470,
    height: 720,
    resizable: true,
    maximizable: false,
    title: 'Marca Texto - Configuracoes',
    icon: CAMINHO_ICONE,
    backgroundColor: '#15161a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  janelaConfig.setMenu(null);
  janelaConfig.loadFile('config.html');
  janelaConfig.once('ready-to-show', function () { janelaConfig.show(); });
  janelaConfig.on('close', function (e) { // fechar apenas esconde: o app vive na bandeja
    if (!app.encerrando) {
      e.preventDefault();
      janelaConfig.hide();
    }
  });
}

/* ----------------------------------------------------------------- bandeja */

function atualizarBandeja() {
  if (!bandeja) return;
  bandeja.setToolTip('Marca Texto - ' + (ativo ? 'pincel LIGADO' : 'pincel desligado') + ' [' + cfg.atalho + ']');
  bandeja.setContextMenu(Menu.buildFromTemplate([
    {
      label: ativo ? 'Desligar pincel' : 'Ligar pincel [' + cfg.atalho + ']',
      click: function () { alternar(); }
    },
    { type: 'separator' },
    { label: 'Configuracoes...', click: abrirConfig },
    {
      label: 'Iniciar com o Windows',
      type: 'checkbox',
      checked: !!cfg.iniciarComWindows,
      click: function (item) { aplicarConfig({ iniciarComWindows: item.checked }); }
    },
    { type: 'separator' },
    { label: 'Sair', click: function () { app.encerrando = true; app.quit(); } }
  ]));
}

function criarBandeja() {
  const icone = nativeImage.createFromPath(CAMINHO_ICONE);
  bandeja = new Tray(icone.isEmpty() ? nativeImage.createEmpty() : icone);
  bandeja.on('double-click', function () { alternar(); });
  atualizarBandeja();
}

/* --------------------------------------------------------------------- IPC */

ipcMain.handle('config:obter', function () { return cfg; });

ipcMain.handle('config:salvar', function (evento, parcial) {
  aplicarConfig(parcial, evento.sender);
  return cfg;
});

ipcMain.handle('atalho:testar', function (evento, acelerador) {
  if (!acelerador) return false;
  if (acelerador === cfg.atalho) return true; // ja e o nosso, obviamente funciona
  try {
    if (!globalShortcut.register(acelerador, function () {})) return false;
    globalShortcut.unregister(acelerador);
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.on('overlay:sair', function () { alternar(false); });

ipcMain.on('overlay:foco', function (evento) {
  // O mouse entrou em outro monitor: passa o foco do teclado para aquele overlay.
  if (!ativo) return;
  const win = BrowserWindow.fromWebContents(evento.sender);
  if (win && !win.isDestroyed() && !win.isFocused()) win.focus();
});

/* ------------------------------------------------------------------- ciclo */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', abrirConfig);

  app.whenReady().then(function () {
    lerConfig();
    gravarConfig(); // deixa o arquivo no disco ja na primeira execucao
    app.setLoginItemSettings(opcoesDeInicio(cfg.iniciarComWindows));
    criarOverlays();
    criarBandeja();
    registrarAtalho();

    let recriando = null;
    const recriar = function () { // monitor plugado/desplugado ou resolucao alterada
      clearTimeout(recriando);
      recriando = setTimeout(function () { criarOverlays(); alternar(false); }, 400);
    };
    screen.on('display-added', recriar);
    screen.on('display-removed', recriar);
    screen.on('display-metrics-changed', recriar);
  });

  app.on('window-all-closed', function () { /* o app continua vivo na bandeja */ });
  app.on('before-quit', function () { app.encerrando = true; });
  app.on('will-quit', function () { globalShortcut.unregisterAll(); });
}
