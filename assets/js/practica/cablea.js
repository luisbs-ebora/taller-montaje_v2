// cablea.js — Práctica «Cablea el equipo» (Tema 3, Sección 3): qué cable va en cada conector y qué pasa al encender.
// Motor sin pantalla: la vista solo dibuja. El orden de las comprobaciones al encender es el de la secuencia de
// arranque de los apuntes: fuente → POST (procesador, gráfica, ventilador) → búsqueda del arranque.

export function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Cables: de dónde salen, cómo es su conector y qué lleva escrito
export const CABLES = {
  atx24: { nombre: 'ATX de 24 pines', de: 'fuente', forma: '24', pista: 'El más grande. Sale de la fuente.' },
  eps: { nombre: '8 pines (4+4), rotulado «CPU»', de: 'fuente', forma: '8cpu', pista: 'Sale de la fuente.' },
  pcie: { nombre: '8 pines (6+2), rotulado «PCIe»', de: 'fuente', forma: '8pcie', pista: 'Sale de la fuente.' },
  satac: { nombre: 'SATA de alimentación (plano, en L, 15 pines)', de: 'fuente', forma: 'satac', pista: 'Sale de la fuente.' },
  satad: { nombre: 'SATA de datos (estrecho, 7 pines)', de: 'disco', forma: 'satad', pista: 'Ya está puesto en el disco: falta el otro extremo.' },
  fancpu: { nombre: 'Cable del ventilador del disipador', de: 'disipador', forma: 'fan', pista: 'Sale del ventilador del disipador.' },
  fancaja: { nombre: 'Cable de los ventiladores de la caja', de: 'caja', forma: 'fan', pista: 'Sale de los ventiladores del frontal.' },
  frontal: { nombre: 'Cables del frontal: POWER SW, RESET SW, POWER LED y HDD LED', de: 'frontal', forma: 'fpanel', pista: 'Salen del frontal de la caja.' },
  usbf: { nombre: 'USB 3 del frontal (conector azul)', de: 'frontal', forma: 'usb3', pista: 'Sale del frontal de la caja.' },
  video: { nombre: 'Cable del monitor (HDMI)', de: 'monitor', forma: 'video', pista: 'Ya está puesto en el monitor: falta el otro extremo.' },
};

// Conectores del equipo. «partes» son las piezas del 3D que valen para tocarlo.
export const DESTINOS = {
  atx24: { nombre: 'ATX_24P (placa)', forma: '24', partes: ['atx24'] },
  eps: { nombre: 'CPU_PWR (placa, arriba a la izquierda)', forma: '8cpu', partes: ['eps'] },
  gpu: { nombre: 'Conector de alimentación de la gráfica', forma: '8pcie', partes: ['alimentacion', 'gpu', 'ventiladores'] },
  cpufan: { nombre: 'CPU_FAN (placa)', forma: 'fan', partes: ['cpufan'] },
  chafan: { nombre: 'CHA_FAN (placa)', forma: 'fan', partes: ['chafan'] },
  fpanel: { nombre: 'F_PANEL (placa, abajo a la derecha)', forma: 'fpanel', partes: ['fpanel'] },
  sata1: { nombre: 'Puerto SATA 1 (placa)', forma: 'satad', partes: ['sata'] },
  disco: { nombre: 'Conector de alimentación del disco', forma: 'satac', partes: ['ssd25'] },
  usb3: { nombre: 'USB3 (cabezal azul de la placa)', forma: 'usb3', partes: [] },
  vgpu: { nombre: 'HDMI de la tarjeta gráfica', forma: 'video', partes: [] },
  vplaca: { nombre: 'HDMI de la placa', forma: 'video', partes: [] },
};
export function destinoDeParte(parte, caso) { return caso.destinos.find(d => DESTINOS[d].partes.includes(parte)) || null; }

/** Un equipo sin cablear. Cambia si lleva gráfica y si lleva disco SATA además del SSD M.2: según eso sobran cables. */
export function crearCaso(semilla) {
  const r = azar(semilla);
  const conGpu = r() < 0.65, hdd = r() < 0.65;
  // de la fuente salen siempre todos sus cables: en algunos equipos sobra alguno
  const cables = ['atx24', 'eps', 'pcie', 'satac', ...(hdd ? ['satad'] : []), 'fancpu', 'fancaja', 'frontal', 'usbf', 'video'];
  const destinos = ['atx24', 'eps', ...(conGpu ? ['gpu'] : []), 'cpufan', 'chafan', 'fpanel', 'usb3', 'sata1', ...(hdd ? ['disco'] : []), ...(conGpu ? ['vgpu'] : []), 'vplaca'];
  return { semilla, conGpu, hdd, m2: !hdd, cables, destinos };
}

export const estadoInicial = () => ({ conex: {}, forzados: [], enchufado: false, intentos: [], criticos: [], terminado: false });
export const cableEn = (estado, destino) => Object.keys(estado.conex).find(c => estado.conex[c] === destino) || null;

/**
 * Intenta meter un cable en un conector. Devuelve { ok } o { ok:false, motivo, forzable }.
 * Con forzar = true se mete aunque no sea el suyo (solo EPS ↔ PCIe, que casi encajan): es un fallo crítico.
 */
export function conectar(estado, cable, destino, forzar = false) {
  if (estado.enchufado) {
    critico(estado, 'Has tocado los cables con el equipo enchufado.');
    return { ok: false, motivo: '¡Alto! El equipo está enchufado. Todos los cables se ponen y se quitan con la fuente desenchufada: apaga y desenchufa primero.' };
  }
  const c = CABLES[cable], d = DESTINOS[destino];
  const ocupado = cableEn(estado, destino);
  if (ocupado && ocupado !== cable) return { ok: false, motivo: `En ${d.nombre} ya hay un cable. Quítalo antes.` };
  if (c.forma !== d.forma) {
    const casi = (c.forma === '8cpu' && d.forma === '8pcie') || (c.forma === '8pcie' && d.forma === '8cpu');
    if (!casi) return { ok: false, motivo: 'No entra: el conector tiene otra forma.' };
    if (!forzar) return { ok: false, forzable: true, motivo: 'Entra hasta la mitad y cuesta meterlo. Los dos tienen 8 pines, pero no son iguales.' };
    critico(estado, 'Has forzado un conector que no era el suyo (EPS y PCIe no se intercambian).');
    estado.forzados.push(cable);
  }
  estado.conex[cable] = destino;
  return { ok: true };
}
export function quitar(estado, cable) {
  if (estado.enchufado) { critico(estado, 'Has tocado los cables con el equipo enchufado.'); return { ok: false, motivo: '¡Alto! El equipo está enchufado: apaga y desenchufa antes de quitar un cable.' }; }
  delete estado.conex[cable]; estado.forzados = estado.forzados.filter(c => c !== cable);
  return { ok: true };
}
function critico(estado, texto) { if (!estado.criticos.includes(texto)) estado.criticos.push(texto); }

/**
 * Qué pasa al enchufar y pulsar el botón con el cableado actual.
 * giran: qué ventiladores giran. led: LED de diagnóstico que se queda encendido. pantalla: lo que se ve en el monitor.
 */
export function arrancar(caso, estado) {
  const en = c => estado.conex[c] || null;
  const quieto = { fuente: false, disipador: false, caja: false, grafica: false };
  if (estado.forzados.length) {
    return { tipo: 'averia', arranca: false, giran: quieto, led: null, luz: false, pantalla: 'Apagada',
      texto: 'Al pulsar el botón se oye un chasquido y huele a quemado. Un cable de 8 pines forzado en un conector que no era el suyo lleva la corriente a patillas equivocadas: se ha dañado la placa o la fuente.' };
  }
  if (en('atx24') !== 'atx24') return { tipo: 'nada', arranca: false, giran: quieto, led: null, luz: false, pantalla: 'Apagada', falta: 'atx24',
    texto: 'Pulsas el botón y no pasa nada: ni ventiladores ni luces.' };
  if (en('frontal') !== 'fpanel') return { tipo: 'nada', arranca: false, giran: quieto, led: null, luz: false, pantalla: 'Apagada', falta: 'frontal',
    texto: 'Pulsas el botón y no pasa nada: ni ventiladores ni luces.' };
  const giran = { fuente: true, disipador: !!en('fancpu'), caja: !!en('fancaja'), grafica: caso.conGpu && en('pcie') === 'gpu' };
  if (en('eps') !== 'eps') return { tipo: 'post', arranca: false, giran, led: 'CPU', luz: true, pantalla: 'Sin señal', falta: 'eps',
    texto: 'Los ventiladores giran, pero el monitor no muestra nada. En la placa se queda encendido el LED CPU.' };
  if (caso.conGpu && en('pcie') !== 'gpu') return { tipo: 'post', arranca: false, giran, led: 'VGA', luz: true, pantalla: 'Sin señal', falta: 'pcie',
    texto: 'Los ventiladores giran, pero el monitor no muestra nada. En la placa se queda encendido el LED VGA.' };
  if (!cableEn(estado, 'cpufan')) return { tipo: 'post', arranca: false, giran, led: null, luz: true, pantalla: 'CPU Fan Error! Press F1 to Run SETUP', falta: 'fancpu',
    texto: 'Da imagen, pero se para con un mensaje: la placa no detecta ningún ventilador en CPU_FAN.' };
  // El equipo ya funciona por dentro. ¿Llega la imagen al monitor? Con gráfica dedicada, las salidas de la placa no dan imagen.
  const salida = caso.conGpu ? 'vgpu' : 'vplaca';
  if (en('video') !== salida) return { tipo: 'post', arranca: false, giran, led: null, luz: true, pantalla: 'Sin señal', falta: en('video') ? 'videoplaca' : 'video',
    texto: 'Los ventiladores giran y no se queda encendido ningún LED de error, pero el monitor no muestra nada.' };
  if (!caso.m2 && (en('satad') !== 'sata1' || en('satac') !== 'disco')) return { tipo: 'arranque', arranca: false, giran, led: 'BOOT', luz: true, pantalla: 'Reboot and select proper boot device', falta: en('satad') !== 'sata1' ? 'satad' : 'satac',
    texto: 'Pasa el POST, pero se para con un mensaje: no encuentra ningún disco del que arrancar. En la placa se queda encendido el LED BOOT.' };
  // Arranca. Queda por ver si los ventiladores están donde deben.
  if (en('fancpu') !== 'cpufan' || en('fancaja') !== 'chafan') {
    const cruzados = en('fancaja') === 'cpufan';
    if (!en('fancpu')) return { tipo: 'casi', arranca: true, giran, led: null, luz: true, pantalla: 'Arranca normal', falta: 'fancpu',
      texto: 'Arranca y da imagen. Pero al mirar dentro, el ventilador del disipador está parado: el procesador se va a calentar.' };
    return { tipo: 'casi', arranca: true, giran, led: null, luz: true, pantalla: 'Arranca normal', falta: cruzados ? 'cruzados' : 'fancaja',
      texto: cruzados ? 'Arranca y da imagen. Pero al mirar dentro, la placa regula los ventiladores de la caja con la temperatura del procesador, y el del disipador va por su cuenta.'
        : 'Arranca y da imagen. Pero al mirar dentro, los ventiladores de la caja están parados.' };
  }
  if (en('usbf') !== 'usb3') return { tipo: 'casi', arranca: true, giran, led: null, luz: true, pantalla: 'Arranca normal', falta: 'usbf',
    texto: 'Arranca y da imagen. Pero al probar un pendrive en el frontal de la caja, no lo reconoce.' };
  return { tipo: 'bien', arranca: true, giran, led: null, luz: true, pantalla: 'Arranca normal', texto: 'Arranca, da imagen y giran todos los ventiladores.' };
}

const EXPLICA = {
  atx24: 'Faltaba el cable ATX de 24 pines en ATX_24P: sin él la placa no recibe corriente.',
  frontal: 'Faltaban los cables del frontal en F_PANEL: sin POWER SW, el botón de encendido no hace nada.',
  eps: 'Faltaba el cable EPS en CPU_PWR: sin él el procesador no recibe corriente y no hay imagen.',
  pcie: 'Faltaba el cable PCIe en la gráfica: sin él la gráfica no arranca.',
  fancpu: 'El ventilador del disipador tiene que ir en CPU_FAN.',
  satad: 'Faltaba el cable SATA de datos en un puerto SATA de la placa.',
  satac: 'Faltaba el cable SATA de alimentación en el disco.',
  fancaja: 'Los ventiladores de la caja van en CHA_FAN.',
  cruzados: 'Estaban cruzados: el del disipador va en CPU_FAN y los de la caja en CHA_FAN.',
  video: 'Faltaba el cable del monitor.',
  videoplaca: 'El monitor estaba conectado a la placa: con tarjeta gráfica, va a la salida de la tarjeta.',
  usbf: 'Faltaba el cable USB del frontal en su cabezal azul de la placa.',
};
export const explica = r => EXPLICA[r.falta] || '';

/** Enchufa y enciende: guarda el intento y devuelve lo que pasa. */
export function encender(caso, estado) {
  const r = arrancar(caso, estado);
  estado.enchufado = true;
  estado.intentos.push(r.tipo);
  if (r.tipo === 'averia') { estado.terminado = true; }
  if (r.tipo === 'bien') estado.terminado = true;
  return r;
}
export function apagar(estado) { estado.enchufado = false; }

export const TOPE_CRITICO = 4;
/** Nota: 10 si arranca bien a la primera; cada encendido fallido resta 1,5. Con un fallo crítico, como mucho un 4. */
export function puntuar(estado) {
  const fallidos = estado.intentos.filter(t => t !== 'bien').length;
  const bien = estado.intentos.includes('bien');
  let nota = bien ? Math.max(5, 10 - 1.5 * fallidos) : 0;
  if (estado.criticos.length) nota = Math.min(nota, TOPE_CRITICO);
  return { nota: Math.round(nota * 10) / 10, fallidos, bien, criticos: estado.criticos };
}

/** Cableado correcto de un caso, para las pruebas y para enseñarlo al terminar. */
export function solucion(caso) {
  const s = { atx24: 'atx24', eps: 'eps', fancpu: 'cpufan', fancaja: 'chafan', frontal: 'fpanel', usbf: 'usb3', video: caso.conGpu ? 'vgpu' : 'vplaca' };
  if (caso.conGpu) s.pcie = 'gpu';
  if (!caso.m2) { s.satad = 'sata1'; s.satac = 'disco'; }
  return s;
}
