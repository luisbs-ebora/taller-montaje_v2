// Piezas del prototipo y su animación de montaje. Medidas en centímetros.
import * as THREE from 'three';
import { kit, nuevaTinta, cambiarGeometria } from './toon.js';
import { animar, esperar, ease } from './anim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const E = (x, y, z) => new THREE.Euler(x, y, z);

const C = {
  pcb: 0x2f9a7e, ranura: 0x37405a, metal: 0xc9d0da, metalOscuro: 0x8592a6, oro: 0xf2c14e,
  cobre: 0xe39a5b, naranja: 0xff6a3d, azul: 0x4a86e8, crema: 0xf7f1e3, negro: 0x2e3340,
  rojo: 0xe5484d, verde: 0x3fbf6a, amarillo: 0xffd23f, lila: 0x8b6fe0, cable: 0x454b62,
};

function nuevaPieza(id, datos) {
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  grupo.userData.id = id;
  const tinta = nuevaTinta();
  const tintas = [tinta];
  return { id, grupo, cuerpo, tintas, k: kit(tinta, tintas), hover: 0, salto: 0, montado: false, requiere: [], ...datos };
}

function poner(padre, malla, x, y, z) { malla.position.set(x, y, z); padre.add(malla); return malla; }

// Zona invisible para que las piezas pequeñas sean fáciles de pulsar
const matZona = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
function zona(padre, w, h, d, x, y, z) { return poner(padre, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matZona), x, y, z); }

// Vuela en arco hasta destino, girando a la vez.
async function volar(obj, destino, { rot = null, altura = 8, ms = 900 } = {}) {
  const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
  const q1 = rot ? new THREE.Quaternion().setFromEuler(rot) : q0.clone();
  await animar(ms, t => {
    obj.position.lerpVectors(p0, destino, t);
    obj.position.y += Math.sin(Math.PI * t) * altura;
    obj.quaternion.slerpQuaternions(q0, q1, t);
  });
}

async function bajarA(obj, y, ms = 450, e = ease.salida) {
  const y0 = obj.position.y;
  await animar(ms, t => { obj.position.y = y0 + (y - y0) * t; }, e);
}

async function aparecer(obj, ms = 320) {
  obj.visible = true;
  await animar(ms, t => obj.scale.setScalar(Math.max(0.001, t)), ease.muelle);
}

// Cable que "crece" desde la fuente hasta su conector.
function cableCreciente(k, puntos, r, color) {
  const malla = k.tubo(new THREE.CatmullRomCurve3(puntos), r, color, 0.07, 90);
  malla.geometry.setDrawRange(0, 0);
  return malla;
}
const crecer = (malla, ms) => {
  const total = malla.geometry.index.count, paso = 60;
  return animar(ms, t => malla.geometry.setDrawRange(0, Math.floor((t * total) / paso) * paso), ease.lineal);
};

// Cordón entre dos puntos (se recalcula cuando se mueve un extremo).
function curvaCordon(a, b, { comba = 1.2, rizo = 0 } = {}) {
  const pts = [];
  const n = rizo ? 28 : 8;
  const dir = b.clone().sub(a);
  const lado = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y += Math.sin(Math.PI * t) * comba;
    if (rizo && i > 0 && i < n) p.addScaledVector(lado, Math.sin(i * 1.9) * rizo);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

/* ---------------- PLACA BASE ---------------- */
function placa() {
  const P = nuevaPieza('placa', {
    nombre: 'Placa base',
    texto: 'La pieza central: une el procesador, la memoria, el almacenamiento y la fuente. Todo lo demás se conecta a ella.',
    foco: () => V(0, 0, 0),
  });
  const { k } = P, c = P.cuerpo;
  poner(c, k.caja(30.5, 0.25, 24.4, C.pcb, 0.09), 0, 0.125, 0);
  for (const [x, z] of [[-14, -11.4], [14, -11.4], [-14, 11.4], [14, 11.4], [0, -11.4], [0, 11.4]])
    poner(c, k.cil(0.35, 0.06, C.metal, 0.03, 16), x, 0.28, z);

  // Zócalo del procesador
  poner(c, k.caja(5.2, 0.35, 5.6, 0xe9e2d0, 0.05), -3, 0.425, -4);
  poner(c, k.caja(4.0, 0.04, 4.6, 0xb9b09c, 0), -3, 0.62, -4);
  poner(c, k.cil(0.3, 0.04, C.oro, 0.02, 3), -5.15, 0.62, -1.55);
  const marco = new THREE.Group(); marco.position.set(-5.5, 0.82, -4); c.add(marco);
  const barra = (w, d, x, z) => poner(marco, k.caja(w, 0.1, d, C.metal, 0.04), x, 0, z);
  barra(5, 0.9, 2.5, -2.25); barra(5, 0.9, 2.5, 2.25); barra(0.9, 3.6, 0.45, 0); barra(0.9, 3.6, 4.55, 0);
  const palanca = new THREE.Group(); palanca.position.set(-0.1, 0.72, -1.1); c.add(palanca);
  const vara = k.cil(0.13, 5.8, C.metal, 0.04, 10); vara.rotation.x = Math.PI / 2; vara.position.z = -2.9; palanca.add(vara);
  const mango = k.cil(0.2, 0.9, C.metal, 0.04, 10); mango.rotation.z = Math.PI / 2; mango.position.set(0.45, 0, -5.8); palanca.add(mango);

  // Disipadores de los VRM y panel trasero
  poner(c, k.caja(8, 1.2, 1.4, C.metalOscuro), -4, 0.85, -9.4);
  poner(c, k.caja(1.4, 1.2, 7, C.metalOscuro), -8.6, 0.85, -3.5);
  poner(c, k.caja(2.5, 2.6, 16, 0x5b6b82, 0.07), -14, 1.55, -3);

  // Ranuras de RAM con pestañas
  const pestanas = [];
  for (const x of [6.0, 7.4]) {
    poner(c, k.caja(0.6, 0.7, 13.3, C.ranura, 0.05), x, 0.6, -3);
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(x, 0.25, -3 + s * 6.85); c.add(piv);
      poner(piv, k.caja(0.62, 0.95, 0.32, C.crema, 0.04), 0, 0.48, 0);
      if (x === 6.0) pestanas.push({ piv, s });
    }
  }

  // Conectores de alimentación, M.2, PCIe, chipset
  poner(c, k.caja(1.3, 1.4, 5.2, C.negro), 13.6, 0.95, -1);
  poner(c, k.caja(2.2, 1.2, 1.0, C.negro), -11.5, 0.85, -11.2);
  poner(c, k.caja(0.8, 0.5, 2.4, C.negro, 0.04), -9.4, 0.5, 4.5);
  poner(c, k.cil(0.28, 0.3, C.oro, 0.03, 12), -1.7, 0.4, 4.5);
  poner(c, k.caja(9, 0.9, 0.8, C.ranura), -6, 0.7, 9.2);
  poner(c, k.caja(4, 0.8, 4, C.metalOscuro), 4.5, 0.65, 8.2);
  poner(c, k.caja(4.02, 0.12, 0.7, C.naranja, 0), 4.5, 1.1, 8.2);
  poner(c, k.cil(1.0, 0.2, C.metal, 0.04, 24), 8.5, 0.35, 4);
  for (let i = 0; i < 4; i++) poner(c, k.cil(0.4, 1.0, C.lila, 0.04, 14), 10.8, 0.75, -9 + i * 1.1);
  const led = poner(c, k.caja(0.6, 0.25, 0.35, 0x3a3f4b, 0.03, { propio: true }), 12, 0.38, 10.5);

  Object.assign(P, { marco, palanca, pestanas, led });
  return P;
}

/* ---------------- PULSERA ANTIESTÁTICA ---------------- */
function pulsera() {
  const P = nuevaPieza('pulsera', {
    nombre: 'Pulsera antiestática',
    texto: 'Descarga a tierra la electricidad estática de tu cuerpo. Se pone siempre lo primero, antes de tocar ningún componente.',
    accion: 'Conectar a tierra',
    foco: () => V(-29, 0, 10),
  });
  const { k } = P, c = P.cuerpo;
  const banda = k.toro(2.0, 0.55, C.azul); banda.rotation.x = Math.PI / 2; poner(c, banda, -28, 0.55, 14);
  poner(c, k.cil(0.45, 0.5, C.metal, 0.04, 16), -25.9, 0.6, 14);
  zona(c, 6, 2, 6, -28, 0.8, 14);
  const pinza = new THREE.Group(); pinza.position.set(-22.5, 0.35, 20); pinza.rotation.y = 0.6; c.add(pinza);
  const mand1 = poner(pinza, k.caja(2.0, 0.3, 0.8, C.rojo, 0.04), 0, 0, 0);
  const mand2 = poner(pinza, k.caja(2.0, 0.3, 0.8, C.rojo, 0.04), 0, 0.45, 0);
  mand2.rotation.z = 0.35;
  zona(pinza, 3.5, 2, 2.5, 0, 0.3, 0);

  // Punto de tierra en la alfombrilla
  poner(c, k.cil(1.0, 0.3, C.metalOscuro, 0.05, 20), -34, 0.15, 5);
  poner(c, k.cil(0.3, 1.3, C.metal, 0.04, 12), -34, 0.95, 5);
  const luz = poner(c, k.esfera(0.32, 0x5a5f6b, 0.04, { propio: true }), -32.6, 0.32, 5);

  const cordon = k.tubo(curvaCordon(V(-25.9, 0.6, 14), V(-22.5, 0.4, 20), { rizo: 0.35 }), 0.12, C.amarillo, 0.05, 60);
  P.grupo.add(cordon);
  const a = V(-25.9, 0.6, 14), ult = new THREE.Vector3(Infinity, 0, 0), tmp = new THREE.Vector3();
  P.actualizarCordon = () => {
    pinza.getWorldPosition(tmp);
    if (tmp.distanceToSquared(ult) < 1e-4) return;
    ult.copy(tmp);
    const ini = a.clone(); ini.y += P.cuerpo.position.y;
    cambiarGeometria(cordon, new THREE.TubeGeometry(curvaCordon(ini, tmp, { rizo: 0.35, comba: 0.8 }), 60, 0.12, 6, false));
  };

  P.montar = async ctx => {
    ctx.enfocar(V(-30, 0, 9));
    await volar(pinza, V(-34, 1.35, 5.9), { rot: E(0, Math.PI / 2, 0), altura: 5, ms: 900 });
    await animar(220, t => { mand2.rotation.z = 0.35 * (1 - t); }, ease.salida);
    luz.material.color.set(C.verde); luz.material.emissive.set(0x1f9e4a);
    ctx.burbuja('¡Conectado a tierra!', V(-34, 3, 5));
  };
  return P;
}

/* ---------------- PROCESADOR ---------------- */
function cpu() {
  const P = nuevaPieza('cpu', {
    nombre: 'Procesador (CPU)',
    texto: 'El cerebro del ordenador. Fíjate en el triángulo dorado de una esquina: tiene que coincidir con el del zócalo. Nunca se fuerza.',
    accion: 'Colocar en el zócalo',
    requiere: ['pulsera'],
  });
  const { k } = P, c = P.cuerpo;
  poner(c, k.caja(3.8, 0.15, 4.4, 0x2c8a4a, 0.04), 0, 0.075, 0);
  poner(c, k.caja(3.0, 0.25, 3.4, C.metal, 0.04), 0, 0.275, 0);
  poner(c, k.cil(0.28, 0.02, C.oro, 0, 3), -1.6, 0.16, 1.9);
  poner(c, k.caja(1.4, 0.02, 0.5, C.naranja, 0), 0, 0.41, 0.6);
  P.grupo.position.set(-14, 0, 18.5); P.grupo.rotation.y = 0.7;
  P.foco = () => P.grupo.position.clone();

  P.montar = async ctx => {
    const B = ctx.placa;
    ctx.enfocar(V(-3, 0, -4));
    await animar(350, t => { B.palanca.rotation.x = 1.2 * t; }, ease.salida);
    await animar(450, t => { B.marco.rotation.z = 2.0 * t; }, ease.salida);
    await volar(P.grupo, V(-3, 3.6, -4), { rot: E(0, 0, 0), altura: 8, ms: 950 });
    ctx.burbuja('Triángulo con triángulo', V(-5.2, 2.2, -1.6));
    await bajarA(P.grupo, 0.6, 520);
    await animar(420, t => { B.marco.rotation.z = 2.0 * (1 - t); }, ease.rebote);
    await animar(320, t => { B.palanca.rotation.x = 1.2 * (1 - t); }, ease.salida);
    ctx.burbuja('¡clac!', V(0.3, 2, -6.5));
  };
  return P;
}

/* ---------------- PASTA TÉRMICA ---------------- */
function pasta() {
  const P = nuevaPieza('pasta', {
    nombre: 'Pasta térmica',
    texto: 'Rellena los huecos microscópicos entre el procesador y el disipador para que el calor pase bien. Basta una gota del tamaño de un guisante.',
    accion: 'Poner una gota',
    requiere: ['cpu'],
  });
  const { k } = P, c = P.cuerpo;
  const cuerpoJ = k.cil(0.5, 4, C.crema, 0.05, 16); cuerpoJ.rotation.z = Math.PI / 2; poner(c, cuerpoJ, 0, 0, 0);
  const banda = k.cil(0.52, 1.2, C.naranja, 0.0, 16); banda.rotation.z = Math.PI / 2; poner(c, banda, -0.4, 0, 0);
  const punta = k.cono(0.12, 0.5, 1.0, C.metalOscuro, 0.04, 12); punta.rotation.z = -Math.PI / 2; poner(c, punta, 2.5, 0, 0);
  const embolo = k.cil(0.7, 0.2, C.negro, 0.04, 16); embolo.rotation.z = Math.PI / 2; poner(c, embolo, -2.2, 0, 0);
  zona(c, 6, 2, 2, 0, 0, 0);
  P.grupo.position.set(-7, 0.55, 20); P.grupo.rotation.y = -0.3;
  const reposo = { p: P.grupo.position.clone(), r: P.grupo.rotation.clone() };
  P.foco = () => P.grupo.position.clone();

  P.montar = async ctx => {
    ctx.enfocar(V(-3, 0, -4));
    // La punta queda encima del centro del procesador
    await volar(P.grupo, V(-3, 5.6, -4), { rot: E(0, 0, -Math.PI / 2), altura: 7, ms: 900 });
    await bajarA(P.grupo, 4.35, 300);
    const gota = ctx.placa.gota;
    await animar(650, t => gota.scale.set(0.8 * t + 0.001, 0.35 * t + 0.001, 0.8 * t + 0.001), ease.salida);
    ctx.burbuja('Como un guisante', V(-3, 3, -4));
    await bajarA(P.grupo, 6, 250);
    await volar(P.grupo, reposo.p, { rot: reposo.r, altura: 6, ms: 800 });
  };
  return P;
}

/* ---------------- DISIPADOR ---------------- */
function disipador() {
  const P = nuevaPieza('disipador', {
    nombre: 'Disipador con ventilador',
    texto: 'Saca el calor del procesador. Sin él, el procesador se apaga por temperatura en pocos segundos. Va atornillado a la placa.',
    accion: 'Montar y atornillar',
    requiere: ['pasta'],
  });
  const { k } = P, c = P.cuerpo;
  poner(c, k.caja(4, 0.5, 4, C.cobre, 0.05), 0, 0.25, 0);
  for (const x of [-1.2, -0.4, 0.4, 1.2]) poner(c, k.cil(0.22, 9, C.cobre, 0.04, 10), 0, 5, x * 2.5);
  for (let i = 0; i < 13; i++) poner(c, k.caja(4.5, 0.14, 11, C.metal, 0.035), 0, 2.2 + i * 0.75, 0);
  poner(c, k.caja(4.8, 0.5, 11.3, C.negro, 0.06), 0, 11.6, 0);
  poner(c, k.caja(1.0, 0.04, 11.32, C.naranja, 0), 0, 11.87, 0);
  // Ventilador
  for (const [w, h, d, y, z] of [[1, 0.9, 10.5, 2.2, 0], [1, 0.9, 10.5, 11.8, 0], [1, 10.5, 0.9, 7, -4.8], [1, 10.5, 0.9, 7, 4.8]])
    poner(c, k.caja(w, h, d, C.negro, 0.05), 2.75, y, z);
  const rotor = new THREE.Group(); rotor.position.set(2.75, 7, 0); c.add(rotor);
  const buje = k.cil(1.3, 0.9, C.negro, 0.05, 20); buje.rotation.z = Math.PI / 2; rotor.add(buje);
  for (let i = 0; i < 7; i++) {
    const brazo = new THREE.Group(); brazo.rotation.x = (i / 7) * Math.PI * 2; rotor.add(brazo);
    const pala = poner(brazo, k.caja(0.15, 3.3, 1.9, C.naranja, 0.04), 0, 2.9, 0); pala.rotation.y = 0.45;
  }
  // Barra de anclaje y tornillos
  poner(c, k.caja(0.8, 0.25, 7.6, C.metalOscuro, 0.04), 0, 0.4, 0);
  const tornillos = [-3.5, 3.5].map(z => {
    const t = new THREE.Group(); t.position.set(0, 1.7, z); c.add(t);
    poner(t, k.cil(0.4, 0.2, C.metal, 0.04, 12), 0, 0.5, 0);
    poner(t, k.cil(0.18, 0.9, C.metal, 0.03, 8), 0, 0, 0);
    return t;
  });
  P.grupo.position.set(-27, 0, -16); P.grupo.rotation.y = Math.PI / 2;
  P.foco = () => P.grupo.position.clone();
  Object.assign(P, { rotor, velocidad: 0 });

  P.montar = async ctx => {
    ctx.enfocar(V(-3, 3, -4));
    await volar(P.grupo, V(-3, 7, -4), { rot: E(0, 0, 0), altura: 6, ms: 1000 });
    const gota = ctx.placa.gota, s0 = gota.scale.clone();
    await animar(550, t => {
      P.grupo.position.y = 7 + (1.05 - 7) * t;
      if (t > 0.85) { const u = (t - 0.85) / 0.15; gota.scale.set(s0.x + 0.75 * u, s0.y * (1 - 0.85 * u), s0.z + 0.75 * u); }
    }, ease.salida);
    ctx.burbuja('La pasta se reparte', V(-3, 2.5, 1));
    for (const t of tornillos) {
      await animar(380, u => { t.position.y = 1.7 - 1.1 * u; t.rotation.y = u * Math.PI * 4; }, ease.salida);
    }
    ctx.burbuja('¡Atornillado!', V(-3, 13, -4));
    P.velocidad = 18;
  };
  return P;
}

/* ---------------- MEMORIA RAM ---------------- */
function ram() {
  const P = nuevaPieza('ram', {
    nombre: 'Memoria RAM',
    texto: 'Guarda los datos con los que está trabajando el procesador. Tiene una muesca que solo encaja en una posición. Se empuja hasta oír «clic».',
    accion: 'Insertar en la ranura',
    requiere: ['pulsera'],
  });
  const { k } = P, c = P.cuerpo;
  poner(c, k.caja(13.3, 3.1, 0.12, 0x2c8a4a, 0.035), 0, 1.55, 0);
  poner(c, k.caja(12.6, 0.45, 0.14, C.oro, 0.02), 0, 0.225, 0);
  poner(c, k.caja(13.0, 2.3, 0.34, C.rojo, 0.05), 0, 1.85, 0);
  poner(c, k.caja(4.5, 0.35, 0.36, C.crema, 0), -2.8, 2.2, 0);
  const luz = poner(c, k.caja(12.8, 0.35, 0.3, 0xf2f2f2, 0.04, { propio: true }), 0, 3.25, 0);
  P.grupo.position.set(14, 0.17, 20.5); P.grupo.rotation.set(-Math.PI / 2, 0, 0);
  P.foco = () => P.grupo.position.clone();
  P.luz = luz;

  P.montar = async ctx => {
    const B = ctx.placa;
    ctx.enfocar(V(6.5, 2, -3));
    await animar(300, t => B.pestanas.forEach(({ piv, s }) => { piv.rotation.x = s * 0.6 * t; }), ease.salida);
    await volar(P.grupo, V(6.0, 6.5, -3), { rot: E(0, Math.PI / 2, 0), altura: 6, ms: 1000 });
    await bajarA(P.grupo, 0.55, 450, ease.suave);
    await animar(260, t => B.pestanas.forEach(({ piv, s }) => { piv.rotation.x = s * 0.6 * (1 - t); }), ease.rebote);
    ctx.burbuja('¡clic!', V(6, 2.5, -9.9));
    ctx.burbuja('¡clic!', V(6, 2.5, 3.9));
  };
  return P;
}

/* ---------------- SSD M.2 ---------------- */
function ssd() {
  const P = nuevaPieza('ssd', {
    nombre: 'SSD M.2',
    texto: 'Aquí se guardan el sistema operativo y tus archivos. Entra en diagonal en su ranura, se baja y se fija con un tornillo.',
    accion: 'Insertar y atornillar',
    requiere: ['pulsera'],
  });
  const { k } = P, c = P.cuerpo;
  poner(c, k.caja(8, 0.12, 2.2, 0x2b3a67, 0.035), 4, 0.06, 0);
  poner(c, k.caja(0.5, 0.13, 2.0, C.oro, 0.02), 0.25, 0.06, 0);
  poner(c, k.caja(2.0, 0.12, 1.6, C.negro, 0.025), 2.2, 0.18, 0);
  poner(c, k.caja(2.0, 0.12, 1.6, C.negro, 0.025), 5.0, 0.18, 0);
  poner(c, k.caja(4.6, 0.03, 1.7, C.amarillo, 0), 3.6, 0.26, 0);
  const tornillo = new THREE.Group(); tornillo.position.set(7.8, 2.4, 0); tornillo.visible = false; c.add(tornillo);
  poner(tornillo, k.cil(0.35, 0.18, C.metal, 0.035, 12), 0, 0.12, 0);
  P.grupo.position.set(24, 0, 18); P.grupo.rotation.y = -0.5;
  P.foco = () => P.grupo.position.clone();

  P.montar = async ctx => {
    ctx.enfocar(V(-5.5, 0, 4.5));
    await volar(P.grupo, V(-7.0, 0.6, 4.5), { rot: E(0, 0, 0.35), altura: 7, ms: 950 });
    await animar(450, t => { P.grupo.position.x = -7.0 - 2.5 * t; P.grupo.position.y = 0.6 - 0.16 * t; }, ease.suave);
    await animar(380, t => { P.grupo.rotation.z = 0.35 * (1 - t); }, ease.salida);
    tornillo.visible = true;
    await animar(500, t => { tornillo.position.y = 2.4 - 2.2 * t; tornillo.rotation.y = t * Math.PI * 4; }, ease.salida);
    ctx.burbuja('¡Fijado!', V(-1.7, 2.5, 4.5));
  };
  return P;
}

/* ---------------- FUENTE DE ALIMENTACIÓN ---------------- */
function fuente() {
  const P = nuevaPieza('fuente', {
    nombre: 'Fuente de alimentación',
    texto: 'Convierte la corriente del enchufe en la que necesitan los componentes. Lleva el conector de 24 pines a la placa y el de 8 pines al procesador.',
    accion: 'Conectar los cables',
    requiere: ['cpu', 'disipador', 'ram', 'ssd'],
    foco: () => V(22, 0, -6),
  });
  const { k } = P, c = P.cuerpo;
  poner(c, k.caja(14, 8.6, 15, 0x4c566a, 0.09), 25, 4.3, -6);
  poner(c, k.cil(5.6, 0.12, C.negro, 0.05, 36), 25, 8.66, -6);
  const rotor = new THREE.Group(); rotor.position.set(25, 8.75, -6); c.add(rotor);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group(); b.rotation.y = (i / 5) * Math.PI * 2; rotor.add(b);
    const pala = poner(b, k.caja(4.4, 0.06, 1.3, C.metalOscuro, 0.03), 2.4, 0, 0); pala.rotation.x = 0.3;
  }
  for (let i = 0; i < 4; i++) { const r = poner(c, k.caja(11.2, 0.1, 0.25, C.metal, 0.02), 25, 8.95, -6); r.rotation.y = (i * Math.PI) / 4; }
  poner(c, k.caja(0.05, 3.2, 6, C.amarillo, 0), 17.97, 5.2, -9);
  poner(c, k.caja(0.3, 1.6, 3.2, C.negro, 0.04), 17.85, 3.2, -5);
  poner(c, k.caja(0.3, 1.2, 2.2, C.negro, 0.04), 17.85, 6, -11);

  const c24 = cableCreciente(k, [V(17.8, 3.2, -5), V(16, 4.6, -3.6), V(13.6, 6.2, -1.4), V(13.6, 4.2, -1), V(13.6, 2.85, -1)], 0.5, C.cable);
  const c8 = cableCreciente(k, [V(17.8, 6, -11), V(12, 8.5, -14), V(0, 9, -14.5), V(-11.5, 6.5, -13), V(-11.5, 3.8, -11.4), V(-11.5, 2.45, -11.2)], 0.35, C.cable);
  c.add(c24, c8);
  const p24 = poner(c, k.caja(1.4, 1.2, 5.3, C.cable, 0.05), 13.6, 2.25, -1); p24.scale.setScalar(0.001); p24.visible = false;
  const p8 = poner(c, k.caja(2.3, 1.0, 1.1, C.cable, 0.05), -11.5, 1.95, -11.2); p8.scale.setScalar(0.001); p8.visible = false;
  Object.assign(P, { rotor, velocidad: 0 });

  P.montar = async ctx => {
    ctx.enfocar(V(14, 1, -3));
    await crecer(c24, 1000);
    await aparecer(p24);
    ctx.burbuja('24 pines: placa', V(13.6, 4.5, -1));
    ctx.enfocar(V(-4, 1, -9));
    await crecer(c8, 1300);
    await aparecer(p8);
    ctx.burbuja('8 pines: procesador', V(-11.5, 4, -11.2));
  };
  return P;
}

/* ---------------- CABLE DE CORRIENTE ---------------- */
function enchufe() {
  const P = nuevaPieza('enchufe', {
    nombre: 'Cable de corriente',
    texto: 'Se enchufa al final, cuando todo está montado. Nunca se monta ni se toca nada con el equipo enchufado.',
    accion: 'Enchufar y encender',
    requiere: ['fuente'],
    foco: () => V(32, 0, 3),
  });
  const { k } = P, c = P.cuerpo;
  poner(c, k.caja(10, 1.4, 3.2, C.crema, 0.07), 33, 0.7, 7);
  const interruptor = poner(c, k.caja(1.3, 0.5, 1.7, C.rojo, 0.04, { propio: true }), 36.6, 1.6, 7);
  for (const x of [29.5, 32.3]) poner(c, k.cil(0.95, 0.05, 0xd6cfbf, 0.03, 20), x, 1.42, 7);
  const salida = k.tubo(new THREE.CatmullRomCurve3([V(38, 0.6, 7), V(40, 0.4, 8), V(44, 0.3, 11)]), 0.3, C.crema, 0.05, 20);
  c.add(salida);

  const clavija = new THREE.Group(); clavija.position.set(36, 0.85, -2.5); clavija.rotation.set(0, 0.4, Math.PI / 2); c.add(clavija);
  poner(clavija, k.caja(1.7, 2.2, 1.7, C.negro, 0.05), 0, 0, 0);
  for (const x of [-0.45, 0.45]) poner(clavija, k.cil(0.13, 0.9, C.metal, 0.03, 8), x, -1.5, 0);
  zona(clavija, 3, 4, 3, 0, -0.5, 0);

  const ancla = V(32, 2.6, -9), codo = V(34.5, 1.0, -9.6);
  const curvaEnchufe = e => {
    const m = codo.clone().lerp(e, 0.5); m.x = Math.max(m.x, 33.5) + 0.8; m.y = Math.max(0.6, Math.min(m.y, e.y) - 0.4);
    return new THREE.CatmullRomCurve3([ancla, codo, m, e]);
  };
  const cordon = k.tubo(curvaEnchufe(V(35, 0.85, -2.9)), 0.28, C.negro, 0.05, 40);
  P.grupo.add(cordon);
  const ult = new THREE.Vector3(Infinity, 0, 0), tmp = new THREE.Vector3(), arriba = new THREE.Vector3();
  P.actualizarCordon = () => {
    arriba.set(0, 1.1, 0); clavija.localToWorld(arriba); tmp.copy(arriba);
    if (tmp.distanceToSquared(ult) < 1e-4) return;
    ult.copy(tmp);
    cambiarGeometria(cordon, new THREE.TubeGeometry(curvaEnchufe(tmp.clone()), 40, 0.28, 8, false));
  };
  const reposo = { p: clavija.position.clone(), r: clavija.rotation.clone() };

  P.montar = async ctx => {
    ctx.enfocar(V(31, 0, 3));
    await volar(clavija, V(29.5, 3.6, 7), { rot: E(0, 0, 0), altura: 4, ms: 900 });
    await bajarA(clavija, 2.75, 300, ease.rebote);
    await esperar(150);
    await animar(250, t => { interruptor.rotation.x = -0.4 * t; }, ease.salida);
    interruptor.material.color.set(C.verde); interruptor.material.emissive.set(0x1b7a3c);
  };

  // Enchufar antes de terminar: chispazo y vuelve a su sitio
  P.fallo = async ctx => {
    ctx.enfocar(V(31, 0, 3));
    await volar(clavija, V(29.5, 3.8, 7), { rot: E(0, 0, 0), altura: 4, ms: 800 });
    await bajarA(clavija, 3.1, 160);
    ctx.chispas(V(29.5, 1.8, 7));
    await esperar(500);
    await volar(clavija, reposo.p, { rot: reposo.r, altura: 4, ms: 750 });
  };
  return P;
}

export const ORDEN = ['pulsera', 'cpu', 'pasta', 'disipador', 'ram', 'ssd', 'fuente', 'enchufe'];

export function construirPiezas() {
  const piezas = { placa: placa(), pulsera: pulsera(), cpu: cpu(), pasta: pasta(), disipador: disipador(), ram: ram(), ssd: ssd(), fuente: fuente(), enchufe: enchufe() };
  // La gota de pasta vive en la placa (se queda al quitar la jeringuilla)
  const gota = piezas.placa.k.esfera(1, 0x9aa3ad, 0.04);
  gota.position.set(-3, 1.0, -4); gota.scale.setScalar(0.001);
  piezas.placa.cuerpo.add(gota);
  piezas.placa.gota = gota;
  return piezas;
}
