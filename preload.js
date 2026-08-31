'use strict';
/*
 * Ponte segura entre as janelas (overlay e configuracoes) e o processo
 * principal. As janelas nao tem acesso ao Node, apenas a estas funcoes.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marcaTexto', {
  // --- usados pelo overlay ---
  aoEstado: function (retorno) {
    ipcRenderer.on('overlay:estado', function (evento, dados) { retorno(dados); });
  },
  aoConfig: function (retorno) {
    ipcRenderer.on('overlay:config', function (evento, cfg) { retorno(cfg); });
  },
  sair: function () { ipcRenderer.send('overlay:sair'); },
  pedirFoco: function () { ipcRenderer.send('overlay:foco'); },

  // --- usados pela janela de configuracoes ---
  obterConfig: function () { return ipcRenderer.invoke('config:obter'); },
  salvarConfig: function (parcial) { return ipcRenderer.invoke('config:salvar', parcial); },
  testarAtalho: function (acelerador) { return ipcRenderer.invoke('atalho:testar', acelerador); },
  aoConfigAtualizada: function (retorno) {
    ipcRenderer.on('config:atualizada', function (evento, cfg) { retorno(cfg); });
  }
});
