// Genera le icone PNG dell'app senza dipendenze (solo zlib di Node).
// Uso: node scripts/generate-icons.mjs
// Disegno: blu notte, alone viola, anello con gradiente viola → ciano.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BG = [10, 14, 26];
const VIOLET = [176, 38, 255];
const CYAN = [0, 200, 224];

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filtro "none"
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// `scale` < 1 rimpicciolisce il disegno (icone maskable: zona sicura all'80%).
function draw(size, scale = 1) {
  const SS = 4; // supersampling per bordi morbidi
  const out = Buffer.alloc(size * size * 3);
  const c = size / 2;
  const rOuter = size * 0.3 * scale;
  const rInner = size * 0.205 * scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          // sfondo con alone viola in alto a sinistra e ciano in basso a destra
          const g1 = Math.max(0, 1 - Math.hypot(px - size * 0.2, py - size * 0.1) / (size * 0.75));
          const g2 = Math.max(0, 1 - Math.hypot(px - size * 0.95, py - size * 0.9) / (size * 0.7));
          let col = mix(mix(BG, VIOLET, g1 * g1 * 0.35), CYAN, g2 * g2 * 0.18);
          const d = Math.hypot(px - c, py - c);
          if (d <= rOuter && d >= rInner) {
            const t = Math.min(1, Math.max(0, (px + py) / (2 * size)));
            col = mix(VIOLET, CYAN, t);
          }
          acc = acc.map((v, i) => v + col[i]);
        }
      }
      const o = (y * size + x) * 3;
      out[o] = Math.round(acc[0] / (SS * SS));
      out[o + 1] = Math.round(acc[1] / (SS * SS));
      out[o + 2] = Math.round(acc[2] / (SS * SS));
    }
  }
  return encodePng(size, out);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", draw(192));
writeFileSync("public/icons/icon-512.png", draw(512));
writeFileSync("public/icons/icon-maskable-512.png", draw(512, 0.8));
writeFileSync("src/app/apple-icon.png", draw(180));
console.log("Icone generate.");
