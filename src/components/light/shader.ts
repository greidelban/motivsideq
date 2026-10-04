// Shader della luce viva (WebGL 1 / GLSL ES 1.0, per girare ovunque).
// Uno sfondo = un fragment shader; le parti comuni (uniform, rumore, tocco,
// finitura) sono condivise. uEnergy, uPulse e uBreath arrivano dal bus
// (src/lib/light/bus.ts); il tocco fa girare l'immagine attorno al dito.
//
// Le soglie dei rumori sono tarate sulla loro distribuzione reale, misurata a
// parte: fbm() ha mediana ~0.54 e p90 ~0.66; length(r - q) va da ~0.09 a ~0.44.

import type { AnimatedBackgroundId } from "@/lib/light/backgrounds";

export const VERTEX_SHADER = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;
uniform float uPulse;
uniform float uBreath;
uniform vec3 uPointer; // xy posizione, z quantità
uniform float uMotion;  // livello di animazione scelto dall'utente, 0..1 (la velocità è già nel tempo)
// Colori scelti dall'utente (src/lib/light/palettes.ts): 4 ruoli fissi.
uniform vec3 uPal[4];
#define PAL_LIGHT uPal[0]
#define PAL_MID uPal[1]
#define PAL_DEEP uPal[2]
#define PAL_ACCENT uPal[3]

// hash12 di Dave Hoskins: uniforme e stabile anche con poca precisione.
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// Coordinate centrate (altezza = 1), già deformate dal vortice del tocco.
vec2 touchedUv(vec2 uv) {
  vec2 d = uv - uPointer.xy;
  float swirl = exp(-dot(d, d) * 7.0) * uPointer.z * (0.8 + 1.6 * uMotion);
  return uPointer.xy + rot(swirl) * d;
}

// Vignettatura, fondo, compressione dei toni, dithering anti-bande.
vec4 finish(vec3 col, vec3 base, float rad) {
  col *= 1.0 - smoothstep(0.55, 1.35, rad);
  col = base + col;
  col = 1.0 - exp(-col * 1.25);
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  return vec4(col, 1.0);
}
`;

// ---- Fumo: fumo caldo e raggi di luce, con la croce anamorfica al centro ----
const SMOKE = `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  float e = clamp(uEnergy, 0.0, 1.0);
  float lit = clamp(uEnergy + uPulse * 0.5, 0.0, 1.6);
  vec2 w = touchedUv(uv);

  // Fumo: rumore frattale deformato da sé stesso, lento e organico.
  vec2 p = w * 2.4;
  float s = t * 0.06;
  vec2 q = vec2(fbm(p + vec2(0.0, s)), fbm(p + vec2(5.2, -s)));
  vec2 r = vec2(fbm(p + 1.6 * q + vec2(1.7, 9.2) + s * 1.7), fbm(p + 1.6 * q + vec2(8.3, 2.8) - s * 1.3));
  float f = fbm(p + 1.6 * r);
  // Corpo morbido + filamenti (banda non troppo stretta: a mezza risoluzione
  // una riga sottile diventerebbe una scaletta di pixel). Copre ~70% dello schermo.
  float body = smoothstep(0.48, 0.68, f);
  float strand = exp(-pow((f - 0.62) / 0.045, 2.0));
  float mask = smoothstep(0.24, 0.44, fbm(w * 0.7 + vec2(s * 0.5, 11.0)));
  float dens = (0.7 * body + 0.6 * strand) * mask;
  float edge = smoothstep(0.15, 0.37, length(r - q));

  // Palette (originale: pesca, rosa, magenta; riflessi ciano solo sui bordi dei vortici).
  vec3 tint = mix(PAL_LIGHT, PAL_MID, smoothstep(0.30, 0.48, q.y));
  tint = mix(tint, PAL_DEEP, smoothstep(0.48, 0.64, q.y));
  tint = mix(tint, PAL_ACCENT, smoothstep(0.58, 0.68, r.x) * edge * 0.6);
  vec3 smoke = mix(mix(vec3(1.0), PAL_LIGHT, 0.6), tint, clamp(0.45 + 0.45 * edge + 0.15 * e, 0.0, 1.0));

  float rad = length(uv);
  float glow = exp(-rad * mix(2.4, 1.0, e));
  vec3 col = smoke * dens * (0.42 + 0.6 * lit) * (0.30 + 1.0 * glow);

  // Raggi di luce che escono dal centro (rumore sulla direzione: niente cuciture).
  vec2 dir = uv / max(rad, 0.001);
  float r1 = noise(dir * 4.0 + vec2(t * 0.09, 3.0));
  float r2 = noise(dir * 9.0 + vec2(-1.0, -t * 0.13));
  float rays = smoothstep(0.35, 0.9, r1) * (0.5 + 0.5 * r2);
  rays *= exp(-rad * mix(4.0, 1.6, e)) * (0.12 + 0.7 * lit + 0.6 * uPulse);
  col += mix(PAL_LIGHT, PAL_MID, 0.5) * rays * (0.6 + 0.4 * mask);

  // Nucleo: un punto caldo stretto più un alone morbido che respira.
  vec3 warm = mix(vec3(1.0), PAL_LIGHT, 0.45);
  float r2c = rad * rad;
  float hot = exp(-r2c * mix(900.0, 110.0, clamp(lit, 0.0, 1.0)));
  float halo = exp(-r2c * mix(70.0, 12.0, clamp(e * 0.8 + uPulse * 0.4, 0.0, 1.0)));
  col += warm * hot * (0.35 + 1.6 * lit + uPulse);
  col += warm * halo * (0.03 + 0.45 * lit * lit + 0.10 * uBreath + 0.35 * uPulse);
  col += smoke * dens * halo * 0.6 * lit;

  // Croce di luce: riga orizzontale con dispersione cromatica, verticale calda.
  float flicker = 1.0 - (0.04 + 0.12 * uMotion) * (0.5 + 0.5 * sin(t * 2.1) * sin(t * 1.3 + 1.7));
  float thin = mix(430.0, 150.0, clamp(lit, 0.0, 1.0));
  float h = exp(-abs(uv.y) * thin) * exp(-abs(uv.x) * mix(2.6, 0.7, e));
  float v = exp(-abs(uv.x) * thin * 1.4) * exp(-abs(uv.y) * mix(2.2, 0.6, e));
  vec3 hcol = mix(mix(PAL_MID, vec3(1.0), 0.3), mix(PAL_ACCENT, vec3(1.0), 0.3), smoothstep(-0.6, 0.6, uv.x));
  hcol = mix(hcol, vec3(1.0), exp(-abs(uv.x) * 4.0));
  col += (hcol * h + warm * v * 0.8) * (0.20 + 0.9 * lit + 0.6 * uPulse) * flicker;

  gl_FragColor = finish(col, PAL_DEEP * 0.065, rad);
}
`;

// ---- Galassia: realistica, inclinata, con stelle vere e un nucleo che respira ----
// Stelle: luminosità con distribuzione molto sbilanciata (quasi tutte deboli,
// poche brillanti) e colore secondo la temperatura, dimensione ~1 pixel.
const GALAXY = `
vec3 starColor(float h) {
  vec3 warm = vec3(1.0, 0.74, 0.52);
  vec3 white = vec3(1.0, 0.96, 0.90);
  vec3 blue = vec3(0.72, 0.82, 1.0);
  return h < 0.5 ? mix(warm, white, h * 2.0) : mix(white, blue, (h - 0.5) * 2.0);
}

vec3 stars(vec2 uv, float t) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float dens = k == 0 ? 16.0 : (k == 1 ? 40.0 : 95.0);
    // Parallasse: i livelli vicini scorrono un po' più in fretta di quelli lontani.
    vec2 drift = vec2(0.004, 0.0015) * t * (3.0 - float(k));
    vec2 sp = (uv + drift) * dens + float(k) * 13.1;
    vec2 id = floor(sp);
    float h = hash(id + float(k) * 7.3);
    if (h < 0.4) continue;
    vec2 off = vec2(hash(id + 1.7), hash(id + 5.3)) - 0.5;
    // Distanza in pixel del canvas: la stella resta di ~1 pixel a ogni densità.
    float d = length(fract(sp) - 0.5 - off * 0.8) * uRes.y / dens;
    float mag = pow(hash(id + 9.1), 9.0);
    float layer = k == 0 ? 1.0 : (k == 1 ? 0.55 : 0.3);
    float point = exp(-d * d * 1.4);
    float glow = exp(-d * 0.55) * mag * 0.35;
    float twinkle = 1.0 - (0.1 + 0.4 * uMotion) * (0.5 + 0.5 * sin(t * (0.9 + h * 2.6) + h * 60.0));
    vec3 sc = mix(starColor(hash(id + 3.3)), PAL_MID, 0.15);
    acc += sc * (point + glow) * layer * (0.12 + 2.2 * mag) * twinkle;
  }
  return acc;
}

// Stella cadente: ogni ~7 s una scia sottile attraversa il cielo in meno di un secondo.
vec3 meteor(vec2 uv, float t) {
  float period = 7.0;
  float n = floor(t / period);
  float local = t - n * period;
  float dur = 0.9;
  if (local > dur) return vec3(0.0);
  vec2 start = vec2((hash(vec2(n, 1.3)) - 0.5) * 0.6, 0.2 + hash(vec2(n, 4.7)) * 0.3);
  float ang = -0.5 - hash(vec2(n, 8.1)) * 1.6;
  vec2 dir = vec2(cos(ang), sin(ang));
  float p = local / dur;
  vec2 v = uv - (start + dir * p * 0.6);
  float behind = dot(v, -dir);
  float across = abs(dot(v, vec2(-dir.y, dir.x))) * uRes.y; // in pixel
  float tail = step(0.0, behind) * (1.0 - smoothstep(0.0, 0.2, behind)) * exp(-across * 0.9);
  float head = exp(-length(v) * uRes.y * 0.5);
  return mix(vec3(1.0), PAL_MID, 0.3) * (tail + head) * sin(3.14159 * p);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  float e = clamp(uEnergy, 0.0, 1.0);
  float lit = clamp(uEnergy + uPulse * 0.5, 0.0, 1.6);
  float b = uBreath;
  vec2 w = touchedUv(uv);

  // Respira: si allarga inspirando e si raccoglie espirando.
  vec2 g = w * (1.0 - (0.03 + 0.04 * uMotion) * (b - 0.5));
  // Disco molto inclinato, visto quasi di taglio.
  g = rot(0.5) * g;
  g.y *= 2.4;
  float r = length(g);
  float a = atan(g.y, g.x);
  float spin = t * 0.04;
  vec2 rg = rot(spin) * g; // coordinate solidali con la galassia, per i dettagli

  // Bracci: spirale logaritmica morbida, spezzata in nubi stellari a grana fine.
  float phase = 2.0 * (a + spin) - 6.0 * log(r + 0.02);
  float armBase = smoothstep(-0.3, 1.0, cos(phase));
  float clouds = fbm(rg * 9.0 + 2.0);
  float fine = fbm(rg * 24.0 + 5.0);
  float arms = max(0.0, armBase * (0.55 + 1.1 * (clouds - 0.54) + 0.6 * (fine - 0.54)));
  float disk = exp(-r * 3.0);

  // Polvere: filamenti scuri sottili (rumore "a cresta") sul bordo interno dei bracci.
  float ridge = 1.0 - abs(2.0 * fbm(rg * 7.0 + 11.0) - 1.08);
  float dust = smoothstep(0.78, 0.96, ridge) * smoothstep(0.2, 0.9, cos(phase + 0.8) * 0.5 + 0.5);
  dust *= smoothstep(0.05, 0.22, r) * (1.0 - smoothstep(0.35, 0.9, r));

  // Stelle vecchie al centro (originale: calde), giovani nei bracci (originale: bianco-azzurre).
  vec3 col = mix(PAL_LIGHT, PAL_MID, smoothstep(0.06, 0.38, r)) * (1.1 * arms + 0.25) * disk;
  col *= (0.35 + 0.9 * lit) * (0.88 + 0.24 * b);
  // Regioni di formazione stellare: puntini rosa, piccoli e rari, solo nei bracci.
  vec2 hp = rg * 70.0;
  vec2 hid = floor(hp);
  float hd = length(fract(hp) - 0.5 - (vec2(hash(hid + 2.1), hash(hid + 6.4)) - 0.5) * 0.6) * uRes.y / 70.0;
  float hii = step(0.94, hash(hid + 4.0)) * exp(-hd * hd * 0.8) * armBase * disk;
  col += PAL_DEEP * hii * (0.4 + 0.8 * lit);
  col *= 1.0 - 0.8 * dust;

  // Nucleo piccolo e intenso dentro un rigonfiamento morbido.
  float nucleus = exp(-r * r * mix(320.0, 110.0, clamp(e * 0.8 + uPulse * 0.4, 0.0, 1.0)));
  float bulge = exp(-r * 11.0);
  col += mix(vec3(1.0), PAL_LIGHT, 0.75) * (nucleus * (0.6 + 1.5 * lit + 0.35 * b + uPulse) + bulge * 0.3 * (0.5 + lit));

  // Cielo: stelle, nebulose colorate che si muovono piano e qualche stella cadente.
  col += stars(uv, t) * (0.9 + 0.25 * b);
  float nebA = fbm(uv * 1.5 + vec2(t * 0.012, 5.0));
  float nebB = fbm(uv * 2.1 + vec2(-t * 0.009, 9.0));
  col += PAL_DEEP * 0.55 * smoothstep(0.55, 0.78, nebA) * 0.30;
  col += PAL_ACCENT * 0.65 * smoothstep(0.58, 0.80, nebB) * 0.28;
  col += meteor(uv, t) * (0.6 + 0.4 * uMotion);

  gl_FragColor = finish(col, vec3(0.010, 0.011, 0.020), length(uv));
}
`;

// ---- Cristallo: luce che attraversa il ghiaccio ----
// Aghi sottili che si irradiano dal centro, brina, scintillii iridescenti e fasci
// verticali come luce da fessure (qualcuno color ambra), su nero bluastro.
const CRYSTAL = `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  float e = clamp(uEnergy, 0.0, 1.0);
  float lit = clamp(uEnergy + uPulse * 0.5, 0.0, 1.6);
  float b = uBreath;
  vec2 w = touchedUv(uv) * (1.0 - 0.04 * (b - 0.5));
  float rad = length(w);
  vec2 dir = w / max(rad, 0.001);
  float s = t * 0.045;

  // Forma del cristallo: un grumo irregolare che cambia piano.
  vec2 cw = rot(s * 0.6) * w;
  // (spinta verso il centro: il cristallo resta sempre dove c'è la luce, non vaga negli angoli)
  float shape = fbm(cw * 2.2 + vec2(s, -s)) + 0.2 * exp(-rad * rad * 10.0);
  float body = smoothstep(0.40, 0.70, shape) * exp(-rad * mix(3.4, 1.8, e));

  // Aghi di ghiaccio: fibre fitte (rumore sulla direzione), corte e spezzate
  // lungo il raggio, e solo dentro la forma del cristallo: un grumo, non una stella.
  float fib = noise(dir * 55.0 + vec2(s * 2.0, 0.0));
  fib *= noise(dir * 19.0 + vec2(rad * 14.0 - s * 3.0, 5.0));
  float inside = smoothstep(0.42, 0.68, shape);
  float needles = smoothstep(0.22, 0.72, fib) * exp(-rad * mix(8.0, 3.8, e)) * inside * 1.4;
  // Brina: grana fine e finissima dentro il cristallo.
  float frost = smoothstep(0.52, 0.76, fbm(cw * 14.0 + 3.0)) * (0.6 + 0.8 * fbm(cw * 34.0 + 8.0)) * body;

  vec3 col = mix(PAL_LIGHT, PAL_MID, smoothstep(0.45, 0.65, shape)) * (0.75 * body + 0.95 * needles + 0.8 * frost);
  col *= (0.35 + 0.9 * lit) * (0.85 + 0.3 * b);

  // Fasci verticali come luce che filtra da fessure: larghi e morbidi + sottili e netti.
  // (i fasci larghi svaniscono presto ai lati: lontano dal centro diventerebbero bande piatte)
  // (fasci sottili radi: troppi insieme sembrano un codice a barre)
  float wide = pow(noise(vec2(uv.x * 12.0 + 2.0, s * 1.5)), 3.0) * 1.3 * exp(-abs(uv.x) * 3.4);
  float thinShaft = pow(noise(vec2(uv.x * 48.0, s * 2.0 + 9.0)), 10.0) * 3.2 * exp(-abs(uv.x) * 2.4);
  float shafts = (wide + thinShaft) * exp(-abs(uv.y) * 0.9);
  float amber = smoothstep(0.6, 0.8, noise(vec2(uv.x * 5.0 + 7.0, s * 0.5)));
  vec3 shaftCol = mix(PAL_LIGHT, PAL_ACCENT, amber * 0.7);
  col += shaftCol * shafts * (0.10 + 0.45 * lit + 0.3 * uPulse);

  // Riga orizzontale sottile.
  float h = exp(-abs(uv.y) * mix(320.0, 130.0, clamp(lit, 0.0, 1.0))) * exp(-abs(uv.x) * mix(2.2, 0.7, e));
  col += mix(vec3(1.0), PAL_LIGHT, 0.7) * h * (0.15 + 0.8 * lit + 0.6 * uPulse);

  // Nucleo freddo e bianco.
  float r2 = rad * rad;
  col += mix(vec3(1.0), PAL_LIGHT, 0.4) * exp(-r2 * mix(700.0, 120.0, clamp(lit, 0.0, 1.0))) * (0.3 + 1.4 * lit + uPulse);
  col += mix(PAL_DEEP, vec3(1.0), 0.4) * exp(-r2 * mix(50.0, 10.0, e)) * (0.03 + 0.35 * lit * lit + 0.1 * b);

  // Scintillii iridescenti dentro il cristallo.
  vec2 sp = w * 110.0;
  vec2 sid = floor(sp);
  float sh = hash(sid);
  float sd = length(fract(sp) - 0.5 - (vec2(hash(sid + 1.1), hash(sid + 2.2)) - 0.5) * 0.7) * uRes.y / 110.0;
  float spark = step(0.92, sh) * exp(-sd * sd * 1.2) * (body + needles) * (0.5 + 0.5 * sin(t * 4.0 + sh * 50.0));
  vec3 iri = mix(0.6 + 0.4 * cos(6.2831 * (sh * 3.0 + vec3(0.0, 0.33, 0.67))), PAL_MID, 0.3);
  col += iri * spark * (0.5 + lit);

  gl_FragColor = finish(col, PAL_DEEP * 0.05, rad);
}
`;

// ---- Scintille: pulviscolo luminoso sfocato (bokeh) e polvere che brilla ----
// Grappoli di dischi sfocati su tre profondità che salgono piano, polvere fine
// che scintilla, righe verticali leggere e, ogni tanto, un bagliore lento.
const SPARKLE = `
// Un livello di dischi sfocati. Spostamento (±0.15) + raggio (≤0.32) restano
// dentro la cella: nessun disco tagliato e nessun vicino da controllare.
float bokeh(vec2 uv, float cell, vec2 drift, float seed, float density) {
  vec2 sp = (uv + drift) / cell;
  vec2 id = floor(sp);
  if (hash(id + seed) > density) return 0.0;
  vec2 off = (vec2(hash(id + seed + 1.3), hash(id + seed + 7.1)) - 0.5) * 0.3;
  float radius = 0.16 + 0.16 * hash(id + seed + 3.7);
  float d = length(fract(sp) - 0.5 - off) / radius;
  float disc = 1.0 - smoothstep(0.55, 1.0, d);
  float rim = smoothstep(0.5, 0.9, d) * disc * 0.35; // bordo appena più chiaro, come nelle lenti vere
  float core = exp(-d * d * 3.0) * 0.5;            // centro luminoso: luce, non bolla
  return (0.6 * disc + rim + core) * (0.25 + 0.75 * pow(hash(id + seed + 5.5), 2.0));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  float lit = clamp(uEnergy + uPulse * 0.5, 0.0, 1.6);
  float b = uBreath;
  vec2 w = touchedUv(uv);

  // Grappoli: zone dove il pulviscolo è più fitto, che si spostano.
  float cl = fbm(w * 1.8 + vec2(t * 0.03, -t * 0.05));
  float cluster = smoothstep(0.42, 0.72, cl);
  float density = 0.12 + 0.6 * cluster;

  float light = 0.0;
  light += bokeh(w, 0.11, vec2(0.0, -t * 0.014), 1.0, density) * 1.6;
  light += bokeh(w, 0.065, vec2(t * 0.005, -t * 0.024), 11.0, density) * 1.3;
  light += bokeh(w, 0.038, vec2(-t * 0.004, -t * 0.036), 23.0, density * 1.1) * 1.0;

  // Polvere fine: punti di ~1 pixel che scintillano in fretta.
  vec2 dp = w * 140.0 + vec2(0.0, -t * 0.9);
  vec2 did = floor(dp);
  float dh = hash(did);
  // Posizione casuale dentro la cella: altrimenti i punti formano una griglia visibile.
  vec2 doff = (vec2(hash(did + 1.1), hash(did + 2.2)) - 0.5) * 0.7;
  float dd = length(fract(dp) - 0.5 - doff) * uRes.y / 140.0;
  float sparkle = 0.5 + 0.5 * sin(t * (4.0 + 6.0 * dh) + dh * 80.0);
  float dust = step(0.97 - 0.25 * cluster, dh) * exp(-dd * dd * 1.5) * sparkle;

  // Righe verticali leggere, come graffi di luce sulla lente.
  float streak = pow(noise(vec2(w.x * 60.0, t * 0.2)), 8.0) * 0.5 * cluster;

  // Bagliore lento ogni ~11 s: sale in 1.2 s e si spegne in 1.6 s (mai lampeggi).
  float cycle = floor(t / 11.0);
  float fp = t - cycle * 11.0;
  float flareAmt = smoothstep(0.0, 1.2, fp) * (1.0 - smoothstep(1.2, 2.8, fp));
  vec2 flarePos = vec2((hash(vec2(cycle, 2.0)) - 0.5) * 0.4, (hash(vec2(cycle, 5.0)) - 0.3) * 0.6);
  float flare = exp(-length(uv - flarePos) * 7.0) * flareAmt * (0.4 + 0.5 * uMotion);

  vec3 silver = mix(PAL_LIGHT, PAL_MID, smoothstep(0.4, 0.7, cl));
  // Dentro i grappoli la luce è forte, fuori resta poca e debole.
  vec3 col = silver * light * (0.12 + 2.2 * cluster * cluster) * (0.5 + 0.9 * lit) * (0.8 + 0.4 * b);
  // Bagliore diffuso dove il pulviscolo è più fitto.
  col += silver * cluster * cluster * 0.12 * (0.5 + lit);
  col += silver * dust * (0.5 + lit) + PAL_DEEP * streak * (0.3 + 0.5 * lit);
  col += PAL_ACCENT * (flare + uPulse * exp(-length(uv) * 3.0) * 0.6);

  gl_FragColor = finish(col, PAL_DEEP * 0.025, length(uv));
}
`;

// ---- Prisma: piani di luce dai bordi netti che ruotano attorno a un vertice ----
// Ogni raggio è una linea netta più un piano sfumato su un lato; i tre canali
// colore sono appena sfasati, così i bordi hanno frange azzurre, viola e rosa.
const PRISM = `
vec3 beam(vec2 uv, vec2 vertex, float angle, float spread, vec3 tint) {
  vec2 dir = vec2(cos(angle), sin(angle));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 v = uv - vertex;
  float along = dot(v, dir);
  if (along <= 0.0) return vec3(0.0);
  vec3 col = vec3(0.0);
  for (int c = 0; c < 3; c++) {
    // Dispersione: la separazione tra i colori cresce allontanandosi dal vertice.
    float side = dot(v, nrm) - (float(c) - 1.0) * 0.006 * along;
    float edge = exp(-abs(side) * uRes.y * 0.35);
    float tangent = side / along;
    // max(): dal lato "spento" exp() andrebbe all'infinito e 0 × ∞ darebbe righe nere (NaN).
    float plane = step(0.0, tangent) * exp(-max(tangent, 0.0) / spread) * 0.7;
    float amount = (edge + plane) * exp(-along * 0.7);
    if (c == 0) col.r = amount; else if (c == 1) col.g = amount; else col.b = amount;
  }
  return col * tint;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  float lit = clamp(uEnergy + uPulse * 0.5, 0.0, 1.6);
  float b = uBreath;
  vec2 w = touchedUv(uv);

  // Il vertice vaga piano attorno al centro; i raggi spazzano lo schermo.
  vec2 vertex = vec2(0.09 * sin(t * 0.13), 0.12 * sin(t * 0.09 + 1.0));
  float spread = 0.25 + 0.2 * b;
  vec3 blue = PAL_MID;
  vec3 violet = PAL_DEEP;
  vec3 pink = PAL_ACCENT;

  float a1 = 0.6 + 0.5 * sin(t * 0.11);
  vec3 col = beam(w, vertex, a1, spread, blue);
  col += beam(w, vertex, a1 + 3.14159, spread * 0.7, violet) * 0.8;
  col += beam(w, vertex, 2.4 + 0.6 * sin(t * 0.08 + 2.0), spread, pink) * 0.9;
  col += beam(w, vertex, -1.3 + 0.7 * sin(t * 0.07 + 4.0), spread * 1.3, blue) * 0.7;
  col *= (0.45 + 1.0 * lit) * (0.85 + 0.3 * b);

  // Il vertice brilla dove i piani si incontrano.
  float r = length(w - vertex);
  col += PAL_LIGHT * (exp(-r * r * 1400.0) * (0.5 + 1.4 * lit + uPulse) + exp(-r * 9.0) * 0.12 * (0.5 + lit));

  gl_FragColor = finish(col, PAL_DEEP * 0.018, length(uv));
}
`;

const SHADERS: Record<AnimatedBackgroundId, string> = {
  smoke: COMMON + SMOKE,
  galaxy: COMMON + GALAXY,
  crystal: COMMON + CRYSTAL,
  sparkle: COMMON + SPARKLE,
  prism: COMMON + PRISM,
};

export function fragmentShaderFor(background: AnimatedBackgroundId): string {
  return SHADERS[background];
}
