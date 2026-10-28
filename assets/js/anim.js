// Animaciones con promesas: animar(ms, fn) llama a fn(t) con t de 0 a 1.
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ease = {
  lineal: t => t,
  suave: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  salida: t => 1 - Math.pow(1 - t, 3),
  muelle: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  rebote: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

const activas = new Set();

export function animar(ms, fn, e = ease.suave) {
  const dur = reducir ? Math.min(ms, 120) : ms;
  return new Promise(res => activas.add({ t0: performance.now(), dur, fn, e, res }));
}

export const esperar = ms => animar(ms, () => {}, ease.lineal);

export function hayAnimaciones() { return activas.size > 0; }

export function actualizarAnimaciones(ahora) {
  for (const a of activas) {
    const p = Math.min(1, Math.max(0, (ahora - a.t0) / a.dur));
    a.fn(a.e(p), p);
    if (p === 1) { activas.delete(a); a.res(); }
  }
}

export function cancelarAnimaciones() { activas.clear(); }
