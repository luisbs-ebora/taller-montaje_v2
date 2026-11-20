// repara.js — Averías que se ven y se arreglan con las manos en la mesa de «Cablea el equipo».
// Usa el mismo equipo y el mismo cableado que practica/cablea.js y le añade lo que no es un cable:
// el módulo de memoria, el disipador, el interruptor de la fuente y la pila de la placa.
// Los textos de causa y solución son los de practica/averias.js (la tabla de los apuntes).
import { azar, crearCaso as casoCables, estadoInicial, solucion, arrancar } from './cablea.js';
import { FALLOS } from './averias.js';

const F = id => FALLOS.find(f => f.id === id);
const NO_ENCIENDE = 'No enciende. Le doy al botón y no hace nada.';
const NEGRO = 'Se enciende y se oyen los ventiladores, pero la pantalla se queda en negro.';

// Cada avería: lo que cuenta el cliente, qué hay que tocar para arreglarla y cómo se deja el equipo averiado.
// grupo: averías que desde fuera se parecen (salen juntas entre las causas a elegir).
export const BANCO = {
  powersw: { grupo: 'nada', queja: NO_ENCIENDE, toca: ['frontal'], poner: e => { delete e.conex.frontal; } },
  interruptor: { grupo: 'nada', queja: NO_ENCIENDE, toca: ['interruptor'], poner: e => { e.hw.interruptor = false; } },
  atx24: { grupo: 'nada', queja: NO_ENCIENDE, toca: ['atx24'], poner: e => { e.flojos.push('atx24'); } },
  ram: { grupo: 'negro', queja: NEGRO, toca: ['ram'], poner: e => { e.hw.ram = 'suelta'; } },
  eps: { grupo: 'negro', queja: NEGRO, toca: ['eps'], poner: e => { delete e.conex.eps; } },
  gpu: { grupo: 'negro', gpu: true, queja: NEGRO, toca: ['pcie'], poner: e => { delete e.conex.pcie; } },
  monitor: { grupo: 'negro', gpu: true, queja: NEGRO, toca: ['video'], poner: e => { e.conex.video = 'vplaca'; } },
  cmos: { grupo: 'negro', queja: 'Ayer funcionaba. Alguien estuvo cambiando la frecuencia de la memoria en la UEFI y desde entonces se enciende y se apaga solo, sin dar imagen.', toca: ['pila'], accion: 'borrar', poner: e => { e.hw.cmos = 'mal'; } },
  cpufan: { grupo: 'mensaje', queja: 'Se enciende, pero sale un mensaje en inglés y no pasa de ahí.', toca: ['fancpu'], poner: e => { delete e.conex.fancpu; } },
  disco: { grupo: 'mensaje', hdd: true, queja: 'Se enciende, pero sale un mensaje en inglés y no entra en Windows.', toca: ['satad'], poner: e => { delete e.conex.satad; } },
  calor: { grupo: 'va', queja: 'Arranca, pero a los pocos minutos se apaga solo.', toca: ['disipador'], poner: e => { e.hw.disipador = 'flojo'; } },
  pila: { grupo: 'va', queja: 'Funciona, pero cada mañana la fecha y la hora están mal y hay que volver a ponerlas.', toca: ['pila'], accion: 'cambiar', poner: e => { e.hw.pila = 'agotada'; } },
};

// Piezas que se tocan con la mano (no son cables) y lo que se puede hacer con cada una
export const PIEZAS = {
  ram: { nombre: 'Módulo de memoria', acciones: { presionar: 'Presionarlo por los dos extremos hasta que cierren las pestañas' } },
  disipador: { nombre: 'Disipador', acciones: { remontar: 'Quitarlo, limpiar la pasta, poner pasta nueva y montarlo apretando todos sus tornillos' } },
  pila: { nombre: 'Pila de la placa (CR2032)', acciones: { medir: 'Medirla con el polímetro', cambiar: 'Cambiarla por una nueva', borrar: 'Quitarla unos minutos para borrar la CMOS y volver a ponerla' } },
  interruptor: { nombre: 'Interruptor trasero de la fuente', acciones: { conmutar: 'Cambiarlo de posición' } },
};
const NOMBRE_MANO = { ram: 'el módulo de memoria', disipador: 'el disipador', pila: 'la pila de la placa', interruptor: 'el interruptor de la fuente',
  atx24: 'el cable de 24 pines', eps: 'el cable EPS', pcie: 'el cable PCIe', satac: 'el SATA de alimentación', satad: 'el SATA de datos',
  fancpu: 'el cable del ventilador del disipador', fancaja: 'el cable de los ventiladores de la caja', frontal: 'los cables del frontal', usbf: 'el USB del frontal', video: 'el cable del monitor' };

const EQUIPOS = ['PC de recepción', 'Equipo del aula 4', 'PC de la secretaría', 'Equipo de diseño', 'PC del almacén', 'Equipo del profesor', 'PC de la biblioteca', 'Equipo de la sala de reuniones'];
const barajar = (lista, r) => { const l = lista.slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const cabe = (id, caso) => (!BANCO[id].gpu || caso.conGpu) && (!BANCO[id].hdd || caso.hdd);

/**
 * Una avería de mesa. Sin «caso» se inventa también el equipo; con «caso» (el que acaba de cablear el alumno)
 * se elige una avería que ese equipo pueda tener.
 */
export function crearAveria(semilla, { caso = null, excluir = null, forzar = null } = {}) {
  const r = azar(semilla);
  let ids = Object.keys(BANCO).filter(id => id !== excluir && (!caso || cabe(id, caso)));
  let id = ids[Math.floor(r() * ids.length)];
  if (forzar && BANCO[forzar] && (!caso || cabe(forzar, caso))) id = forzar;
  for (let i = 0; !caso && i < 400; i++) { const c = casoCables(Math.floor(r() * 2147483647)); if (cabe(id, c)) caso = c; }
  const posibles = Object.keys(BANCO).filter(x => x !== id && cabe(x, caso));
  const mismas = posibles.filter(x => BANCO[x].grupo === BANCO[id].grupo);
  const otras = barajar(posibles.filter(x => !mismas.includes(x)), r);
  const causas = barajar([id, ...barajar(mismas, r), ...otras].slice(0, 5), r).map(x => ({ id: x, texto: F(x).causa }));
  return { semilla, caso, id, fallo: F(id), queja: BANCO[id].queja, equipo: EQUIPOS[Math.floor(r() * EQUIPOS.length)], causas };
}

/** El equipo tal como llega al taller: cableado del todo (o como lo dejó el alumno) y con la avería puesta. */
export function estadoAveriado(av, conex = null) {
  const e = { ...estadoInicial(), conex: { ...(conex || solucion(av.caso)) }, flojos: [],
    hw: { interruptor: true, ram: 'bien', disipador: 'bien', cmos: 'bien', pila: 'bien' },
    diagnostico: null, manos: [], fallidosTras: 0, reparado: false, entregado: false };
  BANCO[av.id].poner(e);
  return e;
}

function critico(estado, texto) { if (!estado.criticos.includes(texto)) estado.criticos.push(texto); }
const SIN_DIAGNOSTICO = 'Antes de tocar nada, mira, enciende si hace falta y entrega el diagnóstico. En el taller no se va probando a ciegas.';

/** ¿Se puede meter la mano? Devuelve null si sí, o el motivo. Con el equipo enchufado es un fallo crítico. */
export function manoProhibida(estado) {
  if (estado.enchufado) { critico(estado, 'Has tocado dentro del equipo con la fuente enchufada.'); return '¡Alto! El equipo está enchufado. Dentro solo se toca con la fuente apagada y desenchufada.'; }
  if (!estado.diagnostico) return SIN_DIAGNOSTICO;
  return null;
}
/** Apunta que se ha tocado un cable o una pieza (para saber después si hacía falta). */
export function anotar(estado, id) { if (!estado.manos.includes(id)) estado.manos.push(id); }
/** Un cable que se saca de su conector deja de estar «a medio meter». */
export function alSacar(estado, cable) { estado.flojos = estado.flojos.filter(c => c !== cable); anotar(estado, cable); }

/** Hace algo con una pieza. Devuelve { ok, texto } y, si cambia algo que se ve, { cambia: true }. */
export function tocar(estado, pieza, accion) {
  const hw = estado.hw;
  if (pieza === 'pila' && accion === 'medir') {
    if (estado.enchufado) { critico(estado, 'Has tocado dentro del equipo con la fuente enchufada.'); return { ok: false, texto: '¡Alto! El equipo está enchufado. Dentro solo se toca con la fuente apagada y desenchufada.' }; }
    return { ok: true, texto: hw.pila === 'agotada' ? 'El polímetro marca 2,1 V. Una CR2032 nueva da unos 3 V.' : 'El polímetro marca 3,0 V: la pila está bien.' };
  }
  if (pieza === 'interruptor') {
    if (estado.enchufado) return { ok: false, texto: 'El equipo está encendido. Para apagarlo, usa «Apagar y desenchufar».' };
    if (!estado.diagnostico) return { ok: false, texto: SIN_DIAGNOSTICO };
    hw.interruptor = !hw.interruptor; anotar(estado, 'interruptor');
    return { ok: true, cambia: true, texto: hw.interruptor ? 'Interruptor en I.' : 'Interruptor en O.' };
  }
  const no = manoProhibida(estado);
  if (no) return { ok: false, texto: no };
  anotar(estado, pieza + (pieza === 'pila' ? ':' + accion : ''));
  if (pieza === 'ram') { const estaba = hw.ram; hw.ram = 'bien'; return { ok: true, cambia: true, texto: estaba === 'suelta' ? '¡Clic! Ahora sí han cerrado las dos pestañas.' : 'El módulo ya estaba metido hasta el fondo: no se mueve.' }; }
  if (pieza === 'disipador') { const estaba = hw.disipador; hw.disipador = 'bien'; return { ok: true, cambia: true, texto: estaba === 'flojo' ? 'Disipador montado otra vez, con pasta nueva y los tornillos apretados: ya no se mueve.' : 'Disipador desmontado y vuelto a montar con pasta nueva. Estaba bien puesto.' }; }
  if (pieza === 'pila' && accion === 'cambiar') { hw.pila = 'bien'; hw.cmos = 'bien'; return { ok: true, texto: 'Pila nueva puesta. Al quitar la vieja, la UEFI ha vuelto a sus valores por defecto: hay que poner la fecha y la hora.' }; }
  if (pieza === 'pila' && accion === 'borrar') { hw.cmos = 'bien'; return { ok: true, texto: 'CMOS borrada: la UEFI ha vuelto a sus valores por defecto. Hay que poner la fecha y la hora y activar el perfil XMP.' }; }
  return { ok: false, texto: '' };
}

/** Qué pasa al encender: lo de practica/cablea.js más lo que no es un cable. */
export function arrancarBanco(caso, estado) {
  const hw = estado.hw;
  const puestos = { ...estado, conex: Object.fromEntries(Object.entries(estado.conex).filter(([c]) => !estado.flojos.includes(c))) };
  const quieto = { fuente: false, disipador: false, caja: false, grafica: false };
  if (!estado.forzados.length && !hw.interruptor) return { tipo: 'nada', arranca: false, giran: quieto, led: null, luz: false, pantalla: 'Apagada', falta: 'interruptor', texto: 'Pulsas el botón y no pasa nada: ni ventiladores ni luces.' };
  const r = arrancar(caso, puestos);
  if (r.tipo === 'averia' || r.tipo === 'nada' || r.falta === 'eps') return r;
  if (hw.cmos === 'mal') return { tipo: 'post', arranca: false, giran: r.giran, led: 'DRAM', luz: true, pantalla: 'Sin señal', falta: 'cmos',
    texto: 'Se enciende, se apaga y vuelve a encenderse, una y otra vez, sin dar imagen. En la placa se enciende el LED DRAM.' };
  if (hw.ram === 'suelta') return { tipo: 'post', arranca: false, giran: r.giran, led: 'DRAM', luz: true, pantalla: 'Sin señal', falta: 'ram',
    texto: 'Los ventiladores giran, pero el monitor no muestra nada. En la placa se queda encendido el LED DRAM.' };
  if (!r.arranca) return r;
  if (hw.disipador === 'flojo') return { ...r, tipo: 'casi', falta: 'calor', texto: 'Arranca y da imagen. Pero al entrar en la UEFI, la temperatura del procesador pasa de 85 °C en un minuto, sin hacer nada.' };
  if (hw.pila === 'agotada') return { ...r, tipo: 'casi', falta: 'pila', texto: 'Arranca y da imagen, pero la fecha del equipo ha vuelto a 2020.' };
  return r;
}

export function encenderBanco(caso, estado) {
  const r = arrancarBanco(caso, estado);
  estado.enchufado = true;
  estado.intentos.push(r.tipo);
  if (estado.diagnostico && estado.manos.length && r.tipo !== 'bien') estado.fallidosTras++; // encender para mirar, antes de tocar, no resta
  if (r.tipo === 'averia') estado.terminado = true;
  if (r.tipo === 'bien' && estado.diagnostico) { estado.reparado = true; estado.terminado = true; }
  return r;
}

export function diagnosticar(estado, causa) { if (!estado.diagnostico) estado.diagnostico = causa; }
/** Dar el equipo por terminado sin haber comprobado que arranca. */
export function entregar(caso, estado) {
  const r = arrancarBanco(caso, estado);
  estado.entregado = true; estado.terminado = true; estado.sinComprobar = true;
  if (r.tipo === 'bien') estado.reparado = true;
  return r;
}

export const TOPE_CRITICO = 4;
/**
 * Nota sobre 10: diagnóstico (4), equipo reparado y comprobado (4) y trabajo limpio (2: se pierde 1 por cada
 * cosa tocada sin necesidad y por cada encendido de prueba que no arranca). Con un fallo crítico, como mucho un 4.
 */
export function puntuarReparacion(av, estado) {
  const b = BANCO[av.id];
  const hacia = id => id.startsWith('pila:') ? (b.toca.includes('pila') && (!b.accion || id === 'pila:' + b.accion)) : b.toca.includes(id);
  const sobrantes = estado.manos.filter(id => !hacia(id));
  const p = { causa: estado.diagnostico === av.id ? 4 : 0, reparado: estado.reparado ? 4 : 0, limpio: estado.sinComprobar ? 0 : Math.max(0, 2 - sobrantes.length - estado.fallidosTras) };
  const criticos = estado.criticos.slice();
  if (!estado.reparado) criticos.push('El equipo sale del taller sin arreglar.');
  const nota = p.causa + p.reparado + p.limpio;
  return { puntos: p, criticos, fallidos: estado.fallidosTras, sinComprobar: !!estado.sinComprobar,
    sobrantes: sobrantes.map(id => id === 'pila:cambiar' ? 'la pila (la has cambiado y estaba bien)' : id === 'pila:borrar' ? 'la pila (has borrado la CMOS sin necesidad)' : NOMBRE_MANO[id] || id),
    nota: criticos.length ? Math.min(nota, TOPE_CRITICO) : nota };
}
