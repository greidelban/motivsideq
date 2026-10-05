"use client";

import { useEffect, useRef } from "react";
import { appearance, paletteFor } from "@/lib/light/appearance";
import { RENDER_SCALE, isAnimated } from "@/lib/light/backgrounds";
import { pulseLight, readLight, setGuidedBreath, setLightEnergy, writeLight } from "@/lib/light/bus";
import { breath, guidedEnergy, idleBreath, stepLight } from "@/lib/light/envelope";
import { timeScale } from "@/lib/light/motion";
import { paletteUniform } from "@/lib/light/palettes";
import { VERTEX_SHADER, fragmentShaderFor } from "./shader";

// Si disegna a risoluzione ridotta (RENDER_SCALE, per sfondo) e il browser
// ingrandisce: meno pixel = meno batteria.
const MAX_PIXELS = 360_000;
// Lo sfondo non risponde a tocchi, trascinamenti o scroll: si sceglie solo il
// colore e la velocità dell'animazione (pagina Sfondo).
const FRAME_MS = 1000 / 40;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV === "development") console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, fragmentSource: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

/**
 * Sfondo vivo dell'app (fumo o galassia, scelti in Impostazioni): in movimento
 * continuo, reagisce al tocco e agli impulsi del bus (src/lib/light/bus.ts).
 * Montato una sola volta nel layout radice, così non si interrompe cambiando pagina.
 * Con lo sfondo "classico" resta spento (si vede quello CSS), tranne quando un
 * esercizio lo accende apposta. Senza WebGL resta lo sfondo CSS; con "riduci
 * movimento" diventa un'immagine ferma.
 */
export function LivingLight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = appearance.use();
  const { background } = settings;
  // Con lo sfondo classico, durante gli esercizi si disegna il fumo.
  const drawn = isAnimated(background) ? background : "smoke";
  const palette = paletteFor(settings, drawn);
  // Il colore cambia senza ricreare il programma WebGL: lo legge il disegno.
  const paletteRef = useRef({ key: "", value: paletteUniform(drawn, palette) });
  useEffect(() => {
    paletteRef.current = { key: `${drawn}:${palette}`, value: paletteUniform(drawn, palette) };
  }, [drawn, palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) return;
    const program = createProgram(gl, fragmentShaderFor(drawn));
    if (!program) return;

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // Un solo triangolo che copre tutto lo schermo.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      energy: gl.getUniformLocation(program, "uEnergy"),
      pulse: gl.getUniformLocation(program, "uPulse"),
      breath: gl.getUniformLocation(program, "uBreath"),
      motion: gl.getUniformLocation(program, "uMotion"),
      palette: gl.getUniformLocation(program, "uPal"),
    };

    // Ogni sessione parte da un punto diverso. Il tempo dello sfondo avanza alla
    // velocità scelta dall'utente (motion.ts): cambiarla non provoca salti.
    let simTime = Math.random() * 1000;
    let raf = 0;
    let stillTimer: ReturnType<typeof setInterval> | undefined;
    let last = performance.now();
    let lastDraw = 0;

    const shouldShow = () => isAnimated(background) || readLight().forceOn;

    function setVisible(visible: boolean) {
      if (!canvas) return;
      if (visible) canvas.dataset.ready = "true";
      else delete canvas.dataset.ready;
    }

    // Dimensioni prese dal canvas stesso (alto 100lvh in CSS): non cambiano quando
    // la barra del browser compare o sparisce durante lo scroll, quindi niente stiramenti.
    function resize() {
      if (!canvas || !gl) return;
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const scale = Math.min(RENDER_SCALE[drawn], Math.sqrt(MAX_PIXELS / (w * h)));
      const width = Math.max(1, Math.round(w * scale));
      const height = Math.max(1, Math.round(h * scale));
      if (width === canvas.width && height === canvas.height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (readLight().motion === 0) {
        stillKey = "";
        drawStill();
      }
    }

    function draw(now: number) {
      if (!gl || !canvas) return;
      const light = readLight();
      const still = light.motion === 0;
      // Respiro guidato: la luce si accende inspirando e si abbassa espirando,
      // calcolato qui a ogni frame (fluido, senza il ritardo dell'inseguimento).
      const guided = light.breathStart === null || still ? null : breath(now - light.breathStart).value;
      const energy = still ? light.target : guided === null ? light.energy : guidedEnergy(light.energy, guided);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, simTime);
      gl.uniform1f(u.motion, light.motion);
      gl.uniform1f(u.energy, energy);
      gl.uniform1f(u.pulse, still ? 0 : light.pulse);
      gl.uniform1f(u.breath, still ? 0.5 : (guided ?? idleBreath(now)));
      gl.uniform3fv(u.palette, paletteRef.current.value);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000;
      last = now;
      const light = readLight();
      // Livello portato a 0 mentre è aperto: si passa all'immagine ferma.
      if (light.motion === 0) return start();
      simTime += Math.min(dt, 0.1) * timeScale(light.motion);
      writeLight(stepLight(light, dt));
      const visible = shouldShow();
      setVisible(visible);
      if (!visible || now - lastDraw < FRAME_MS) return;
      lastDraw = now;
      draw(now);
    }

    // Immagine ferma: si ridisegna solo se cambia qualcosa (intensità, accensione forzata).
    let stillKey = "";
    function drawStill() {
      const visible = shouldShow();
      const key = `${visible}:${readLight().target.toFixed(2)}:${canvas?.width}x${canvas?.height}:${paletteRef.current.key}`;
      // Livello rialzato da 0: si riparte con l'animazione.
      if (readLight().motion > 0) return start();
      if (key === stillKey) return;
      stillKey = key;
      if (visible) draw(performance.now());
      setVisible(visible);
    }

    function start() {
      cancelAnimationFrame(raf);
      clearInterval(stillTimer);
      if (document.hidden) return;
      if (readLight().motion === 0) {
        stillKey = "";
        drawStill();
        stillTimer = setInterval(drawStill, 500);
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const onVisibility = () => {
      if (!document.hidden) return start();
      cancelAnimationFrame(raf);
      clearInterval(stillTimer);
    };
    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      setVisible(false);
    };

    // Solo in sviluppo: comandi da console per provare la luce (window.__light).
    if (process.env.NODE_ENV === "development") {
      Object.assign(window, {
        __light: { setLightEnergy, pulseLight, setGuidedBreath, readLight },
      });
    }

    resize();
    start();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(stillTimer);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [background, drawn]);

  return <canvas ref={canvasRef} aria-hidden="true" className="living-light" />;
}
