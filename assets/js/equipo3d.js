// equipo3d.js — Un PC montado con sus cables de verdad: cada cable tiene un extremo fijo (de donde sale)
// y una clavija que se coge y se lleva a un conector. Los trazados van por delante de las piezas y bajan
// rectos al conector, y se comprueba que no atraviesan nada. Incluye el monitor y las luces del equipo.
// Medidas en milímetros del modelo (x: atrás − / frente +, y: abajo − / arriba +, z: bandeja − / cristal +).
import * as THREE from 'three';
import { montaje } from './piezas3d.js';

const U = 0.1; // milímetros → unidades del modelo
const V = (x, y, z) => new THREE.Vector3(x * U, y * U, z * U);

export const CABLES3D = {
  atx24: { radio: 5, color: 0x17191c, clavija: [10, 52, 15], carril: 97 },
  eps: { radio: 3.2, color: 0x17191c, clavija: [20, 9, 13], carril: 92 },
  pcie: { radio: 3.2, color: 0x17191c, clavija: [20, 9, 11], carril: 87 },
  satac: { radio: 2.6, color: 0x17191c, clavija: [8, 8, 22], carril: 82 },
  satad: { radio: 1.9, color: 0xc0392b, clavija: [14, 6, 9], carril: 77 },
  fancpu: { radio: 1.2, color: 0x4a4f57, clavija: [10, 5, 8], carril: 74 },
  fancaja: { radio: 1.2, color: 0x4a4f57, clavija: [10, 5, 8], carril: 71 },
  frontal: { radio: 2.2, color: 0x9aa0a8, clavija: [26, 7, 9], carril: 68 },
};
// De dónde sale cada cable (extremo fijo) y dónde descansa su clavija cuando está suelta
const ORIGEN = {
  atx24: { raiz: [-40, -133, 60], reposo: [-40, -126, 88] },
  eps: { raiz: [-8, -133, 60], reposo: [-8, -127, 88] },
  pcie: { raiz: [24, -133, 60], reposo: [24, -127, 88] },
  satac: { raiz: [56, -133, 60], reposo: [56, -122, 88] },
  satad: { raiz: [186, -119, -18], reposo: [150, -127, 70] },
  fancpu: { raiz: [-112, 161, 20], reposo: [-112, 176, 52] },
  fancaja: { raiz: [196, 55, 30], reposo: [176, 55, 78] },
  frontal: { raiz: [214, -112, 60], reposo: [196, -127, 86] },
};
// Qué pieza del 3D es cada conector, y por dónde se llega a él
const CONECTOR = {
  atx24: { parte: 'atx24' }, eps: { parte: 'eps' }, cpufan: { parte: 'cpufan' }, chafan: { parte: 'chafan' }, chafan2: { parte: 'chafan2' },
  fpanel: { parte: 'fpanel' }, sata1: { parte: 'sata', lado: [0, 1] }, gpu: { parte: 'alimentacion' },
  disco: { parte: 'ssd25', punto: [184, -121, 14] },
};

function caja3(w, h, d, color, opts = {}) { return new THREE.Mesh(new THREE.BoxGeometry(w * U, h * U, d * U), new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...opts })); }

/** Camino en ángulos rectos con las esquinas redondeadas. */
function camino(puntos, radio = 10) {
  const c = new THREE.CurvePath();
  const p = puntos.filter((q, i) => i === 0 || q.distanceTo(puntos[i - 1]) > 1e-4);
  let desde = p[0];
  for (let i = 1; i < p.length; i++) {
    const a = p[i], sig = p[i + 1];
    if (!sig) { c.add(new THREE.LineCurve3(desde, a)); break; }
    const r = Math.min(radio * U, desde.distanceTo(a) / 2, a.distanceTo(sig) / 2);
    const antes = a.clone().add(desde.clone().sub(a).setLength(r)), despues = a.clone().add(sig.clone().sub(a).setLength(r));
    c.add(new THREE.LineCurve3(desde, antes));
    c.add(new THREE.QuadraticBezierCurve3(antes, a, despues));
    desde = despues;
  }
  return c;
}

/**
 * Monta el equipo. opc: { conGpu, m2, defectos: { ramSuelta, ramJunta, disipadorFlojo, atxMedio, interruptorCero }, video: 'gpu' | 'placa' | null }
 */
export function crearEquipo(opc = {}) {
  const { conGpu = true, m2 = false, defectos = {}, video = conGpu ? 'gpu' : 'placa' } = opc;
  const piezas = { caja: { formatos: ['ATX'] }, placa: { formato: 'ATX' }, cpu: {}, refri: { altura: 155 }, ram: { formato: 'DIMM', gen: 'DDR5', modulos: 2 },
    almac: { formato: m2 ? 'M.2 2280' : '2,5"' }, fuente: { formato: 'ATX' }, gpu: conGpu ? { largo: 260, pcie8: 2 } : { ninguna: true } };
  const modelo = montaje(piezas);
  const por = {}, grupos = {};
  modelo.traverse(o => {
    if (o.isMesh && o.userData.parte && !por[o.userData.parte]) por[o.userData.parte] = o;
    if (o.userData.tipo) (grupos[o.userData.tipo] ||= []).push(o);
  });

  // --- Lo que el modelo no trae: cabezal CHA_FAN, LED de diagnóstico, luz del frontal, interruptor con su marca ---
  const luzMat = () => new THREE.MeshStandardMaterial({ color: 0x23262b, emissive: 0x000000, roughness: 0.4 });
  const cha = caja3(10, 4, 8, 0xe9e6df); cha.position.set(por.fpanel.position.x - 6, por.fpanel.position.y, por.fpanel.position.z);
  cha.userData.parte = 'chafan'; por.fpanel.parent.add(cha); por.chafan = cha;
  const cha2 = caja3(10, 4, 8, 0xe9e6df); cha2.position.set(por.fpanel.position.x - 9.5, por.fpanel.position.y, por.fpanel.position.z);
  cha2.userData.parte = 'chafan2'; por.fpanel.parent.add(cha2); por.chafan2 = cha2;
  const luces = {};
  ['CPU', 'DRAM', 'VGA', 'BOOT'].forEach((n, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.35), luzMat());
    m.position.set(por.atx24.position.x - 1.3, por.atx24.position.y + 1.8 - i * 1.2, por.atx24.position.z - 0.3);
    m.userData.parte = 'leds'; por.atx24.parent.add(m); luces[n] = m;
  });
  const cajaG = grupos.caja[0]; const { P, A, W } = cajaG.userData;
  luces.POWER = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), luzMat());
  luces.POWER.position.copy(V(P / 2 + 5, A / 2 - 30, W / 2 - 25)); luces.POWER.userData.noTocar = true; modelo.add(luces.POWER);
  // interruptor trasero de la fuente: una tecla que bascula, con el lado hundido pintado
  const tecla = caja3(3, 16, 11, 0x111315); tecla.userData.parte = 'interruptor';
  tecla.position.copy(V(-P / 2 - 6, -167, -68)); tecla.rotation.z = defectos.interruptorCero ? -0.22 : 0.22; modelo.add(tecla);
  const marca = caja3(1, 3, 7, defectos.interruptorCero ? 0xd9d9d9 : 0xe5533d); marca.userData.parte = 'interruptor';
  marca.position.copy(V(-P / 2 - 8, defectos.interruptorCero ? -172 : -162, -68)); modelo.add(marca);
  // rótulo I / O junto a la tecla, como en una fuente de verdad
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#111'; g.font = '700 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('I', 32, 34); g.fillText('O', 32, 96);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const rot = new THREE.Mesh(new THREE.PlaneGeometry(9 * U, 18 * U), new THREE.MeshBasicMaterial({ map: tx }));
    rot.rotation.y = -Math.PI / 2; rot.position.copy(V(-P / 2 - 4.6, -167, -52)); rot.userData.parte = 'interruptor'; modelo.add(rot);
  }

  // --- Defectos de montaje que se ven ---
  const rams = grupos.ram || [];
  if (defectos.ramSuelta && rams[1]) { rams[1].rotation.x += 0.13; rams[1].position.z += 0.95; rams[1].position.y -= 0.45; } // un extremo fuera de la ranura
  if (defectos.ramJunta && rams[1]) rams[1].position.x = rams[0].position.x + 0.9; // en la ranura de al lado: A1 y A2
  if (defectos.disipadorFlojo && grupos.refri) { const r = grupos.refri[0]; r.rotation.z += 0.16; r.rotation.y += 0.13; r.position.z += 0.75; } // girado y levantado de un lado

  // --- Monitor de verdad, al lado de la torre ---
  const mon = new THREE.Group(); mon.name = 'monitor';
  const marco = caja3(500, 300, 22, 0x1b1d21); marco.position.copy(V(0, 80, 0)); mon.add(marco);
  const lienzo = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (lienzo) { lienzo.width = 640; lienzo.height = 384; }
  const textura = lienzo ? new THREE.CanvasTexture(lienzo) : null;
  if (textura) textura.colorSpace = THREE.SRGBColorSpace;
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(470 * U, 272 * U), new THREE.MeshBasicMaterial(textura ? { map: textura } : { color: 0x05060a }));
  pantalla.position.copy(V(0, 82, 11.5)); mon.add(pantalla);
  const pie = caja3(40, 120, 30, 0x1b1d21); pie.position.copy(V(0, -110, -20)); mon.add(pie);
  const base = caja3(220, 12, 150, 0x1b1d21); base.position.copy(V(0, -164, -10)); mon.add(base);
  const piloto = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), luzMat()); piloto.position.copy(V(225, -62, 12)); mon.add(piloto);
  mon.traverse(o => { if (o.isMesh) { o.userData.parte = 'monitor'; o.castShadow = true; } });
  mon.position.copy(V(-P / 2 - 300, -A / 2 - 4 + 170, -40)); mon.rotation.y = 0.38;
  modelo.add(mon);
  function pintarPantalla(tipo, texto) {
    if (!lienzo) return;
    const g = lienzo.getContext('2d');
    g.fillStyle = tipo === 'imagen' ? '#2b62b8' : '#05060a'; g.fillRect(0, 0, 640, 384);
    if (tipo === 'imagen') { const gr = g.createLinearGradient(0, 0, 640, 384); gr.addColorStop(0, '#2457a8'); gr.addColorStop(1, '#6aa5ff'); g.fillStyle = gr; g.fillRect(0, 0, 640, 384); g.fillStyle = '#1d2a44'; g.fillRect(0, 348, 640, 36); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (tipo === 'sin') { g.fillStyle = '#8fa3c7'; g.font = '600 34px sans-serif'; g.fillText('Sin señal', 320, 192); }
    if (tipo === 'imagen') { g.fillStyle = '#fff'; g.font = '600 40px sans-serif'; g.fillText(texto || 'Windows', 320, 180); }
    if (tipo === 'texto') {
      g.fillStyle = '#f2f2f2'; g.font = '600 30px monospace';
      const pal = String(texto).split(' '); const lineas = ['']; for (const w of pal) { if ((lineas[lineas.length - 1] + ' ' + w).length > 28) lineas.push(w); else lineas[lineas.length - 1] += (lineas[lineas.length - 1] ? ' ' : '') + w; }
      lineas.forEach((l, i) => g.fillText(l, 320, 192 + (i - (lineas.length - 1) / 2) * 42));
    }
    textura.needsUpdate = true;
  }

  modelo.updateMatrixWorld(true);
  const caja = o => new THREE.Box3().setFromObject(o);
  const centro = o => caja(o).getCenter(new THREE.Vector3());

  // Cajas de todo lo sólido, para comprobar que un cable no atraviesa nada
  const solidos = [];
  modelo.traverse(o => { if (o.isMesh && !o.userData.noTocar && o.userData.parte !== 'monitor') solidos.push({ o, b: caja(o) }); });

  // El cable del ventilador del disipador sale de encima del disipador, esté como esté puesto
  const origen = { ...ORIGEN };
  if (grupos.refri) { const b = caja(grupos.refri[0]), c = b.getCenter(new THREE.Vector3()); const y = b.max.y / U + 3;
    origen.fancpu = { raiz: [c.x / U, y, 20], reposo: [c.x / U, y + 14, 52] }; }

  // --- Conectores: dónde termina la clavija y desde dónde se llega ---
  function llegada(dest) {
    const c = CONECTOR[dest], m = por[c.parte];
    if (!m) return null;
    const b = caja(m);
    if (c.punto) return { fin: V(...c.punto), dir: new THREE.Vector3(0, 0, 1), tam: null, malla: m };
    const cen = b.getCenter(new THREE.Vector3());
    if (dest === 'sata1') cen.y = b.max.y - 0.45; // el primer puerto de la fila
    return { fin: new THREE.Vector3(cen.x, cen.y, b.max.z), dir: new THREE.Vector3(0, 0, 1), tam: b.getSize(new THREE.Vector3()), malla: m };
  }

  // --- Trazado: sube al carril (un plano por delante de todas las piezas), va en ángulos rectos y baja recto al conector ---
  function trazar(id, dest) {
    const c = CABLES3D[id], o = origen[id], ll = llegada(dest);
    const raiz = V(...o.raiz), z = c.carril * U, alto = c.clavija[2] * U;
    const fin = ll.fin.clone().add(new THREE.Vector3(0, 0, alto * 0.5));
    const cuello = fin.clone().add(new THREE.Vector3(0, 0, alto * 0.5));
    const sal = new THREE.Vector3(raiz.x, raiz.y + (o.raiz[1] < -120 ? 2.2 : 0), z);
    if (o.raiz[1] >= -120) sal.set(raiz.x, raiz.y, z);
    const candidatos = [
      [raiz, sal, new THREE.Vector3(sal.x, cuello.y, z), new THREE.Vector3(cuello.x, cuello.y, z), cuello],
      [raiz, sal, new THREE.Vector3(cuello.x, sal.y, z), new THREE.Vector3(cuello.x, cuello.y, z), cuello],
    ];
    let mejor = null;
    for (const pts of candidatos) {
      const curva = camino(pts, 12);
      const choques = chocan(curva, c.radio * U, ll.malla);
      if (!mejor || choques < mejor.choques) mejor = { curva, choques, fin, pts };
      if (!choques) break;
    }
    return mejor;
  }
  function chocan(curva, radio, permitida) {
    let n = 0;
    const pts = curva.getSpacedPoints(160);
    for (let i = 6; i < pts.length; i++) { // los primeros puntos salen del pasacables
      const p = pts[i];
      for (const s of solidos) {
        if (s.o === permitida) continue;
        const b = s.b;
        if (p.x > b.min.x - radio && p.x < b.max.x + radio && p.y > b.min.y - radio && p.y < b.max.y + radio && p.z > b.min.z - radio && p.z < b.max.z + radio) { n++; break; }
      }
    }
    return n;
  }

  // --- Cables y clavijas ---
  const cablesG = new THREE.Group(); modelo.add(cablesG);
  const ids = ['atx24', 'eps', 'pcie', 'satac', ...(m2 ? [] : ['satad']), 'fancpu', 'fancaja', 'frontal'];
  // pasacables de donde salen los cables de la fuente
  for (const id of ids) if (ORIGEN[id].raiz[1] < -130 && ORIGEN[id].raiz[2] > 0) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry((CABLES3D[id].radio + 2.5) * U, 1.2 * U, 8, 20), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 }));
    aro.rotation.x = Math.PI / 2; aro.position.copy(V(ORIGEN[id].raiz[0], -133.5, ORIGEN[id].raiz[2])); aro.userData.noTocar = true; modelo.add(aro);
  }
  let ultimoInforme = {};
  function poner(conex = {}, { cogido = null, forzados = [], medio = [] } = {}) {
    cablesG.clear(); ultimoInforme = {};
    for (const id of ids) {
      const c = CABLES3D[id], o = origen[id], dest = conex[id];
      const mat = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.75 });
      let curva, pos, tam = c.clavija;
      if (dest && llegada(dest)) {
        const t = trazar(id, dest); curva = t.curva; pos = t.fin; ultimoInforme[id] = t.choques;
        if (medio.includes(id)) pos = pos.clone().add(new THREE.Vector3(0, 0, 1.0)); // a medio meter
      } else {
        const a = V(...o.raiz), b = V(...o.reposo);
        const alza = cogido === id ? 1.6 : 0;
        pos = b.clone().add(new THREE.Vector3(0, alza, 0));
        curva = new THREE.CatmullRomCurve3([a, a.clone().lerp(pos, 0.5).add(new THREE.Vector3(0, 1.4 + alza * 0.5, 0)), pos]);
      }
      const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 90, c.radio * U, 8), mat);
      tubo.userData.noTocar = true; tubo.castShadow = true; cablesG.add(tubo);
      const cl = new THREE.Mesh(new THREE.BoxGeometry(tam[0] * U, tam[1] * U, tam[2] * U),
        new THREE.MeshStandardMaterial({ color: forzados.includes(id) ? 0xb23a2a : (id === 'satad' ? 0x8e2a20 : 0x0e0f11), roughness: 0.55,
          emissive: cogido === id ? 0xffb020 : 0x000000, emissiveIntensity: cogido === id ? 0.7 : 0 }));
      cl.position.copy(pos);
      if (medio.includes(id) && dest) cl.rotation.x = -0.2; // un extremo más levantado que el otro
      if (!dest) cl.rotation.x = Math.PI / 2; // tumbada mientras está suelta
      cl.userData.parte = 'cable:' + id; cl.castShadow = true; cablesG.add(cl);
    }
    cablesG.updateMatrixWorld(true);
  }

  // --- Cable de vídeo: del monitor a la gráfica o a la placa. Va por fuera de la caja. ---
  const videoG = new THREE.Group(); modelo.add(videoG);
  function ponerVideo(donde) {
    videoG.clear();
    const m = donde === 'gpu' ? por.salidas : donde === 'placa' ? por.io : null;
    if (!m) return;
    const b = caja(m); const fin = new THREE.Vector3(b.min.x - 1.2, donde === 'placa' ? b.min.y + 3.2 : (b.min.y + b.max.y) / 2, donde === 'placa' ? -8.5 : -2);
    const ini = mon.localToWorld(V(60, -40, -14));
    const curva = new THREE.CatmullRomCurve3([ini, ini.clone().add(new THREE.Vector3(1.5, -8, -6)), new THREE.Vector3(fin.x - 9, fin.y - 9, fin.z - 4), new THREE.Vector3(fin.x - 3.5, fin.y, fin.z), fin]);
    const t = new THREE.Mesh(new THREE.TubeGeometry(curva, 70, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8 }));
    t.userData.parte = 'video'; videoG.add(t);
    const cl = caja3(22, 16, 8, 0x2a2d33); cl.position.copy(fin).add(new THREE.Vector3(-0.3, 0, 0)); cl.rotation.y = Math.PI / 2; cl.userData.parte = 'video'; videoG.add(cl);
  }
  ponerVideo(video);

  // --- Encendido: ventiladores, luces y pantalla ---
  const tipoDe = o => { let p = o; while (p && !p.userData.tipo) p = p.parent; return p ? p.userData.tipo : null; };
  const luz = (m, color) => { m.material.emissive.setHex(color || 0x000000); m.material.emissiveIntensity = color ? 2.2 : 0; m.material.color.setHex(color || 0x23262b); };
  const COLOR_LED = { CPU: 0xff3b30, DRAM: 0xffb020, VGA: 0xffffff, BOOT: 0x35d07f };
  /** e: { giran: { fuente, disipador, caja, grafica }, led, luz, pantalla } o null para todo apagado */
  function ambientar(e) {
    modelo.traverse(o => {
      if (!o.userData.gira) return;
      const t = tipoDe(o); const cual = t === 'refri' ? 'disipador' : t === 'caja' ? 'caja' : t === 'fuente' ? 'fuente' : 'grafica';
      o.userData.parado = !(e && e.giran && e.giran[cual]);
    });
    for (const n of ['CPU', 'DRAM', 'VGA', 'BOOT']) luz(luces[n], e && e.led === n ? COLOR_LED[n] : 0);
    luz(luces.POWER, e && e.luz ? 0x35d07f : 0);
    const p = e ? e.pantalla : 'Apagada';
    const tipo = /^Apagada/.test(p) ? 'apagada' : /Sin señal/.test(p) ? 'sin' : /^Arranca normal|^Da imagen/.test(p) ? 'imagen' : 'texto';
    pintarPantalla(tipo, tipo === 'imagen' ? (/UEFI/.test(p) ? 'UEFI' : 'Windows') : p);
    luz(piloto, tipo === 'apagada' ? 0xffa000 : 0x35d07f);
  }

  poner({}); ambientar(null);
  return { modelo, ids, poner, ponerVideo, ambientar, choques: () => ultimoInforme, tieneConector: d => !!(CONECTOR[d] && por[CONECTOR[d].parte]) };
}
