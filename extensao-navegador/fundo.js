'use strict';
/*
 * Service worker da extensao.
 *
 * Ele nao desenha nada: so injeta o pincel na aba atual quando voce aperta a
 * tecla (ou clica no icone) e manda ligar/desligar.
 *
 * A extensao usa a permissao "activeTab": ela so enxerga a pagina no momento
 * em que voce aciona o pincel, e nenhuma outra. Por isso ela nao pede acesso
 * a "todos os seus dados em todos os sites".
 */

const PADRAO = {
  ferramenta: 'marcaTexto',
  marcaTexto: { cor: '#ffe000', espessura: 26, opacidade: 0.45 },
  caneta: { cor: '#ff2d2d', espessura: 5, opacidade: 1 },
  fadeMs: 300,
  paleta: ['#ffe000', '#ff2d2d', '#22c55e', '#3b82f6', '#ffffff']
};

async function lerConfig() {
  try {
    const guardado = await chrome.storage.sync.get('config');
    return Object.assign({}, PADRAO, guardado.config || {});
  } catch (e) {
    return PADRAO;
  }
}

function aviso(tabId, texto) {
  // Sem alerta invasivo: so um selo vermelho no icone por alguns segundos.
  chrome.action.setBadgeBackgroundColor({ color: '#c62828' });
  chrome.action.setBadgeText({ tabId: tabId, text: '!' });
  chrome.action.setTitle({ tabId: tabId, title: 'Marca Texto - ' + texto });
  setTimeout(function () {
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
    chrome.action.setTitle({ tabId: tabId, title: 'Marca Texto - ligar/desligar o pincel (Alt+C)' });
  }, 4000);
}

async function alternarNaAba(aba) {
  if (!aba || aba.id === undefined) return;

  const url = aba.url || '';
  if (/^(chrome|edge|about|devtools|view-source):/.test(url) || url.indexOf('chromewebstore.google.com') >= 0) {
    aviso(aba.id, 'o navegador nao permite desenhar nesta pagina');
    return;
  }

  try {
    // Injeta o pincel (o proprio arquivo se protege contra injecao repetida).
    await chrome.scripting.insertCSS({ target: { tabId: aba.id }, files: ['conteudo.css'] });
    await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ['conteudo.js'] });

    const cfg = await lerConfig();
    const resposta = await chrome.tabs.sendMessage(aba.id, { tipo: 'alternar', cfg: cfg });
    const ligado = resposta && resposta.ativo;
    chrome.action.setBadgeBackgroundColor({ color: '#8a7400' });
    chrome.action.setBadgeText({ tabId: aba.id, text: ligado ? 'on' : '' });
  } catch (e) {
    aviso(aba.id, 'nao consegui abrir o pincel aqui. Recarregue a pagina e tente de novo.');
  }
}

async function abaAtual() {
  const abas = await chrome.tabs.query({ active: true, currentWindow: true });
  return abas[0];
}

chrome.commands.onCommand.addListener(async function (comando) {
  if (comando !== 'alternar-pincel') return;
  alternarNaAba(await abaAtual());
});

chrome.action.onClicked.addListener(function (aba) {
  alternarNaAba(aba);
});

// A pagina recarregou: o pincel foi embora junto, entao limpa o selo.
chrome.tabs.onUpdated.addListener(function (tabId, mudanca) {
  if (mudanca.status === 'loading') chrome.action.setBadgeText({ tabId: tabId, text: '' });
});

// Primeira instalacao: grava os padroes para a pagina de opcoes ja abrir preenchida.
chrome.runtime.onInstalled.addListener(async function () {
  const guardado = await chrome.storage.sync.get('config');
  if (!guardado.config) await chrome.storage.sync.set({ config: PADRAO });
});
