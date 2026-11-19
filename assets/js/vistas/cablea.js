// cablea.js — Práctica «Cablea el equipo»: se coge un cable, se lleva a su conector y se enciende para ver qué pasa.
import * as THREE from 'three';
import { h, md } from '../util.js';
import { huecoVisor } from './comun.js';
import { montaje } from '../piezas3d.js';
import { COLOR_LED, ponerLuces, encender as luzEn } from './luces3d.js';
import { CABLES, DESTINOS, destinoDeParte, crearCaso, estadoInicial, cableEn, conectar, quitar, encender, apagar, explica, puntuar, solucion, TOPE_CRITICO } from '../practica/cablea.js';

const COLOR_CABLE = { atx24: 0x15171a, eps: 0x15171a, pcie: 0x15171a, satac: 0x15171a, satad: 0xc0392b, fancpu: 0x3a3f46, fancaja: 0x3a3f46, frontal: 0x8a8f98 };
const GROSOR = { atx24: 0.55, eps: 0.36, pcie: 0.36, satac: 0.3, satad: 0.2, fancpu: 0.11, fancaja: 0.11, frontal: 0.2 };

export function vistaCablea() {
  let caso, estado, sel = null, pendiente = null, ultimo = null, aviso = null;
  let modelo = null, luces = {}, cablesG = null, anclas = {};
  const monitor = h('div.av-monitor', { 'aria-hidden': 'true' });
  const visor = huecoVisor({ pista: 'Arrastra para girar · rueda para acercar · con un cable cogido, toca su conector', alTocar: parte => tocar(parte) });
  const panel = h('div.av-panel');
  const el = h('section.av',
    h('span.etiqueta', 'Práctica · Tema 3 · no cuenta para nota'), h('h1', 'Cablea el equipo'),
    h('p.lead', 'Las piezas ya están montadas, pero falta conectar todos los cables. Coge un cable, llévalo a su conector y, cuando creas que está todo, enchufa y enciende.'),
    h('div.av-rejilla', h('div.av-visor', (visor.el.append(monitor), visor.el)), panel));

  // --- 3D: conectores de más, anclas de los cables y los cables ---
  function prepararModelo() {
    const piezas = { caja: { formatos: ['ATX'] }, placa: { formato: 'ATX' }, cpu: {}, refri: { altura: 155 }, ram: { formato: 'DIMM', gen: 'DDR5', modulos: 2 },
      almac: { formato: caso.m2 ? 'M.2 2280' : '2,5"' }, fuente: { formato: 'ATX' }, gpu: caso.conGpu ? { largo: 260, pcie8: 2 } : { ninguna: true } };
    modelo = montaje(piezas); luces = ponerLuces(modelo);
    const por = {}; let cajaG = null, fuenteG = null, refriG = null;
    modelo.traverse(o => {
      if (o.isMesh && o.userData.parte && !por[o.userData.parte]) por[o.userData.parte] = o;
      if (o.userData.tipo === 'caja') cajaG = o; if (o.userData.tipo === 'fuente') fuenteG = o; if (o.userData.tipo === 'refri') refriG = o;
    });
    // El modelo no trae el cabezal CHA_FAN: se añade en el borde de abajo de la placa, a la izquierda de F_PANEL
    if (por.fpanel) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.6 }));
      m.position.set(por.fpanel.position.x - 6, por.fpanel.position.y, por.fpanel.position.z);
      m.userData.parte = 'chafan'; por.fpanel.parent.add(m); por.chafan = m;
    }
    modelo.updateMatrixWorld(true);
    const centro = o => o.getWorldPosition(new THREE.Vector3());
    const { P, A, W } = cajaG.userData;
    const f = centro(fuenteG);
    anclas = {
      destino: { atx24: por.atx24, eps: por.eps, gpu: por.alimentacion, cpufan: por.cpufan, chafan: por.chafan, fpanel: por.fpanel, sata1: por.sata, disco: por.ssd25 },
      origen: {
        fuente: i => new THREE.Vector3(f.x + 5.5, f.y + 1 + i * 0.5, f.z + 2 - i * 0.9),
        frontal: () => new THREE.Vector3((P / 2 - 4) / 10, (-A / 2 + 115) / 10, 0),
        disipador: () => centro(refriG).add(new THREE.Vector3(0, 0, 4)),
        caja: () => new THREE.Vector3((P / 2 - 30) / 10, (A / 2 - 175) / 10, 0),
        disco: () => (por.ssd25 ? centro(por.ssd25).add(new THREE.Vector3(0, 0.6, 0)) : new THREE.Vector3()),
      },
      centro,
    };
    cablesG = new THREE.Group(); modelo.add(cablesG);
  }

  function dibujarCables() {
    if (!cablesG) return;
    cablesG.clear();
    let nFuente = 0;
    for (const id of caso.cables) {
      const dest = estado.conex[id]; const c = CABLES[id];
      const i = c.de === 'fuente' ? nFuente++ : 0;
      if (!dest || !anclas.destino[dest]) continue;
      const a = anclas.origen[c.de](i), b = anclas.centro(anclas.destino[dest]);
      // el cable sale hacia el frente de la caja y cuelga un poco, para que no atraviese las piezas
      const fuera = 6 + GROSOR[id] * 2;
      const m1 = new THREE.Vector3(a.x + (b.x - a.x) * 0.25, a.y + (b.y - a.y) * 0.25, Math.max(a.z, b.z) + fuera);
      const m2 = new THREE.Vector3(a.x + (b.x - a.x) * 0.8, a.y + (b.y - a.y) * 0.8, Math.max(a.z, b.z) + fuera * 0.8);
      const curva = new THREE.CatmullRomCurve3([a, m1, m2, b.clone().add(new THREE.Vector3(0, 0, 0.8)), b], false, 'catmullrom', 0.4);
      const malla = new THREE.Mesh(new THREE.TubeGeometry(curva, 48, GROSOR[id], 8), new THREE.MeshStandardMaterial({ color: COLOR_CABLE[id], roughness: 0.7 }));
      malla.userData.noTocar = true; malla.castShadow = true;
      cablesG.add(malla);
      const clavija = new THREE.Mesh(new THREE.BoxGeometry(GROSOR[id] * 3.2, GROSOR[id] * 3.2, 0.9), new THREE.MeshStandardMaterial({ color: estado.forzados.includes(id) ? 0xb23a2a : COLOR_CABLE[id], roughness: 0.6 }));
      clavija.position.copy(b).add(new THREE.Vector3(0, 0, 0.9)); clavija.userData.noTocar = true; cablesG.add(clavija);
    }
  }

  // Pone ventiladores, luces y monitor según el último encendido; con el equipo desenchufado, todo parado
  function ambientar() {
    const r = estado.enchufado ? ultimo : null;
    const grupoDe = o => { let p = o; while (p && !p.userData.tipo) p = p.parent; return p ? p.userData.tipo : null; };
    if (modelo) modelo.traverse(o => {
      if (!o.userData.gira) return;
      const t = grupoDe(o);
      const cual = t === 'refri' ? 'disipador' : t === 'caja' ? 'caja' : t === 'fuente' ? 'fuente' : 'grafica';
      o.userData.parado = !(r && r.giran[cual]);
    });
    for (const n of ['CPU', 'DRAM', 'VGA', 'BOOT']) luzEn(luces[n], r && r.led === n ? COLOR_LED[n] : 0);
    luzEn(luces.POWER, r && r.luz ? 0x35d07f : 0);
    const p = r ? r.pantalla : 'Apagada';
    const tipo = /^Apagada/.test(p) ? 'apagada' : /Sin señal/.test(p) ? 'sin' : /^Arranca normal/.test(p) ? 'imagen' : 'texto';
    monitor.className = 'av-monitor ' + tipo;
    monitor.replaceChildren(h('div.av-monitor-pantalla', tipo === 'sin' ? 'Sin señal' : tipo === 'texto' ? p : tipo === 'imagen' ? 'Windows' : ''), h('div.av-monitor-pie'));
  }

  function nuevo() {
    caso = crearCaso(Math.floor(Math.random() * 2147483647));
    estado = estadoInicial(); sel = null; pendiente = null; ultimo = null; aviso = null;
    const v = visor.iniciar();
    if (v) { prepararModelo(); v.mostrar(modelo, { vista: 'frente' }); }
    visor.rotulo('');
    pintar();
  }

  // --- Acciones ---
  function intentar(destino, forzar = false) {
    if (estado.terminado) return;
    if (!sel) { aviso = ['info', `${DESTINOS[destino].nombre}. Para conectar algo aquí, coge antes un cable de la lista.`]; pintar(); return; }
    const r = conectar(estado, sel, destino, forzar);
    pendiente = null;
    if (r.ok) { aviso = ['ok', `${CABLES[sel].nombre} → ${DESTINOS[destino].nombre}.` + (forzar ? ' Lo has metido a la fuerza.' : '')]; sel = null; }
    else if (r.forzable) { pendiente = { cable: sel, destino }; aviso = ['error', r.motivo]; }
    else aviso = ['error', r.motivo];
    pintar();
  }
  function tocar(parte) {
    if (!parte) { visor.rotulo(''); return; }
    const d = destinoDeParte(parte, caso);
    if (!d) { visor.rotulo(''); return; }
    visor.rotulo(DESTINOS[d].nombre);
    intentar(d);
  }
  function soltar(cable) {
    const r = quitar(estado, cable);
    aviso = r.ok ? ['info', `Has quitado: ${CABLES[cable].nombre}.`] : ['error', r.motivo];
    pintar();
  }

  function pintar() {
    dibujarCables(); ambientar();
    const libres = caso.cables.filter(c => !estado.conex[c]);
    const tarjetaCable = id => {
      const c = CABLES[id], dest = estado.conex[id];
      return h('div.cb-cable' + (sel === id ? '.cogido' : '') + (dest ? '.puesto' : ''),
        h('span.cb-muestra', { style: `background:#${COLOR_CABLE[id].toString(16).padStart(6, '0')}` }),
        h('div', h('b', c.nombre), h('small', dest ? 'Conectado en ' + DESTINOS[dest].nombre : c.pista)),
        dest ? h('button.btn.sec.cb-mini', { type: 'button', disabled: estado.terminado, onclick: () => soltar(id) }, 'Quitar')
          : h('button.btn.cb-mini' + (sel === id ? '' : '.sec'), { type: 'button', disabled: estado.terminado, onclick: () => { sel = sel === id ? null : id; pendiente = null; aviso = null; pintar(); } }, sel === id ? 'Soltar' : 'Coger'));
    };
    const cables = h('div.tarjeta.av-paso', h('h3', '1 · Los cables'),
      h('p.av-nota', 'Puede que sobre alguno: la fuente trae todos sus cables aunque el equipo no los necesite.'),
      h('div.cb-lista', caso.cables.map(tarjetaCable)));

    const conectores = h('div.tarjeta.av-paso', h('h3', '2 · Dónde lo conectas'),
      h('p.av-nota', sel ? `Tienes cogido: ${CABLES[sel].nombre}. Toca su conector en el 3D o elígelo aquí.` : 'Coge un cable y después toca su conector en el 3D o elígelo aquí.'),
      h('div.av-zonas', caso.destinos.map(d => h('button.chip' + (cableEn(estado, d) ? '.ok' : ''),
        { type: 'button', disabled: estado.terminado, onclick: () => { const dd = DESTINOS[d]; if (visor.visor) visor.visor.resaltar(dd.partes[0]); visor.rotulo(dd.nombre); intentar(d); } }, DESTINOS[d].nombre))),
      aviso ? h('p.mensaje.' + (aviso[0] === 'error' ? 'error' : aviso[0] === 'ok' ? 'ok' : 'info'), aviso[1]) : null,
      pendiente ? h('div.cb-forzar',
        h('button.btn.sec', { type: 'button', onclick: () => { pendiente = null; aviso = ['info', 'Bien: si cuesta meterlo, es que no es el suyo.']; pintar(); } }, 'No forzarlo'),
        h('button.btn.sec', { type: 'button', onclick: () => intentar(pendiente.destino, true) }, 'Apretar hasta que entre')) : null);

    const nota = estado.terminado ? puntuar(estado) : null;
    const encendido = h('div.tarjeta.av-paso', h('h3', '3 · Enchufa y enciende'),
      estado.terminado ? null : !estado.enchufado
        ? h('button.btn.azul', { type: 'button', onclick: () => { ultimo = encenderYAnotar(); sel = null; pendiente = null; aviso = null; pintar(); } }, `Enchufar y pulsar el botón${libres.length ? ` (quedan ${libres.length} cables sin conectar)` : ''}`)
        : h('button.btn.sec', { type: 'button', onclick: () => { apagar(estado); aviso = null; pintar(); } }, 'Apagar y desenchufar para seguir'),
      ultimo && estado.enchufado ? h('p.cb-pasa.' + ultimo.tipo, ultimo.texto) : null,
      estado.intentos.length && !estado.terminado ? h('p.av-nota', `Encendidos hasta ahora: ${estado.intentos.length}. Nadie te va a decir qué cable falta: mira qué hace el equipo.`) : null);

    const partes = [cables, conectores, encendido];
    if (nota) partes.push(resultado(nota));
    panel.replaceChildren(...partes);
  }

  function resultado(n) {
    const sol = solucion(caso);
    return h('div.tarjeta.av-resultado',
      h('h3', `Resultado: ${n.nota.toLocaleString('es-ES')} / 10`),
      n.criticos.length ? h('p.mensaje.error', h('b', `Fallo crítico: la nota no pasa de ${TOPE_CRITICO}. `), n.criticos.join(' ')) : null,
      h('ul.av-detalle',
        h('li.' + (n.bien ? 'ok' : 'mal'), n.bien ? (n.fallidos ? `El equipo arranca, pero has necesitado ${n.fallidos + 1} encendidos.` : 'El equipo arranca a la primera.') : 'El equipo ha quedado dañado: no arranca.'),
        ...[...new Set(estado.intentosDetalle || [])].map(t => h('li.mal', t))),
      h('p', h('b', 'El cableado correcto: ')),
      h('ul.cb-solucion', Object.entries(sol).map(([c, d]) => h('li', { html: md(`**${CABLES[c].nombre}** → ${DESTINOS[d].nombre}`) })),
        caso.cables.filter(c => !sol[c]).map(c => h('li', { html: md(`**${CABLES[c].nombre}**: sobra en este equipo, se deja recogido.`) }))),
      h('button.btn.azul', { type: 'button', onclick: () => { nuevo(); el.scrollIntoView({ behavior: 'smooth' }); } }, 'Otro equipo'));
  }

  // cada encendido fallido deja apuntado qué faltaba, para explicarlo al final
  function encenderYAnotar() { const r = encender(caso, estado); if (r.tipo !== 'bien') (estado.intentosDetalle ||= []).push(explica(r) || r.texto); return r; }

  return { el, montado() { nuevo(); }, destruir() { visor.destruir(); } };
}
