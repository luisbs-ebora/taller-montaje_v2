// cablea.js — La mesa del montaje animado, pero con las manos del alumno. Tres prácticas en la misma escena:
//  · 'cablea'   «Cablea el equipo»: coge la clavija de cada cable, la arrastra y la suelta en su conector.
//  · 'repara'   «Repara el equipo» (prueba): el equipo llega cableado y con una avería. Diagnóstico y reparación a mano.
//  · 'completa' «Cablea y repara» (prueba): primero se cablea; después vuelve al taller con una avería.
// Al soltar una clavija donde toca, el cable se tiende por el mismo recorrido que en el montaje animado.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, md } from '../util.js';
import { construirPiezas, CAJA } from '../animado/piezas.js';
import { TINTA, cambiarGeometria } from '../animado/toon.js';
import { animar, esperar, ease, alMomento, actualizarAnimaciones, cancelarAnimaciones } from '../animado/anim.js';
import { CABLES, DESTINOS, crearCaso, estadoInicial, cableEn, conectar, quitar, encender, apagar, explica, puntuar, solucion, TOPE_CRITICO } from '../practica/cablea.js';
import { PIEZAS, crearAveria, estadoAveriado, manoProhibida, alSacar, tocar, encenderBanco, diagnosticar, entregar, puntuarReparacion } from '../practica/repara.js';

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

const TEXTOS = {
  cablea: { etiqueta: 'Práctica · Tema 3 · no cuenta para nota', titulo: 'Cablea el equipo',
    lead: 'El equipo está montado, pero sin un solo cable puesto. Coge cada clavija, llévala a su conector y, cuando creas que está todo, enchufa y enciende.' },
  repara: { etiqueta: 'Prueba A · Tema 3 · no cuenta para nota', titulo: 'Repara el equipo',
    lead: 'Te traen un equipo al taller. Míralo por todos lados, enciéndelo si hace falta y entrega el diagnóstico. Después arréglalo con tus manos y comprueba que arranca.' },
  completa: { etiqueta: 'Práctica · Tema 3 · no cuenta para nota', titulo: 'Cablea y repara',
    lead: 'Primero cableas el equipo y lo dejas funcionando. Cuando lo entregues, volverá al taller con una avería: tendrás que diagnosticarla y repararla en ese mismo equipo.' },
};

export function vistaCablea(modo = 'cablea') {
  const T = TEXTOS[modo];
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
  const parteEl = h('div.cb-parte', { hidden: true });
  const bSeguir = h('button.am-btn.am-principal', { type: 'button', hidden: true }, 'Entregar el equipo al cliente');
  const bEntregar = h('button.am-btn', { type: 'button', hidden: true }, 'Dar el equipo por terminado');
  const tituloPanel = h('h2', 'Cables');
  const panel = h('aside.am-panel.cb-panel', h('div.am-panel-cab', tituloPanel), parteEl, forzar, bEncender, bSeguir, h('p.am-nota.cb-pasa2'), lista, bEntregar);
  const pasa = panel.querySelector('.cb-pasa2');
  // La mesa a la izquierda y el panel a la derecha, en su propia columna: el panel ya no tapa el equipo.
  const vistaEl = h('div.cb-vista', lienzo, capaRotulos, capaBurbujas, tooltip, aviso, pista, sin3d);
  const escenaEl = h('div.am-escena.cb-escena', vistaEl, panel);
  const resultadoEl = h('div');
  const bVista = h('button.btn.sec', { type: 'button', onclick: () => irA(VISTA.pos, VISTA.obj) }, 'Vista general');
  const bDetras = h('button.btn.sec', { type: 'button', onclick: () => irA(V(-112, 30, -30), V(-58, 6, -14)) }, 'Ver por detrás');
  const bOtro = h('button.btn.sec', { type: 'button', onclick: () => nuevo() }, 'Otro equipo');
  const bGrande = h('button.btn.sec.cb-bgrande', { type: 'button', 'aria-pressed': 'false', title: 'Pantalla grande (tecla F; Esc para salir)' }, 'Pantalla grande');
  // Botones y mesa juntos: es lo que se pone en pantalla completa.
  const mesaEl = h('div.cb-mesa', h('div.fila.cb-barra', bVista, bDetras, bNombres, bOtro, bGrande), escenaEl);
  const el = h('div.animado',
    h('div.am-cab', h('div', h('span.etiqueta', T.etiqueta), h('h1', T.titulo), h('p.lead', T.lead))),
    mesaEl, resultadoEl);

  /* ---------- Estado ---------- */
  let renderer, escena, camara, controles, raiz, ro;
  let P = {}, caso, estado, ultimo = null, encendido = false, generacion = 0, verNombres = true;
  let cables = {}, destinos = {}, arrastre = null, detalle = [];
  // fase: 'cablear' (poner cables) o 'reparar' (hay una avería). av: la avería. notaA: nota del cableado en «Cablea y repara».
  let fase = 'cablear', av = null, notaA = null, anterior = null, causaElegida = '', toque = null, tocables = [], base = null;
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

    ro = new ResizeObserver(ajustar); ro.observe(vistaEl); ajustar();
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
      for (const b of burbujas) {
        proy.copy(b.pos).project(camara);
        b.el.style.transform = `translate(${((proy.x + 1) / 2) * w}px, ${((1 - proy.y) / 2) * hh}px)`;
      }
      colocarRotulos(w, hh);
    });
    lienzo.addEventListener('pointerdown', alPulsar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSoltar);
    lienzo.addEventListener('pointercancel', alSoltar);
    lienzo.addEventListener('pointerleave', () => { if (!arrastre) tooltip.classList.remove('visible'); });
    nuevo();
  }
  // Rótulos de los conectores: si dos se pisan, el de más arriba sube hasta que quedan separados.
  function colocarRotulos(w, hh) {
    if (!verNombres) return;
    const puestos = [];
    const lista = rotulos.map(r => {
      proy.copy(r.pos).project(camara);
      if (!r.ancho) { const sp = r.el.firstChild; r.ancho = sp.offsetWidth; r.alto = sp.offsetHeight; }
      return { r, x: ((proy.x + 1) / 2) * w, y: ((1 - proy.y) / 2) * hh, delante: proy.z < 1 };
    }).sort((a, b) => b.y - a.y);
    for (const p of lista) {
      const { r } = p, aw = r.ancho + 4, ah = r.alto + 2;
      let y = p.y;
      if (r.ancho) for (let i = 0; i < 12; i++) {
        // cada rótulo ocupa de y − alto hasta y (se ancla por abajo, centrado en x)
        const pisa = puestos.find(q => Math.abs(q.x - p.x) < (q.aw + aw) / 2 && y > q.y - q.ah && y - ah < q.y);
        if (!pisa) break;
        y = pisa.y - pisa.ah;
      }
      puestos.push({ x: p.x, y, aw, ah });
      r.el.style.transform = `translate(${p.x}px, ${y}px)`;
      r.el.style.visibility = p.delante ? 'visible' : 'hidden';
    }
  }
  function ajustar() {
    if (!renderer) return;
    const r = vistaEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    const px = 0;
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
    const semilla = Math.floor(Math.random() * 2147483647), pedida = new URLSearchParams(location.search).get('averia');
    av = null; notaA = null; causaElegida = ''; fase = modo === 'repara' ? 'reparar' : 'cablear';
    if (modo === 'repara') { av = crearAveria(semilla, { excluir: anterior, forzar: pedida }); anterior = av.id; caso = av.caso; estado = estadoAveriado(av); }
    else { caso = crearCaso(semilla); estado = estadoInicial(); }
    ultimo = null; encendido = false; detalle = [];
    resultadoEl.replaceChildren(); forzar.hidden = true; pasa.textContent = '';
    raiz = new THREE.Group(); escena.add(raiz);
    P = construirPiezas();
    for (const p of Object.values(P)) raiz.add(p.grupo, p.fijo);
    const montar = ['cpu', 'pasta', 'disipador', 'ram', 'ssd', 'chapa', 'separadores', 'ventiladores', 'placa', 'fuente', ...(caso.hdd ? ['hdd'] : []), ...(caso.conGpu ? ['gpu'] : []), 'wifi', 'monitor'];
    await alMomento(async () => { for (const id of montar) { await P[id].montar(ctx); P[id].montado = true; } });
    if (mia !== generacion) return;
    // Fuera lo que no se usa aquí y todos los cables que tendió el montaje: los pone el alumno
    for (const id of ['pulsera', 'c24', 'eps', 'frontal', 'revisar', 'enchufe', ...(caso.hdd ? [] : ['hdd']), ...(caso.conGpu ? [] : ['gpu'])]) { P[id].grupo.visible = false; P[id].fijo.visible = false; }
    for (const id of ['hdd', 'gpu', 'monitor', 'wifi']) P[id].fijo.clear(); // (el cable Bluetooth de la wifi cruzaba por encima del conector de la gráfica y despistaba)
    P.placa.cableFan.geometry.setDrawRange(0, 0);
    for (const p of Object.values(P)) if (p.rotores) p.velocidad = 0;
    if (P.ventiladores.aire) P.ventiladores.aire(null);
    prepararCables();
    if (modo !== 'cablea') sincronizar();
    if (new URLSearchParams(location.search).has('prueba')) window.__cablea = { cables, destinos, camara, lienzo, caso, get estado() { return estado; }, get av() { return av; }, get fase() { return fase; }, get tocables() { return tocables; }, get P() { return P; }, controles };
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
    // Piezas que se tocan con la mano en las reparaciones, y cómo están cuando están bien puestas
    const pila = P.placa.cuerpo.children.find(o => Math.abs(o.position.x - 8.5) < 0.01 && Math.abs(o.position.z - 4) < 0.01);
    tocables = [{ id: 'ram', obj: P.ram.grupo }, { id: 'disipador', obj: P.disipador.grupo }, { id: 'pila', obj: pila }, { id: 'interruptor', obj: P.fuente.interruptor }];
    // marcas I y O junto al interruptor de la fuente, como las que lleva serigrafiadas
    const blanco = new THREE.MeshBasicMaterial({ color: 0xffffff }), fc = P.fuente.cuerpo;
    const marcaI = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.14), blanco); marcaI.position.set(-7.06, -0.45, -0.2);
    const marcaO = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 16), blanco); marcaO.rotation.y = Math.PI / 2; marcaO.position.set(-7.06, -2.75, -0.2);
    fc.add(marcaI, marcaO);
    base = { ramP: P.ram.grupo.position.clone(), ramQ: P.ram.grupo.quaternion.clone(), disP: P.disipador.grupo.position.clone(), disQ: P.disipador.grupo.quaternion.clone() };
  }
  // Pone el equipo como dice el estado, sin animar: cables en su conector (o sueltos) y piezas bien o mal puestas
  function sincronizar() {
    for (const c of Object.values(cables)) {
      if (c.tendido) { raiz.remove(c.tendido); c.tendido = null; }
      const d = estado.conex[c.id];
      if (d) tender(c, d, { animado: false, flojo: (estado.flojos || []).includes(c.id) }); else soltarEnReposo(c, false);
    }
    verPiezas();
  }
  function verPiezas() {
    const hw = estado.hw || { interruptor: true, ram: 'bien', disipador: 'bien' };
    const m = P.ram.grupo, pest = P.placa.pestanas.find(p => p.s === -1);
    m.position.copy(base.ramP); m.quaternion.copy(base.ramQ); pest.piv.rotation.x = 0;
    if (hw.ram === 'suelta') { m.position.y += 0.75; m.rotateZ(0.11); pest.piv.rotation.x = -0.6; }
    const d = P.disipador.grupo; d.position.copy(base.disP); d.quaternion.copy(base.disQ);
    if (hw.disipador === 'flojo') { d.position.y += 1.0; d.rotateZ(0.17); d.rotateY(0.2); }
    const sw = P.fuente.interruptor; sw.rotation.set(0, 0, hw.interruptor ? 0.4 : -0.4); // tecla basculante: hundida por arriba (I) o por abajo (O)
    sw.material.color.set(hw.interruptor ? 0x3fbf6a : 0xe5484d); sw.material.emissive.set(hw.interruptor ? 0x1b7a3c : 0x000000);
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
  async function tender(c, dest, { animado = true, flojo = false } = {}) {
    const pts = c.ruta(dest).map(p => p.clone()); let fin = pts[pts.length - 1];
    if (flojo) fin.y += 0.9; // a medio meter: la clavija no baja hasta el fondo
    c.cordon.visible = false;
    const k = P.placa.k;
    c.tendido = k.tubo(new THREE.CatmullRomCurve3(pts), ASPECTO[c.id].r, ASPECTO[c.id].color, 0.06, 90);
    c.tendido.traverse(o => { o.userData.cable = c.id; });
    const total = c.tendido.geometry.index.count; c.tendido.geometry.setDrawRange(0, 0);
    raiz.add(c.tendido);
    c.clavija.position.copy(fin).add(V(0, ASPECTO[c.id].clavija[1] / 2, 0));
    if (dest === 'vgpu' || dest === 'vplaca') c.clavija.position.copy(fin).add(V(-0.6, 0, 0));
    c.clavija.rotation.set(0, 0, flojo ? 0.22 : 0);
    if (!animado) { c.tendido.geometry.setDrawRange(0, Infinity); c.clavija.scale.setScalar(1); return; }
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
    if (!c) { toque = fase === 'reparar' ? { pieza: piezaEnPunto(ev), x: ev.clientX, y: ev.clientY } : null; return; }
    toque = null;
    if (fase === 'reparar') {
      const no = manoProhibida(estado);
      if (no) { avisar(no, 'peligro'); pintar(); return; }
      if (estado.conex[c.id]) quitar(estado, c.id);
      alSacar(estado, c.id);
    } else if (estado.conex[c.id]) {
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
    if (!arrastre) {
      const c = caso && !estado.terminado ? cableEnPunto(ev) : null;
      const pz = !c && caso && !estado.terminado && fase === 'reparar' && !ev.buttons ? piezaEnPunto(ev) : null;
      etiqueta(ev, c ? CABLES[c.id].nombre : pz ? PIEZAS[pz].nombre : ''); lienzo.style.cursor = c ? 'grab' : pz ? 'pointer' : ''; return;
    }
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
    if (!arrastre) {
      // un toque sin mover el ratón encima de una pieza: se abre lo que se puede hacer con ella
      if (toque && toque.pieza && Math.hypot(ev.clientX - toque.x, ev.clientY - toque.y) < 6 && !estado.terminado) abrirPieza(toque.pieza);
      toque = null; return;
    }
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

  /* ---------- Piezas que se tocan con la mano (solo al reparar) ---------- */
  function piezaEnPunto(ev) {
    rayo(ev);
    const hit = ray.intersectObjects(tocables.map(t => t.obj), true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) { const t = tocables.find(x => x.obj === o); if (t) return t.id; }
    return null;
  }
  function abrirPieza(id) {
    if (id === 'interruptor') { hacer(id, 'conmutar'); return; }
    const def = PIEZAS[id];
    // antes del diagnóstico solo se puede medir; lo demás ni se ofrece
    const acciones = Object.entries(def.acciones).filter(([a]) => estado.diagnostico || a === 'medir');
    if (!acciones.length) { hacer(id, Object.keys(def.acciones)[0]); return; }
    forzar.replaceChildren(h('p', h('b', def.nombre), ': ¿qué haces?'),
      ...acciones.map(([a, texto]) => h('button.am-btn', { type: 'button', onclick: () => { forzar.hidden = true; hacer(id, a); } }, texto)),
      h('button.am-btn', { type: 'button', onclick: () => { forzar.hidden = true; } }, 'Dejarlo como está'));
    forzar.hidden = false; panel.scrollTop = 0;
  }
  function hacer(id, accion) {
    const r = tocar(estado, id, accion);
    if (r.texto) avisar(r.texto, r.ok ? '' : 'peligro');
    if (r.ok && r.cambia) verPiezas();
    pintar();
  }
  // «Cablea y repara»: el equipo ya funciona; se entrega y vuelve con una avería
  function empezarReparacion() {
    notaA = puntuar(estado);
    av = crearAveria(Math.floor(Math.random() * 2147483647), { caso, forzar: new URLSearchParams(location.search).get('averia') });
    estado = estadoAveriado(av, estado.conex);
    fase = 'reparar'; ultimo = null; causaElegida = ''; pasa.textContent = '';
    ambientar(null); sincronizar(); pintar();
    avisar('Unos días después, el equipo vuelve al taller.');
    irA(VISTA.pos, VISTA.obj, 700); panel.scrollTop = 0;
  }
  bSeguir.addEventListener('click', empezarReparacion);
  bEntregar.addEventListener('click', () => { if (estado.enchufado) { apagar(estado); ambientar(null); } entregar(caso, estado); pintar(); });

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
    ultimo = fase === 'reparar' ? encenderBanco(caso, estado) : encender(caso, estado);
    if (ultimo.tipo !== 'bien' && fase !== 'reparar') detalle.push(explica(ultimo) || ultimo.texto);
    ambientar(ultimo);
    const M = V(-50, 34, -44);
    if (ultimo.tipo === 'averia') { burbuja('¡Chasquido!', destinos.eps.clone().add(V(0, 5, 0)), 'peligro'); burbuja('Huele a quemado', V(-46, 14, 0), 'peligro'); }
    else if (ultimo.tipo === 'nada') burbuja('No pasa nada…', V(CAJA.x1 + 1, 14, -15), 'peligro');
    else if (/Sin señal/.test(ultimo.pantalla)) { burbuja('Sin señal', M, 'peligro'); if (ultimo.led) burbuja('LED ' + ultimo.led + ' encendido', ctx.enPlaca(11, 3.4, 7.5), 'peligro'); }
    else if (!ultimo.arranca) { burbuja(ultimo.pantalla, M, 'peligro'); if (ultimo.led) burbuja('LED ' + ultimo.led + ' encendido', ctx.enPlaca(11, 3.4, 7.5), 'peligro'); }
    else if (ultimo.falta === 'calor') burbuja('85 °C y subiendo', M, 'peligro');
    else if (ultimo.falta === 'pila') burbuja('Fecha: 01/01/2020', M, 'peligro');
    else burbuja('¡Hay imagen!', M);
    pasa.textContent = ultimo.texto;
    if (estado.terminado) await esperar(900);
    bEncender.disabled = false;
    pintar();
  }
  bEncender.addEventListener('click', alEncender);
  bNombres.addEventListener('click', () => { verNombres = !verNombres; capaRotulos.hidden = !verNombres; bNombres.setAttribute('aria-pressed', String(verNombres)); for (const r of rotulos) r.ancho = 0; });

  /* ---------- Pantalla grande ---------- */
  // Con la API de pantalla completa si el navegador la tiene; si no (iPhone), la mesa ocupa toda la ventana.
  const enGrande = () => document.fullscreenElement === mesaEl || mesaEl.classList.contains('cb-grande');
  function marcarGrande() {
    const g = enGrande();
    bGrande.setAttribute('aria-pressed', String(g)); bGrande.textContent = g ? 'Salir de pantalla grande' : 'Pantalla grande';
    document.documentElement.classList.toggle('cb-sin-scroll', mesaEl.classList.contains('cb-grande'));
    for (const r of rotulos) r.ancho = 0;
  }
  async function entrarGrande() {
    if (mesaEl.requestFullscreen) { try { await mesaEl.requestFullscreen({ navigationUI: 'hide' }); return; } catch (e) { /* se queda en la ventana */ } }
    mesaEl.classList.add('cb-grande'); marcarGrande();
  }
  function salirGrande() {
    if (document.fullscreenElement === mesaEl) document.exitFullscreen().catch(() => {});
    mesaEl.classList.remove('cb-grande'); marcarGrande();
  }
  bGrande.addEventListener('click', () => (enGrande() ? salirGrande() : entrarGrande()));
  document.addEventListener('fullscreenchange', marcarGrande);
  const alTeclear = ev => {
    if (ev.target.closest && ev.target.closest('input, select, textarea')) return;
    if ((ev.key === 'f' || ev.key === 'F') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); enGrande() ? salirGrande() : entrarGrande(); }
    else if (ev.key === 'Escape' && mesaEl.classList.contains('cb-grande')) salirGrande();
  };
  document.addEventListener('keydown', alTeclear);

  /* ---------- Panel ---------- */
  function pintar() {
    if (!caso) return;
    lista.replaceChildren(...caso.cables.map(id => {
      const d = estado.conex[id];
      // al reparar, la lista no dice qué está puesto y qué no: eso se mira en el equipo
      if (fase === 'reparar') return h('li', h('button', { type: 'button', title: 'Ver dónde está', onclick: () => { const c = cables[id]; irA(c.clavija.position.clone().add(V(14, 26, 22)), c.clavija.position.clone(), 600); } },
        h('i', { style: `background:#${ASPECTO[id].color.toString(16).padStart(6, '0')}` }), h('span', CORTO[id]), h('small', CABLES[id].pista)));
      return h('li' + (d ? '.puesto' : ''), h('button', { type: 'button', title: 'Ver dónde está', onclick: () => { const c = cables[id]; irA(c.clavija.position.clone().add(V(14, 26, 22)), c.clavija.position.clone(), 600); } },
        h('i', { style: `background:#${ASPECTO[id].color.toString(16).padStart(6, '0')}` }), h('span', CORTO[id]), h('small', d ? '→ ' + ETIQUETA[d] : 'suelto')));
    }));
    const libres = caso.cables.filter(c => !estado.conex[c]).length, rep = fase === 'reparar';
    // en «Cablea y repara», al arrancar bien no se acaba: se entrega y sigue
    const sigue = modo === 'completa' && !rep && estado.terminado && ultimo && ultimo.tipo === 'bien';
    tituloPanel.textContent = rep ? 'Parte de avería' : 'Cables';
    parteEl.hidden = !rep; if (rep) pintarParte();
    bEncender.hidden = estado.terminado;
    bEncender.textContent = estado.enchufado ? 'Apagar y desenchufar' : rep ? 'Enchufar y pulsar el botón' : 'Enchufar y encender';
    bEncender.className = 'am-btn' + (estado.enchufado ? '' : ' am-principal');
    bSeguir.hidden = !sigue;
    bEntregar.hidden = !(rep && estado.diagnostico && !estado.terminado);
    if (!rep && !estado.enchufado && !estado.terminado && !pasa.textContent) pasa.textContent = libres ? `Quedan ${libres} cables sueltos. Puede que alguno sobre.` : '';
    if (sigue) pasa.textContent = `Arranca, da imagen y giran todos los ventiladores. Cableado: ${puntuar(estado).nota.toLocaleString('es-ES')} / 10.`;
    if (estado.terminado && !sigue) {
      resultadoEl.replaceChildren(rep ? resultadoReparacion() : resultado());
      // la nota sale debajo de la mesa: en pantalla grande no se vería
      if (enGrande()) { salirGrande(); despues(350, () => resultadoEl.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
    }
  }
  function pintarParte() {
    if (estado.diagnostico) {
      const c = av.causas.find(x => x.id === estado.diagnostico);
      parteEl.replaceChildren(h('p.cb-equipo', av.equipo), h('p.cb-queja', '«' + av.queja + '»'),
        h('p', h('b', 'Tu diagnóstico: '), c.texto + '.'),
        estado.terminado ? null : h('p.cb-ahora', 'Ahora repáralo: con el equipo desenchufado, arregla lo que esté mal. Después enciende y comprueba.'));
      return;
    }
    const sel = h('select', { 'aria-label': 'Causa de la avería', onchange: e => { causaElegida = e.target.value; boton.disabled = !causaElegida; } },
      h('option', { value: '' }, '— Elige la causa —'), ...av.causas.map(c => h('option', { value: c.id }, c.texto)));
    sel.value = causaElegida;
    const boton = h('button.am-btn', { type: 'button', disabled: !causaElegida, onclick: () => { diagnosticar(estado, causaElegida); avisar('Diagnóstico entregado. Ya puedes meter la mano: recuerda cómo tiene que estar el equipo para tocarlo.'); pintar(); } }, 'Entregar el diagnóstico');
    parteEl.replaceChildren(h('p.cb-equipo', av.equipo), h('p.cb-queja', '«' + av.queja + '»'),
      h('p', 'Mira el equipo por todos lados y enciéndelo si te hace falta. Hasta que entregues el diagnóstico no se toca nada.'), sel, boton);
  }
  function resultadoReparacion() {
    const n = puntuarReparacion(av, estado), es = x => x.toLocaleString('es-ES');
    const criticos = [...(notaA ? notaA.criticos : []), ...n.criticos];
    let final = notaA ? Math.round(((notaA.nota + n.nota) / 2) * 10) / 10 : n.nota;
    if (criticos.length) final = Math.min(final, TOPE_CRITICO);
    const buena = av.causas.find(c => c.id === av.id).texto;
    return h('div.tarjeta.av-resultado',
      h('h3', `Resultado: ${es(final)} / 10`),
      criticos.length ? h('p.mensaje.error', h('b', `Fallo crítico: la nota no pasa de ${TOPE_CRITICO}. `), criticos.join(' ')) : null,
      notaA ? h('p', `Cableado: ${es(notaA.nota)} / 10 · Reparación: ${es(n.nota)} / 10. La nota es la media de las dos.`) : null,
      h('ul.av-detalle',
        h('li.' + (n.puntos.causa ? 'ok' : 'ko'), n.puntos.causa ? '✓ Diagnóstico correcto (4 de 4).' : `✗ Diagnóstico equivocado (0 de 4). La causa era: ${buena.charAt(0).toLowerCase() + buena.slice(1)}.`),
        h('li.' + (n.puntos.reparado ? 'ok' : 'ko'), n.puntos.reparado ? (n.sinComprobar ? '✓ El equipo estaba arreglado (4 de 4), pero lo has entregado sin encenderlo para comprobarlo.' : '✓ El equipo arranca y lo has comprobado (4 de 4).') : '✗ El equipo sigue sin funcionar bien (0 de 4).'),
        h('li.' + (n.puntos.limpio === 2 ? 'ok' : 'ko'), n.puntos.limpio === 2 ? '✓ Trabajo limpio: solo has tocado lo necesario (2 de 2).'
          : `✗ Trabajo limpio: ${n.puntos.limpio} de 2.` + (n.sinComprobar ? ' No has comprobado que arranca.' : '') + (n.sobrantes.length ? ` Has tocado sin necesidad: ${n.sobrantes.join(', ')}.` : '') + (n.fallidos ? ` Encendidos de prueba sin arreglarlo: ${n.fallidos}.` : ''))),
      h('p', { html: md(`**La solución:** ${av.fallo.solucion.replace('en ATX12V', 'en CPU_PWR (también llamado ATX12V)')}`) }),
      h('button.btn.azul', { type: 'button', onclick: () => { nuevo(); el.scrollIntoView({ behavior: 'smooth' }); } }, 'Otro equipo'));
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
      document.removeEventListener('fullscreenchange', marcarGrande); document.removeEventListener('keydown', alTeclear);
      if (document.fullscreenElement === mesaEl) document.exitFullscreen().catch(() => {});
      document.documentElement.classList.remove('cb-sin-scroll');
      if (renderer) { renderer.setAnimationLoop(null); renderer.dispose(); }
      if (controles) controles.dispose();
    },
  };
}
