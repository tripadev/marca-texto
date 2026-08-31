'use strict';
// Gera os icones do app e da extensao (PNG RGBA) sem depender de biblioteca:
// um traco diagonal de marca-texto amarelo sobre fundo transparente.
//
//   node ferramentas/criar-icone.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function distanciaAoSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function crcTabela() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const TAB = crcTabela();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tam, corpo, crc]);
}

function gerar(tamanho) {
  const e = tamanho / 32; // as medidas foram pensadas em 32x32
  const linhas = [];

  for (let y = 0; y < tamanho; y++) {
    const linha = Buffer.alloc(1 + tamanho * 4);
    linha[0] = 0; // filtro "none"
    for (let x = 0; x < tamanho; x++) {
      const d = distanciaAoSegmento(x + 0.5, y + 0.5, 6.5 * e, 24.5 * e, 25.5 * e, 8.5 * e);
      const a = Math.max(0, Math.min(1, (5.2 * e - d) / Math.max(0.8, 1.1 * e)));
      const borda = a > 0 && a < 0.85 ? 1 : 0; // contorno para nao sumir em fundo claro
      linha[1 + x * 4] = borda ? 214 : 255;
      linha[2 + x * 4] = borda ? 168 : 224;
      linha[3 + x * 4] = 0;
      linha[4 + x * 4] = Math.round(a * 255);
    }
    linhas.push(linha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', zlib.deflateSync(Buffer.concat(linhas), { level: 9 })),
    bloco('IEND', Buffer.alloc(0))
  ]);
}

const raiz = path.join(__dirname, '..');
const alvos = [
  { tamanho: 32, destino: path.join(raiz, 'assets', 'icone.png') },
  // 256x256: o electron-builder converte este PNG no .ico do executavel
  { tamanho: 256, destino: path.join(raiz, 'build', 'icon.png') },
  { tamanho: 16, destino: path.join(raiz, 'extensao-navegador', 'icones', 'icone16.png') },
  { tamanho: 32, destino: path.join(raiz, 'extensao-navegador', 'icones', 'icone32.png') },
  { tamanho: 48, destino: path.join(raiz, 'extensao-navegador', 'icones', 'icone48.png') },
  { tamanho: 128, destino: path.join(raiz, 'extensao-navegador', 'icones', 'icone128.png') }
];

for (const alvo of alvos) {
  fs.mkdirSync(path.dirname(alvo.destino), { recursive: true });
  const png = gerar(alvo.tamanho);
  fs.writeFileSync(alvo.destino, png);
  console.log(alvo.tamanho + 'x' + alvo.tamanho + ' -> ' + path.relative(raiz, alvo.destino) + ' (' + png.length + ' bytes)');
}
