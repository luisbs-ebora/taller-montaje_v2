// cablea.js — Práctica «Cablea el equipo». Es la mesa del montaje animado, pero los cables los pone el alumno:
// coge la clavija de un cable, la arrastra por encima del equipo y la suelta en un conector.
// Al soltarla donde toca, el cable se tiende por el mismo recorrido que en el montaje animado.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, md } from '../util.js';
import { construirPiezas, CAJA } from '../animado/piezas.js';
import { TINTA, cambiarGeometria } from '../animado/toon.js';
import { animar, esperar, ease, alMomento, actualizarAnimaciones, cancelarAnimaciones } from '../animado/anim.js';
import { CABLES, DESTINOS, crearCaso, estadoInicial, cableEn, conectar, quitar, encender, apagar, explica, puntuar, solucion, TOPE_CRITICO } from '../practica/cablea.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GRIS = 0x454b62;
// Aspecto de cada cable: color, grosor y tamaño de su clavija
const ASPECTO = {
  atx24: { color: GRIS, r: 0.5, clavija: [1.4, 1.2, 5.3] }, eps: { color: GRIS, r: 0.35, clavija: [2.3, 1.0, 1.1] },
  pcie: { color: GRIS, r: 0.35, clavija: [2.3, 1.0, 1.1] }, satac: { color: GRIS, r: 0.25, clavija: [0.5, 0.9, 2.4] },
  satad: { color: 0xe5484d, r: 0.2, clavija: [1.4, 0.5, 0.9] }, fancpu: { color: 0x2e3340, r: 0.13, clavija: [1.2, 0.5, 0.5] },
  fancaja: { color: 0x2e3340, r: 0.13, clavija: [1.2, 0.5, 0.5] }, frontal: { color: 0xffd23f, r: 0.16, clavija: [2.0, 0.6, 0.6] },
  usbf: { color: 0x4a86e8, r: 0.2, clavija: [1.6, 0.6, 0.6] }, video: { color: 0x2e3340, r: 0.25, clavija: [1.0, 0.7, 1.5] },
};
const ETIQUETA = { atx24: 'ATX_24P', eps: 'CPU_PWR', gpu: 'Alimentación de la gráfica', cpufan: 'CPU_FAN', chafan: 'CHA_FAN', fpanel: 'F_PANEL', usb3: 'USB3',
  sata1: 'SATA 1', disco: 'Alimentación del disco', vgpu: 'HDMI de la gráfica', vplaca: 'HDMI de la placa' };
const CORTO = { atx24: 'ATX 24 pines', eps: '8 pines «CPU»', pcie: '8 pines «PCIe»', satac: 'SATA alimentación', satad: 'SATA datos', fancpu: 'Ventilador del disipador',
  fancaja: 'Ventiladores de la caja', frontal: 'Cables del frontal', usbf: 'USB del frontal', video: 'Cable del monitor' };

export function vistaCablea() {
  /* ---------- Interfaz ---------- */
  const lienzo = h('canvas.am-lienzo', { 'aria-label': 'Mesa de montaje en 3D: arrastra la clavija de cada cable hasta su conector.' });
  const pista = h('p.am-pista', 'Arrastra la clavija de un cable hasta su conector · arrastra el fondo para girar · rueda para acercar');
  const aviso = h('div.am-aviso', { role: 'status' });
  const tooltip = h('div.am-tooltip');
  const capaBurbujas = h('div.am-burbujas');
  const capaRotulos = h('div.am-burbujas.cb-rotulos');
  const sin3d = h('div.am-sin3d', { hidden: true }, h('p', 'Este navegador no puede mostrar gráficos 3D (WebGL). Prueba con otro navegador o actualízalo.'));
  const lista = h('ul.cb-estado');
  const bEncender = h('button.am-btn.am-principal', { type: 'button' });
  const bNombres = h('button.am-btn', { type: 'button', 'aria-pressed': 'true' }, 'Nombres de los conectores');
  const forzar = h('div.cb-forzar2', { hidden: true });
  const panel = h('aside.am-panel.cb-panel', h('div.am-panel-cab', h('h2', 'Cables')), lista, forzar, bEncender, h('p.am-nota.cb-pasa2'));
  const pasa = panel.querySelector('.cb-pasa2');
  const escenaEl = h('div.am-escena', lienzo, capaRotulos, capaBurbujas, tooltip, aviso, pista, panel, sin3d);
  const resultadoEl = h('div');
  const bVista = h('button.btn.sec', { type: 'button', onclick: () => irA(VISTA.pos, VISTA.obj) }, 'Vista general');
  const bDetras = h('button.btn.sec', { type: 'button', onclick: () => irA(V(-112, 30, -30), V(-58, 6, -14)) }, 'Ver por detrás');
  const bOtro = h('button.btn.sec', { type: 'button', onclick: () => nuevo() }, 'Otro equipo');
  const el = h('div.animado',
    h('div.am-cab',
      h('div', h('span.etiqueta', 'Práctica · Tema 3 · no cuenta para nota'), h('h1', 'Cablea el equipo'),
        h('p.lead', 'El equipo está montado, pero sin un solo cable puesto. Coge cada clavija, llévala a su conector y, cuando creas que está todo, enchufa y enciende.')),
      h('div.fila', bVista, bDetras, bNombres, bOtro)),
    escenaEl, resultadoEl);

  /* ---------- Estado ---------- */
  let renderer, escena, camara, controles, raiz, ro;
  let P = {}, caso, estado, ultimo = null, encendido = false, generacion = 0, verNombres = true;
  let cables = {}, destinos = {}, arrastre = null, detalle = [];
  const burbujas = [], rotulos = [], temporizadores = new Set();
  const VISTA = { pos: V(-36, 108, 60), obj: V(-46, 2, -6) };
  const ray = new THREE.Raycaster(), raton = new THREE.Vector2(), proy = new THREE.Vector3();
  const despues = (ms, fn) => { const t = setTimeout(() => { temporizadores.delete(t); fn(); }, ms); temporizadores.add(t); };

  const ctx = {
    get placa() { return P.placa; },
    get piezas() { return P; },
    enfocar: () => {}, burbuja: () => {}, chispas: () => {},
    enPlaca: (x, y, z) => { P.placa.grupo.updateWorldMatrix(true, false); return P.placa.grupo.localToWorld(V(x, y, z)); },
    alPlaca: obj => { P.placa.cuerpo.attach(obj); },
  };

  /* ---------- Escena (la misma mesa que el montaje animado) ---------- */
  function iniciar() {
    try { renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true }); } catch (e) { sin3d.hidden = false; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    escena = new THREE.Scene(); escena.background = new THREE.Color(0xf6eddd);
    camara = new THREE.PerspectiveCamera(36, 1, 0.5, 600); camara.position.copy(VISTA.pos);
    controles = new OrbitControls(camara, lienzo);
    controles.target.copy(VISTA.obj); controles.enableDamping = true; controles.maxPolarAngle = 1.4; controles.minDistance = 10; controles.maxDistance = 170;
    escena.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sol = new THREE.DirectionalLight(0xfff4e0, 2.3); sol.position.set(-38, 50, 30); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -75, right: 75, top: 50, bottom: -50, near: 1, far: 160 });
    sol.target.position.set(-16, 0, 0); escena.add(sol.target); sol.shadow.bias = -0.0006; escena.add(sol);
    const mesa = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ opacity: 0.13 }));
    mesa.rotation.x = -Math.PI / 2; mesa.position.y = -0.6; mesa.receiveShadow = true; escena.add(mesa);
    const [AW, AD, AX] = [124, 62, -16], geo = new THREE.BoxGeometry(AW, 0.6, AD);
    const alf = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: 0x9cc3e6 })); alf.receiveShadow = true; alf.position.set(AX, -0.3, 0);
    const borde = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide }));
    borde.scale.set((AW + 0.3) / AW, 0.9 / 0.6, (AD + 0.3) / AD); alf.add(borde); escena.add(alf);
    const rejilla = new THREE.GridHelper(AW - 2, 40, 0x86b0d6, 0x86b0d6); rejilla.scale.z = (AD - 2) / (AW - 2); rejilla.position.set(AX, 0.01, 0); escena.add(rejilla);

    ro = new ResizeObserver(ajustar); ro.observe(escenaEl); ajustar();
    const reloj = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(reloj.getDelta(), 0.05);
      actualizarAnimaciones(performance.now());
      for (const p of Object.values(P)) {
        if (p.actualizarCordon) p.actualizarCordon();
        if (p.cadaFrame) p.cadaFrame(dt);
        if (!p.rotores) continue;
        if (!encendido) p.velocidad *= Math.pow(0.2, dt);
        for (const r of p.rotores) r.obj.rotation[r.eje] += p.velocidad * dt;
      }
      controles.update();
      renderer.render(escena, camara);
      const w = lienzo.clientWidth, hh = lienzo.clientHeight;
      for (const b of [...burbujas, ...rotulos]) {
        proy.copy(b.pos).project(camara);
        b.el.style.transform = `translate(${((proy.x + 1) / 2) * w}px, ${((1 - proy.y) / 2) * hh}px)`;
        if (b.rotulo) b.el.style.visibility = proy.z < 1 ? 'visible' : 'hidden';
      }
    });
    lienzo.addEventListener('pointerdown', alPulsar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSoltar);
    lienzo.addEventListener('pointercancel', alSoltar);
    lienzo.addEventListener('pointerleave', () => { if (!arrastre) tooltip.classList.remove('visible'); });
    nuevo();
  }
  function ajustar() {
    if (!renderer) return;
    const r = escenaEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    const px = r.width > 820 ? panel.offsetWidth + 24 : 0;
    camara.aspect = (r.width + px) / r.height;
    const visible = r.width / r.height;
    camara.fov = Math.min(72, Math.max(36, (2 * Math.atan(Math.tan((31 * Math.PI) / 180) / visible) * 180) / Math.PI));
    if (px) camara.setViewOffset(r.width + px, r.height, px, 0, r.width, r.height); else camara.clearViewOffset();
    camara.updateProjectionMatrix();
  }
  function irA(pos, obj, ms = 900) {
    if (!controles) return;
    const t0 = controles.target.clone(), c0 = camara.position.clone();
    return animar(ms, t => { controles.target.lerpVectors(t0, obj, t); camara.position.lerpVectors(c0, pos, t); });
  }
  function burbuja(texto, pos, tipo = '') {
    const b = h('div.am-burbuja' + (tipo ? '.' + tipo : ''), h('span', texto));
    capaBurbujas.append(b);
    const reg = { el: b, pos: pos.clone() }; burbujas.push(reg);
    despues(1900, () => { b.remove(); burbujas.splice(burbujas.indexOf(reg), 1); });
  }
  let avisoT = null;
  function avisar(texto, tipo = '') {
    aviso.textContent = texto; aviso.className = 'am-aviso visible' + (tipo ? ' ' + tipo : '');
    clearTimeout(avisoT); avisoT = setTimeout(() => aviso.classList.remove('visible'), 5200);
  }

  /* ---------- Un equipo nuevo: montado del todo, sin cables ---------- */
  async function nuevo() {
    const mia = ++generacion;
    cancelarAnimaciones();
    if (raiz) { escena.remove(raiz); raiz.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    burbujas.splice(0).forEach(b => b.el.remove()); rotulos.splice(0).forEach(b => b.el.remove());
    caso = crearCaso(Math.floor(Math.random() * 2147483647)); estado = estadoInicial(); ultimo = null; encendido = false; detalle = [];
    resultadoEl.replaceChildren(); forzar.hidden = true; pasa.textContent = '';
    raiz = new THREE.Group(); escena.add(raiz);
    P = construirPiezas();
    for (const p of Object.values(P)) raiz.add(p.grupo, p.fijo);
    const montar = ['cpu', 'pasta', 'disipador', 'ram', 'ssd', 'chapa', 'separadores', 'ventiladores', 'placa', 'fuente', ...(caso.hdd ? ['hdd'] : []), ...(caso.conGpu ? ['gpu'] : []), 'wifi', 'monitor'];
    await alMomento(async () => { for (const id of montar) { await P[id].montar(ctx); P[id].montado = true; } });
    if (mia !== generacion) return;
    // Fuera lo que no se usa aquí y todos los cables que tendió el montaje: los pone el alumno
    for (const id of ['pulsera', 'c24', 'eps', 'frontal', 'revisar', 'enchufe', ...(caso.hdd ? [] : ['hdd']), ...(caso.conGpu ? [] : ['gpu'])]) { P[id].grupo.visible = false; P[id].fijo.visible = false; }
    for (const id of ['hdd', 'gpu', 'monitor']) P[id].fijo.clear();
    P.placa.cableFan.geometry.setDrawRange(0, 0);
    for (const p of Object.values(P)) if (p.rotores) p.velocidad = 0;
    if (P.ventiladores.aire) P.ventiladores.aire(null);
    prepararCables();
    if (new URLSearchParams(location.search).has('prueba')) window.__cablea = { cables, destinos, camara, lienzo, caso, estado };
    ambientar(null);
    pintar();
    irA(VISTA.pos, VISTA.obj, 600);
  }

  /* ---------- Cables: origen, reposo, destinos y recorridos ---------- */
  function prepararCables() {
    const k = P.placa.k, e = ctx.enPlaca;
    raiz.updateMatrixWorld(true);
    // cabezal CHA_FAN, que la placa del montaje animado no traía
    const cha = k.caja(1.2, 0.55, 0.5, 0x2e3340, 0.03); cha.position.set(13.6, 0.52, -7.6); P.placa.cuerpo.add(cha);
    const entrada = V(-48, 10, -46.1);
    const gpuFin = caso.conGpu ? (P.gpu.cuerpo.updateWorldMatrix(true, false), P.gpu.cuerpo.localToWorld(V(20, 11.7, 1.2))) : null;
    const salida = caso.conGpu ? P.gpu.cuerpo.localToWorld(V(-0.8, 6, 1.0)) : null; if (salida) salida.x = CAJA.x0 - 0.3;
    const hdmi = e(-15.32, 1.0, -0.5); hdmi.x = CAJA.x0 - 0.3;
    destinos = {
      atx24: e(13.6, 2.85, -1), eps: e(-11.5, 2.45, -11.2), cpufan: e(1.5, 1.0, -10.6), chafan: e(13.6, 1.0, -7.6), fpanel: e(13.2, 1.0, 11.2), usb3: e(9.5, 1.0, 11.2),
      sata1: e(14.4, 0.9, 7.9), disco: V(-39, 2.1, 6.2), gpu: gpuFin, vgpu: salida, vplaca: hdmi,
    };
    const fr = CAJA.x1;
    const ORIG = {
      atx24: [V(-49.8, 3.5, 8), V(-46.2, 1.5, 6.6)], eps: [V(-49.8, 6.5, 7), V(-46.2, 1.4, 10.4)], pcie: [V(-49.8, 5, 9.5), V(-46.2, 1.4, 13.8)],
      satac: [V(-49.8, 3.2, 11), V(-46.2, 1.4, 17.4)], satad: [V(-35, 2.1, 6.2), V(-32.6, 1.2, 5.6)], fancpu: [e(-0.1, 3.2, -1.2), e(3.6, 0.7, -5.6)],
      fancaja: [V(fr - 2.4, 6.5, -5), V(fr - 2.2, 1.2, -3)], frontal: [V(fr - 1, 9.5, -15.5), V(fr - 2.2, 1.2, -15)], usbf: [V(fr - 1, 9.5, -11.2), V(fr - 2.2, 1.2, -10.4)],
      video: [entrada, V(-58, 0.5, -37)],
    };
    // Recorridos de cada cable hasta su sitio (los del montaje animado); para los demás, un arco por encima
    const RUTA = {
      'atx24>atx24': (o, f) => [o, V(-45, 9, 8), V(-36, 10, 2), V(f.x, 8, f.z + 2), V(f.x, 6, f.z), f],
      'eps>eps': (o, f) => [o, V(-55, 11, 5.6), V(-60.5, 14.3, 4.5), V(-60.5, 14.3, -15), V(f.x - 1.5, 9, f.z), f],
      'pcie>gpu': (o, f) => [o, V(-44, 10, 8), f.clone().add(V(0, 3.5, 2)), f],
      'satac>disco': (o, f) => [o, V(-45, 4.5, 8.5), V(-39, 3.4, 6.6), f],
      'satad>sata1': (o, f) => [o, V(-34, 3.2, 3.5), V(f.x, 3, f.z + 1.5), f],
      'fancpu>cpufan': (o, f) => [o, e(0.9, 1.5, -3), e(1.4, 1.1, -8), f],
      'fancaja>chafan': (o, f) => [o, V(fr - 3.2, 3.6, -6.4), V(f.x + 1.4, 2.2, f.z), f],
      'frontal>fpanel': (o, f) => [o, V(-29.2, 6, -6), V(-30, 3.5, 1), V(f.x + 0.5, 2.5, f.z - 0.5), f],
      'usbf>usb3': (o, f) => [o, V(-29.6, 6.5, -4), V(-33, 4, 1.5), V(f.x, 2.6, f.z - 0.6), f],
      'video>vgpu': (o, f) => [o, o.clone().add(V(-4, -6, -1)), V(-70, 0.5, -36), V(-69, 0.5, -8), V(f.x - 2.5, f.y, f.z), f],
      'video>vplaca': (o, f) => [o, o.clone().add(V(-4, -6, -1)), V(-70, 0.5, -36), V(-69, 0.5, -8), V(f.x - 2.5, f.y, f.z), f],
    };
    const arco = (o, f) => { const alto = Math.max(o.y, f.y) + 7; return [o, o.clone().lerp(f, 0.25).setY(alto), o.clone().lerp(f, 0.75).setY(alto), f.clone().add(V(0, 2.5, 0)), f]; };
    cables = {};
    for (const id of caso.cables) {
      const a = ASPECTO[id], [origen, reposo] = ORIG[id];
      const clavija = k.caja(...a.clavija, id === 'atx24' || id === 'eps' || id === 'pcie' || id === 'satac' ? 0x2e3340 : a.color, 0.05);
      clavija.userData.cable = id; clavija.traverse(o => { o.userData.cable = id; });
      const cordon = k.tubo(curvaFloja(origen, reposo), a.r, a.color, 0.06, 40);
      raiz.add(clavija, cordon);
      cables[id] = { id, origen, reposo, clavija, cordon, tendido: null, ruta: d => (RUTA[id + '>' + d] || arco)(origen, destinos[d]) };
      soltarEnReposo(cables[id], false);
    }
    // rótulos de los conectores, como la serigrafía de la placa
    for (const d of caso.destinos) {
      const elr = h('div.am-burbuja.cb-rotulo', h('span', ETIQUETA[d]));
      capaRotulos.append(elr); rotulos.push({ el: elr, pos: destinos[d].clone().add(V(0, 1.2, 0)), rotulo: true, d });
    }
    capaRotulos.hidden = !verNombres;
  }
  function curvaFloja(a, b, comba = 0.5) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; const p = a.clone().lerp(b, t); p.y += Math.sin(Math.PI * t) * comba - (a.y - b.y) * (t * t - t) * 0; pts.push(p); }
    return new THREE.CatmullRomCurve3(pts);
  }
  // cordón mientras se arrastra: sube desde el origen, cuelga hasta la mano
  function curvaMano(a, b) {
    const alto = Math.max(a.y, b.y) + 3;
    return new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.3).setY(alto), a.clone().lerp(b, 0.75).setY(Math.max(alto - 0.6, b.y + 1.2)), b]);
  }
  const tubo = (c, curva) => new THREE.TubeGeometry(curva, 60, ASPECTO[c.id].r, 10, false);
  function soltarEnReposo(c, animado = true) {
    if (c.tendido) { raiz.remove(c.tendido); c.tendido = null; }
    c.cordon.visible = true;
    const desde = c.clavija.position.clone();
    const poner = p => { c.clavija.position.copy(p); cambiarGeometria(c.cordon, tubo(c, curvaFloja(c.origen, p, 0.5))); };
    c.clavija.rotation.set(0, 0, 0); c.clavija.scale.setScalar(1);
    if (!animado) { poner(c.reposo); return; }
    animar(380, t => poner(desde.clone().lerp(c.reposo, t).add(V(0, Math.sin(Math.PI * t) * 2, 0))), ease.salida);
  }
  async function tender(c, dest) {
    const pts = c.ruta(dest), fin = pts[pts.length - 1];
    c.cordon.visible = false;
    const k = P.placa.k;
    c.tendido = k.tubo(new THREE.CatmullRomCurve3(pts), ASPECTO[c.id].r, ASPECTO[c.id].color, 0.06, 90);
    c.tendido.traverse(o => { o.userData.cable = c.id; });
    const total = c.tendido.geometry.index.count; c.tendido.geometry.setDrawRange(0, 0);
    raiz.add(c.tendido);
    c.clavija.position.copy(fin).add(V(0, ASPECTO[c.id].clavija[1] / 2, 0));
    if (dest === 'vgpu' || dest === 'vplaca') c.clavija.position.copy(fin).add(V(-0.6, 0, 0));
    c.clavija.scale.setScalar(0.001);
    await animar(520, t => c.tendido.geometry.setDrawRange(0, Math.floor((t * total) / 60) * 60), ease.lineal);
    c.tendido.geometry.setDrawRange(0, Infinity);
    await animar(260, t => c.clavija.scale.setScalar(Math.max(0.001, t)), ease.muelle);
  }

  /* ---------- Arrastrar ---------- */
  function rayo(ev) {
    const r = lienzo.getBoundingClientRect();
    raton.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(raton, camara);
    return r;
  }
  function cableEnPunto(ev) {
    // la clavija más cercana al puntero en la pantalla (así dos clavijas juntas no se confunden)
    const r = lienzo.getBoundingClientRect(); let mejor = null, dMin = 30;
    for (const c of Object.values(cables)) {
      proy.copy(c.clavija.position).project(camara);
      if (proy.z > 1) continue;
      const d = Math.hypot(((proy.x + 1) / 2) * r.width - (ev.clientX - r.left), ((1 - proy.y) / 2) * r.height - (ev.clientY - r.top));
      if (d < dMin) { dMin = d; mejor = c; }
    }
    return mejor;
  }
  function destinoCerca(ev) {
    const r = lienzo.getBoundingClientRect(); let mejor = null, dMin = 38;
    for (const d of caso.destinos) {
      proy.copy(destinos[d]).project(camara);
      if (proy.z > 1) continue;
      const dist = Math.hypot(((proy.x + 1) / 2) * r.width - (ev.clientX - r.left), ((1 - proy.y) / 2) * r.height - (ev.clientY - r.top));
      if (dist < dMin) { dMin = dist; mejor = d; }
    }
    return mejor;
  }
  function etiqueta(ev, texto) {
    if (!texto) { tooltip.classList.remove('visible'); return; }
    const r = lienzo.getBoundingClientRect();
    tooltip.textContent = texto; tooltip.style.transform = `translate(${ev.clientX - r.left + 14}px, ${ev.clientY - r.top + 14}px)`; tooltip.classList.add('visible');
  }
  function alPulsar(ev) {
    if (!caso || estado.terminado || arrastre) return;
    const c = cableEnPunto(ev);
    if (!c) return;
    if (estado.conex[c.id]) {
      const r = quitar(estado, c.id);
      if (!r.ok) { avisar(r.motivo, 'peligro'); pintar(); return; }
    } else if (estado.enchufado) { conectar(estado, c.id, caso.destinos[0]); avisar('¡Alto! El equipo está enchufado. Los cables se ponen y se quitan con la fuente desenchufada.', 'peligro'); pintar(); return; }
    if (c.tendido) { raiz.remove(c.tendido); c.tendido = null; }
    c.cordon.visible = true; c.clavija.scale.setScalar(1.25);
    controles.enabled = false; lienzo.setPointerCapture(ev.pointerId);
    pista.classList.add('oculta'); forzar.hidden = true;
    arrastre = { c, plano: new THREE.Plane(new THREE.Vector3(0, 1, 0), -Math.max(c.id === 'video' ? 5 : 9, c.origen.y + 1)) };
    alMover(ev); pintar();
  }
  function alMover(ev) {
    if (!arrastre) { const c = caso && !estado.terminado ? cableEnPunto(ev) : null; etiqueta(ev, c ? CABLES[c.id].nombre : ''); lienzo.style.cursor = c ? 'grab' : ''; return; }
    rayo(ev);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(arrastre.plano, p)) return;
    p.x = Math.max(-84, Math.min(42, p.x)); p.z = Math.max(-52, Math.min(30, p.z));
    const d = destinoCerca(ev);
    arrastre.destino = d;
    if (d) p.copy(destinos[d]).add(V(0, 2.2, 0)); // se acerca al conector que tiene debajo
    arrastre.c.clavija.position.copy(p);
    cambiarGeometria(arrastre.c.cordon, tubo(arrastre.c, curvaMano(arrastre.c.origen, p)));
    etiqueta(ev, d ? ETIQUETA[d] : CORTO[arrastre.c.id]);
    for (const r of rotulos) r.el.classList.toggle('cerca', r.d === d);
  }
  async function alSoltar(ev) {
    if (!arrastre) return;
    const { c, destino } = arrastre; arrastre = null;
    controles.enabled = true; try { lienzo.releasePointerCapture(ev.pointerId); } catch (e) { /* ya suelto */ }
    tooltip.classList.remove('visible'); for (const r of rotulos) r.el.classList.remove('cerca');
    if (!destino) { soltarEnReposo(c); pintar(); return; }
    await intentar(c, destino, false);
  }
  async function intentar(c, destino, apretar) {
    const r = conectar(estado, c.id, destino, apretar);
    if (r.ok) {
      await tender(c, destino);
      burbuja(apretar ? '¡Crac! Metido a la fuerza' : '¡Clic! ' + ETIQUETA[destino], destinos[destino].clone().add(V(0, 3, 0)), apretar ? 'peligro' : '');
      forzar.hidden = true;
    } else if (r.forzable) {
      // se queda encima, a medio meter, hasta que decida
      c.clavija.position.copy(destinos[destino]).add(V(0, 2.2, 0)); c.clavija.rotation.z = 0.25;
      cambiarGeometria(c.cordon, tubo(c, curvaMano(c.origen, c.clavija.position)));
      avisar(r.motivo, 'peligro');
      forzar.replaceChildren(h('p', h('b', CORTO[c.id]), ' en ', h('b', ETIQUETA[destino]), ': entra hasta la mitad y cuesta.'),
        h('button.am-btn', { type: 'button', onclick: () => { forzar.hidden = true; soltarEnReposo(c); avisar('Bien: si cuesta meterlo, es que no es el suyo.'); pintar(); } }, 'No forzarlo'),
        h('button.am-btn.am-peligro', { type: 'button', onclick: async () => { forzar.hidden = true; await intentar(c, destino, true); } }, 'Apretar hasta que entre'));
      forzar.hidden = false;
    } else {
      burbuja('No entra', destinos[destino].clone().add(V(0, 3, 0)), 'peligro'); avisar(r.motivo, 'peligro');
      soltarEnReposo(c);
    }
    pintar();
  }

  /* ---------- Encender ---------- */
  const COLOR_LED = { CPU: 0xe5484d, VGA: 0xffffff, BOOT: 0x3fbf6a, DRAM: 0xffb020 };
  function ambientar(r) {
    encendido = !!(r && r.luz);
    const g = r ? r.giran : {};
    P.disipador.velocidad = g.disipador ? 22 : 0; P.fuente.velocidad = g.fuente ? 14 : 0; P.ventiladores.velocidad = g.caja ? 14 : 0; if (P.gpu.rotores) P.gpu.velocidad = g.grafica ? 16 : 0;
    const led = P.placa.led.material; const col = r && r.led ? COLOR_LED[r.led] : (r && r.luz ? 0x3fbf6a : 0x3a3f4b);
    led.color.set(col); led.emissive.set(r && (r.led || r.luz) ? col : 0x000000);
    const fr = P.caja.ledFrente.material; fr.color.set(r && r.luz ? 0x3fbf6a : 0x3a3f4b); fr.emissive.set(r && r.luz ? 0x2fbf5a : 0x000000);
    const pan = P.monitor.pantalla.material, p = r ? r.pantalla : 'Apagada';
    const imagen = /^Arranca normal/.test(p), texto = !/^Apagada|Sin señal|^Arranca normal/.test(p);
    pan.color.set(imagen ? 0x7fb4ff : texto ? 0x10131c : 0x16243a); pan.emissive.set(imagen ? 0x3a6fd0 : 0x000000);
  }
  async function alEncender() {
    if (estado.terminado) return;
    if (estado.enchufado) { apagar(estado); ultimo = null; ambientar(null); pasa.textContent = ''; pintar(); return; }
    bEncender.disabled = true;
    // se pulsa el botón de la caja
    const b = P.caja.boton, x0 = b.position.x;
    await animar(180, t => { b.position.x = x0 - 0.3 * t; }, ease.salida); await animar(220, t => { b.position.x = x0 - 0.3 + 0.3 * t; }, ease.salida);
    ultimo = encender(caso, estado);
    if (ultimo.tipo !== 'bien') detalle.push(explica(ultimo) || ultimo.texto);
    ambientar(ultimo);
    const M = V(-50, 34, -44);
    if (ultimo.tipo === 'averia') { burbuja('¡Chasquido!', destinos.eps.clone().add(V(0, 5, 0)), 'peligro'); burbuja('Huele a quemado', V(-46, 14, 0), 'peligro'); }
    else if (ultimo.tipo === 'nada') burbuja('No pasa nada…', V(CAJA.x1 + 1, 14, -15), 'peligro');
    else if (/Sin señal/.test(ultimo.pantalla)) { burbuja('Sin señal', M, 'peligro'); if (ultimo.led) burbuja('LED ' + ultimo.led + ' encendido', ctx.enPlaca(11, 3.4, 7.5), 'peligro'); }
    else if (!ultimo.arranca) { burbuja(ultimo.pantalla, M, 'peligro'); if (ultimo.led) burbuja('LED ' + ultimo.led + ' encendido', ctx.enPlaca(11, 3.4, 7.5), 'peligro'); }
    else burbuja('¡Hay imagen!', M);
    pasa.textContent = ultimo.texto;
    if (estado.terminado) await esperar(900);
    bEncender.disabled = false;
    pintar();
  }
  bEncender.addEventListener('click', alEncender);
  bNombres.addEventListener('click', () => { verNombres = !verNombres; capaRotulos.hidden = !verNombres; bNombres.setAttribute('aria-pressed', String(verNombres)); });

  /* ---------- Panel ---------- */
  function pintar() {
    if (!caso) return;
    lista.replaceChildren(...caso.cables.map(id => {
      const d = estado.conex[id];
      return h('li' + (d ? '.puesto' : ''), h('button', { type: 'button', title: 'Ver dónde está', onclick: () => { const c = cables[id]; irA(c.clavija.position.clone().add(V(14, 26, 22)), c.clavija.position.clone(), 600); } },
        h('i', { style: `background:#${ASPECTO[id].color.toString(16).padStart(6, '0')}` }), h('span', CORTO[id]), h('small', d ? '→ ' + ETIQUETA[d] : 'suelto')));
    }));
    const libres = caso.cables.filter(c => !estado.conex[c]).length;
    bEncender.hidden = estado.terminado;
    bEncender.textContent = estado.enchufado ? 'Apagar y desenchufar' : 'Enchufar y encender';
    bEncender.className = 'am-btn' + (estado.enchufado ? '' : ' am-principal');
    if (!estado.enchufado && !estado.terminado && !pasa.textContent) pasa.textContent = libres ? `Quedan ${libres} cables sueltos. Puede que alguno sobre.` : '';
    if (estado.terminado) resultadoEl.replaceChildren(resultado());
  }
  function resultado() {
    const n = puntuar(estado), sol = solucion(caso);
    return h('div.tarjeta.av-resultado',
      h('h3', `Resultado: ${n.nota.toLocaleString('es-ES')} / 10`),
      n.criticos.length ? h('p.mensaje.error', h('b', `Fallo crítico: la nota no pasa de ${TOPE_CRITICO}. `), n.criticos.join(' ')) : null,
      h('ul.av-detalle',
        h('li.' + (n.bien ? 'ok' : 'ko'), n.bien ? (n.fallidos ? `✓ El equipo arranca, pero has necesitado ${n.fallidos + 1} encendidos.` : '✓ El equipo arranca a la primera.') : '✗ El equipo ha quedado dañado: no arranca.'),
        ...[...new Set(detalle)].map(t => h('li.ko', '✗ ' + t))),
      h('p', h('b', 'El cableado correcto:')),
      h('ul.cb-solucion', Object.entries(sol).map(([c, d]) => h('li', { html: md(`**${CABLES[c].nombre}** → ${DESTINOS[d].nombre}`) })),
        caso.cables.filter(c => !sol[c]).map(c => h('li', { html: md(`**${CABLES[c].nombre}**: sobra en este equipo, se deja recogido.`) }))),
      h('button.btn.azul', { type: 'button', onclick: () => { nuevo(); el.scrollIntoView({ behavior: 'smooth' }); } }, 'Otro equipo'));
  }

  return {
    el,
    montado: iniciar,
    destruir() {
      generacion++; cancelarAnimaciones(); temporizadores.forEach(clearTimeout); clearTimeout(avisoT);
      if (ro) ro.disconnect();
      if (renderer) { renderer.setAnimationLoop(null); renderer.dispose(); }
      if (controles) controles.dispose();
    },
  };
}
