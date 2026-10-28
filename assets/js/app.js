import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { animar, esperar, ease, actualizarAnimaciones, cancelarAnimaciones } from './anim.js';
import { construirPiezas, ORDEN } from './piezas.js';
import { TINTA, SELECCION } from './toon.js';

const $ = s => document.querySelector(s);
const lienzo = $('#lienzo');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
} catch (e) {
  $('#sin3d').hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const escena = new THREE.Scene();
escena.background = new THREE.Color(0xf6eddd);
const camara = new THREE.PerspectiveCamera(36, 1, 0.5, 600);
const VISTA = { pos: new THREE.Vector3(3, 66, 72), obj: new THREE.Vector3(1, 0, 2) };
camara.position.copy(VISTA.pos);
const controles = new OrbitControls(camara, lienzo);
controles.target.copy(VISTA.obj);
controles.enableDamping = true;
controles.maxPolarAngle = 1.32;
controles.minDistance = 16;
controles.maxDistance = 140;
controles.update();

escena.add(new THREE.AmbientLight(0xffffff, 1.15));
const sol = new THREE.DirectionalLight(0xfff4e0, 2.3);
sol.position.set(-22, 46, 28);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -55, right: 55, top: 45, bottom: -45, near: 1, far: 140 });
sol.shadow.bias = -0.0006;
escena.add(sol);
const luzChispa = new THREE.PointLight(0xffc23a, 0, 40);
escena.add(luzChispa);

// Mesa: solo recibe sombra, el color es el del fondo
const mesa = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ opacity: 0.13 }));
mesa.rotation.x = -Math.PI / 2; mesa.position.y = -0.6; mesa.receiveShadow = true;
escena.add(mesa);

function alfombrilla() {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(80, 0.6, 52);
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: 0x9cc3e6 }));
  m.receiveShadow = true; m.castShadow = true; m.position.y = -0.3;
  const borde = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide }));
  borde.scale.set(80.3 / 80, 0.9 / 0.6, 52.3 / 52);
  m.add(borde);
  g.add(m);
  // cuadrícula suave de la alfombrilla
  const lineas = new THREE.GridHelper(78, 26, 0x86b0d6, 0x86b0d6);
  lineas.scale.z = 50 / 78; lineas.position.y = 0.01;
  g.add(lineas);
  return g;
}
escena.add(alfombrilla());

/* ---------------- Estado ---------------- */
let raiz = null, P = {}, hecho = new Set(), ocupado = false, seleccion = null, encima = null, encendido = false;
const particulas = [];
const burbujas = [];

const ctx = {
  get placa() { return P.placa; },
  enfocar: (p, ms = 750) => enfocar(p, ms),
  burbuja: (t, p, tipo) => burbuja(t, p, tipo),
  chispas: p => chispas(p),
};

function construir() {
  cancelarAnimaciones();
  if (raiz) {
    escena.remove(raiz);
    raiz.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  particulas.splice(0).forEach(q => escena.remove(q.m));
  raiz = new THREE.Group();
  escena.add(raiz);
  P = construirPiezas();
  for (const p of Object.values(P)) raiz.add(p.grupo);
  hecho = new Set(); ocupado = false; seleccion = null; encima = null; encendido = false;
  cerrarFicha();
  pintarPasos();
  irA(VISTA.pos, VISTA.obj, 1);
  // Entrada: las piezas caen con rebote
  const lista = ['placa', ...ORDEN];
  lista.forEach((id, i) => {
    const p = P[id];
    p.salto = 16;
    esperar(120 + i * 90).then(() => animar(750, t => { p.salto = 16 * (1 - t); }, ease.rebote));
  });
}

/* ---------------- Cámara ---------------- */
function enfocar(punto, ms) {
  const t0 = controles.target.clone(), c0 = camara.position.clone();
  const delta = punto.clone().sub(t0);
  return animar(ms, t => {
    controles.target.copy(t0).addScaledVector(delta, t);
    camara.position.copy(c0).addScaledVector(delta, t);
  });
}
function irA(pos, obj, ms = 900) {
  const t0 = controles.target.clone(), c0 = camara.position.clone();
  return animar(ms, t => {
    controles.target.lerpVectors(t0, obj, t);
    camara.position.lerpVectors(c0, pos, t);
  });
}

/* ---------------- Efectos ---------------- */
const capa = $('#burbujas');
function burbuja(texto, pos, tipo = '') {
  const el = document.createElement('div');
  el.className = 'burbuja ' + tipo;
  el.innerHTML = `<span></span>`;
  el.firstChild.textContent = texto;
  capa.append(el);
  const b = { el, pos: pos.clone() };
  burbujas.push(b);
  setTimeout(() => { el.remove(); burbujas.splice(burbujas.indexOf(b), 1); }, 1900);
}

const geoChispa = new THREE.OctahedronGeometry(0.35);
const matChispa = [0xffd23f, 0xff8a3d, 0xffffff].map(c => new THREE.MeshBasicMaterial({ color: c }));
function chispas(pos) {
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(geoChispa, matChispa[i % 3]);
    m.position.copy(pos);
    escena.add(m);
    particulas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 22, Math.random() * 16 + 5, (Math.random() - 0.5) * 22), vida: 0.6 + Math.random() * 0.5, g: 34, giro: 10 });
  }
  luzChispa.position.copy(pos).add(new THREE.Vector3(0, 2, 0));
  animar(700, t => { luzChispa.intensity = 900 * (1 - t); }, ease.salida);
  const d = $('#destello');
  d.classList.remove('activo'); void d.offsetWidth; d.classList.add('activo');
  burbuja('¡CHISPAZO!', pos.clone().add(new THREE.Vector3(0, 4, 0)), 'peligro');
}

const geoConfeti = new THREE.PlaneGeometry(0.9, 0.5);
const colConfeti = [0xff6a3d, 0xffd23f, 0x4a86e8, 0x3fbf6a, 0x8b6fe0, 0xe5484d].map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
function confeti() {
  for (let i = 0; i < 170; i++) {
    const m = new THREE.Mesh(geoConfeti, colConfeti[i % colConfeti.length]);
    m.position.set((Math.random() - 0.5) * 50, 26 + Math.random() * 14, (Math.random() - 0.5) * 34);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    escena.add(m);
    particulas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, -Math.random() * 4, (Math.random() - 0.5) * 6), vida: 4 + Math.random() * 2, g: 5, giro: 5, freno: true });
  }
}

/* ---------------- Interfaz ---------------- */
const ficha = $('#ficha'), btnAccion = $('#ficha .accion'), aviso = $('#aviso'), tooltip = $('#tooltip');

function pintarPasos() {
  const ol = $('#pasos');
  ol.innerHTML = '';
  ORDEN.forEach((id, i) => {
    const p = P[id];
    const li = document.createElement('li');
    const listo = hecho.has(id);
    const puede = p.requiere.every(r => hecho.has(r));
    li.className = listo ? 'hecho' : puede ? 'disponible' : 'bloqueado';
    li.innerHTML = `<button type="button"><span class="num">${listo ? '✓' : i + 1}</span><span class="txt"></span></button>`;
    li.querySelector('.txt').textContent = p.nombre;
    li.querySelector('button').addEventListener('click', () => { seleccionar(p); enfocar(p.foco ? p.foco() : p.grupo.position.clone(), 700); });
    ol.append(li);
  });
  const n = hecho.size;
  $('#progreso').style.width = (n / ORDEN.length) * 100 + '%';
  $('#cuenta').textContent = `${n} de ${ORDEN.length}`;
}

function tintar(p, color) { p.tintas.forEach(t => t.color.set(color)); }

function seleccionar(p) {
  if (seleccion && seleccion !== p) tintar(seleccion, TINTA);
  seleccion = p;
  tintar(p, SELECCION);
  $('#pista').classList.add('oculta');
  animar(440, t => { p.salto = Math.sin(Math.PI * t) * (p.montado || p.id === 'placa' ? 0.3 : 1.4); }, ease.lineal);
  mostrarFicha();
}

function mostrarFicha() {
  const p = seleccion;
  if (!p) return;
  ficha.hidden = false;
  $('#ficha h2').textContent = p.nombre;
  $('#ficha p').textContent = p.texto;
  const falta = p.requiere.filter(r => !hecho.has(r)).map(r => P[r].nombre);
  const req = $('#ficha .requiere');
  req.hidden = !(falta.length && !p.montado);
  req.textContent = falta.length ? 'Antes: ' + falta.join(', ') : '';
  if (!p.accion) { btnAccion.hidden = true; return; }
  btnAccion.hidden = false;
  btnAccion.disabled = ocupado || p.montado;
  btnAccion.textContent = p.montado ? '✓ Hecho' : p.accion;
}
function cerrarFicha() {
  if (seleccion) tintar(seleccion, TINTA);
  seleccion = null;
  ficha.hidden = true;
}

let temporizadorAviso;
function avisar(texto, tipo = '') {
  aviso.textContent = texto;
  aviso.className = 'aviso visible ' + tipo;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.className = 'aviso'; }, 4200);
}

async function sacudir(p) {
  await animar(480, (_, t) => { p.cuerpo.position.x = Math.sin(t * Math.PI * 7) * 0.5 * (1 - t); }, ease.lineal);
  p.cuerpo.position.x = 0;
}

async function intentar(p) {
  if (ocupado || p.montado || !p.montar) return;
  const falta = p.requiere.filter(r => !hecho.has(r));
  if (falta.length) {
    if (p.id === 'enchufe') {
      ocupado = true; mostrarFicha();
      avisar('¡Peligro! Nunca se enchufa el equipo mientras se monta. Primero termina todo el montaje.', 'peligro');
      await p.fallo(ctx);
      ocupado = false; mostrarFicha();
      return;
    }
    sacudir(p);
    if (falta.includes('pulsera')) avisar('Primero la pulsera antiestática: la electricidad estática de tu cuerpo puede estropear los componentes.', 'cuidado');
    else avisar('Todavía no. Antes: ' + falta.map(r => P[r].nombre).join(', ') + '.', 'cuidado');
    return;
  }
  ocupado = true; mostrarFicha();
  tintar(p, TINTA);
  p.hover = 0;
  try { await p.montar(ctx); } finally { ocupado = false; }
  p.montado = true;
  hecho.add(p.id);
  pintarPasos();
  if (seleccion === p) tintar(p, SELECCION);
  mostrarFicha();
  if (p.id === 'enchufe') encender();
}

async function encender() {
  encendido = true;
  const B = P.placa;
  B.led.material.color.set(0x3fbf6a); B.led.material.emissive.set(0x2fbf5a);
  P.disipador.velocidad = 22; P.fuente.velocidad = 14;
  burbuja('¡Encendido!', new THREE.Vector3(12, 3, 10.5));
  await irA(new THREE.Vector3(10, 44, 52), new THREE.Vector3(0, 2, -2), 1200);
  confeti();
  await esperar(1400);
  cerrarFicha();
  $('#final').showModal();
}

/* ---------------- Ratón ---------------- */
const ray = new THREE.Raycaster(), raton = new THREE.Vector2();
function piezaEn(ev) {
  const r = lienzo.getBoundingClientRect();
  raton.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(raton, camara);
  for (const h of ray.intersectObjects(raiz.children, true)) {
    let o = h.object;
    if (!o.visible) continue;
    while (o && !o.userData.id) o = o.parent;
    if (o) return P[o.userData.id];
  }
  return null;
}

let abajo = null;
lienzo.addEventListener('pointerdown', ev => { abajo = { x: ev.clientX, y: ev.clientY }; });
lienzo.addEventListener('pointerup', ev => {
  if (!abajo || Math.hypot(ev.clientX - abajo.x, ev.clientY - abajo.y) > 6) { abajo = null; return; }
  abajo = null;
  const p = piezaEn(ev);
  if (p) seleccionar(p); else cerrarFicha();
});
lienzo.addEventListener('dblclick', ev => { const p = piezaEn(ev); if (p) intentar(p); });
lienzo.addEventListener('pointermove', ev => {
  if (ev.pointerType !== 'mouse') return;
  const p = piezaEn(ev);
  encima = p;
  lienzo.style.cursor = p ? 'pointer' : 'grab';
  if (p) {
    tooltip.textContent = p.nombre + (p.montado ? ' ✓' : '');
    tooltip.style.transform = `translate(${ev.offsetX + 16}px, ${ev.offsetY + 14}px)`;
    tooltip.classList.add('visible');
  } else tooltip.classList.remove('visible');
});
lienzo.addEventListener('pointerleave', () => { encima = null; tooltip.classList.remove('visible'); });

btnAccion.addEventListener('click', () => seleccion && intentar(seleccion));
$('#ficha .cerrar').addEventListener('click', cerrarFicha);
$('#vista').addEventListener('click', () => irA(VISTA.pos, VISTA.obj));
$('#reiniciar').addEventListener('click', construir);
$('#final .otra').addEventListener('click', () => { $('#final').close(); construir(); });
$('#final .seguir').addEventListener('click', () => $('#final').close());
addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrarFicha(); });

/* ---------------- Bucle ---------------- */
function ajustar() {
  const r = lienzo.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  // Centra la mesa en el hueco que deja libre el panel de pasos
  const panel = r.width > 760 ? 292 : 0;
  camara.aspect = (r.width + panel) / r.height;
  camara.fov = r.width < r.height ? 58 : 36;
  if (panel) camara.setViewOffset(r.width + panel, r.height, panel, 0, r.width, r.height);
  else camara.clearViewOffset();
  camara.updateProjectionMatrix();
}
new ResizeObserver(ajustar).observe(lienzo.parentElement);
ajustar();

const reloj = new THREE.Clock();
const proy = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 0.05);
  actualizarAnimaciones(performance.now());
  for (const p of Object.values(P)) {
    const meta = p === encima && !p.montado && !ocupado && p.accion ? 0.5 : 0;
    p.hover += (meta - p.hover) * Math.min(1, dt * 12);
    p.cuerpo.position.y = p.hover + p.salto;
    if (p.actualizarCordon) p.actualizarCordon();
  }
  for (const id of ['disipador', 'fuente']) {
    const p = P[id];
    if (!p) continue;
    if (!encendido) p.velocidad *= Math.pow(0.35, dt);
    if (id === 'disipador') p.rotor.rotation.x += p.velocidad * dt; else p.rotor.rotation.y += p.velocidad * dt;
  }
  if (encendido) P.ram.luz.material.color.setHSL((performance.now() / 2500) % 1, 0.85, 0.6);
  if (encendido) P.ram.luz.material.emissive.copy(P.ram.luz.material.color).multiplyScalar(0.5);
  for (let i = particulas.length - 1; i >= 0; i--) {
    const q = particulas[i];
    q.v.y -= q.g * dt;
    if (q.freno) { q.v.multiplyScalar(Math.pow(0.6, dt)); }
    q.m.position.addScaledVector(q.v, dt);
    q.m.rotation.x += q.giro * dt; q.m.rotation.y += q.giro * 0.7 * dt;
    q.vida -= dt;
    if (q.vida < 0.4) q.m.scale.setScalar(Math.max(0.001, q.vida / 0.4));
    if (q.vida <= 0 || q.m.position.y < -1) { escena.remove(q.m); particulas.splice(i, 1); }
  }
  controles.update();
  renderer.render(escena, camara);
  const w = lienzo.clientWidth, h = lienzo.clientHeight;
  for (const b of burbujas) {
    proy.copy(b.pos).project(camara);
    b.el.style.transform = `translate(${((proy.x + 1) / 2) * w}px, ${((1 - proy.y) / 2) * h}px)`;
  }
});

construir();
