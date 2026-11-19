// averia.js — Práctica «Este PC no arranca» (Tema 3). Se genera y corrige en el navegador: no cuenta para nota.
import { h, md, progreso } from '../util.js';
import { huecoVisor, informeAlumno, informeCompleto, informeComparado } from './comun.js';
import { crearEquipo } from '../equipo3d.js';
import { FASES_PRACTICA as FASES, ZONAS_PRACTICA as ZONAS, zonaDeParte, crearCaso, crearReto, corregir, informeReferencia, TOPE_CRITICO } from '../practica/averias.js';

const CLAVE = 'averia:t3';
const minus = t => t.charAt(0).toLowerCase() + t.slice(1);
const LEDS = [['CPU', '#e5484d'], ['DRAM', '#ffd23f'], ['VGA', '#f4f1ea'], ['BOOT', '#3fbf6a']];
const SEGURIDAD = [
  ['apagar', 'Apagar y poner el interruptor de la fuente en 0'],
  ['desenchufar', 'Desenchufar y pulsar el botón unos segundos para descargar'],
  ['pulsera', 'Ponerme la pulsera antiestática'],
];

// Cómo se ve cada avería en el equipo: qué cable está suelto, a medio meter o en otro conector, y qué pieza está mal puesta.
// Las que no salen aquí (pila, separador, ajustes de la UEFI, polaridad de un LED) no se ven: hay que revisarlas.
const SE_VE = {
  powersw: { sueltos: ['frontal'] }, interruptor: { defectos: { interruptorCero: true } }, atx24: { medio: ['atx24'] },
  ram: { defectos: { ramSuelta: true } }, eps: { sueltos: ['eps'] }, gpu: { sueltos: ['pcie'] }, monitor: { video: 'placa' },
  cpufan: { cambia: { fancpu: 'chafan2' } }, disco: { sueltos: ['satad'] }, canal: { defectos: { ramJunta: true } }, calor: { defectos: { disipadorFlojo: true } },
};
// Zonas que se revisan mirando el 3D: al tocarlas no se dice cómo están
const ZONAS_VISIBLES = new Set(['fuente', 'atx24', 'eps', 'ram', 'gpu', 'video', 'disipador', 'disco']);
const ZONA_DE_CABLE = { atx24: 'atx24', eps: 'eps', pcie: 'gpu', satac: 'disco', satad: 'disco', fancpu: 'disipador', fancaja: 'disipador', frontal: 'fpanel' };
function zonaDe(parte) {
  if (!parte) return null;
  if (parte.startsWith('cable:')) return ZONA_DE_CABLE[parte.slice(6)];
  if (parte === 'video' || parte === 'monitor') return 'video';
  if (parte === 'chafan' || parte === 'chafan2') return 'disipador';
  return zonaDeParte(parte);
}

const reloj = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

// Con «reto» (un número), es el reto de clase: cinco equipos iguales para todos, sin informe y con cronómetro
export function vistaAveria(reto = null) {
  let caso, estado, anterior = null;
  const casosReto = reto ? crearReto(reto) : null;
  let turno = 0, inicio = 0, fin = 0, tic = null;
  const notas = [];
  const marcador = h('p.av-marcador');
  const pintaMarcador = () => { if (reto) marcador.textContent = `Reto ${reto} · Equipo ${Math.min(turno + 1, casosReto.length)} de ${casosReto.length} · ${reloj((fin || Date.now()) - inicio)}`; };
  let equipo = null, pulso = null, arrancando = false;
  const visor = huecoVisor({ pista: 'Arrastra para girar · rueda para acercar · mira primero; toca una pieza para revisarla', alTocar: parte => revisar(parte) });
  const panel = h('div.av-panel');
  const el = h('section.averia',
    h('span.etiqueta', reto ? 'Reto de clase · Tema 3 · no cuenta para nota' : 'Práctica · Tema 3 · no cuenta para nota'), h('h1', reto ? 'Reto: cinco equipos que no van bien' : 'Este PC no arranca'),
    reto ? marcador : null,
    h('p.lead', { style: 'color:var(--tinta-2);font-size:19px;max-width:66ch;margin:6px 0 18px' }, 'Un equipo recién montado que no funciona bien. Mira el síntoma, piensa en qué paso del arranque falla, prepárate con seguridad, revisa el equipo en 3D y di qué está mal montado.'),
    h('div.av-rejilla', h('div.av-visor', visor.el), panel),
    reto ? null : h('form.av-reto', { onsubmit: e => { e.preventDefault(); const n = parseInt(e.target.elements.n.value, 10); if (n > 0) location.hash = '#/tema3/reto/' + n; } },
      h('b', 'Reto de clase'), h('span', 'Escribe el número que diga el profesor: a toda la clase le salen los mismos cinco equipos.'),
      h('input', { name: 'n', type: 'number', min: '1', max: '99999', required: true, placeholder: 'Número', 'aria-label': 'Número del reto' }),
      h('button.btn.sec', { type: 'submit' }, 'Empezar el reto')));

  function nuevo() {
    caso = reto ? casosReto[turno] : crearCaso(Math.floor(Math.random() * 2147483647), { excluir: anterior });
    // Para preparar una clase o comprobar una avería: ?averia=ram delante de la almohadilla fuerza ese caso
    const pedida = !reto && new URLSearchParams(location.search).get('averia');
    if (pedida) for (let i = 1; i < 4000 && caso.fallo.id !== pedida; i++) caso = crearCaso(i);
    anterior = caso.fallo.id;
    estado = { fase: null, seguridad: new Set(), seguridadAntes: null, revisadas: [], registro: [], causa: null, corregido: null, avisoSeguridad: false, informe: {} };
    const v = visor.iniciar();
    if (v) {
      const ve = SE_VE[caso.fallo.id] || {};
      equipo = crearEquipo({ conGpu: caso.conGpu, m2: false, defectos: ve.defectos || {}, video: ve.video || (caso.conGpu ? 'gpu' : 'placa') });
      const conex = { atx24: 'atx24', eps: 'eps', satac: 'disco', satad: 'sata1', fancpu: 'cpufan', fancaja: 'chafan', frontal: 'fpanel', ...(caso.conGpu ? { pcie: 'gpu' } : {}), ...(ve.cambia || {}) };
      for (const c of ve.sueltos || []) delete conex[c];
      equipo.poner(conex, { medio: ve.medio || [] });
      v.mostrar(equipo.modelo, { vista: 'frente' });
      if (new URLSearchParams(location.search).has('averia')) window.__visor = v;
    }
    // el equipo que «se enciende un segundo y se apaga» lo hace de verdad al cargar
    clearTimeout(pulso); arrancando = caso.fallo.id === 'separador';
    if (arrancando) pulso = setTimeout(() => { arrancando = false; ambientar(); }, 1400);
    visor.rotulo('');
    pintar();
  }

  function revisar(parte) {
    if (!caso || estado.corregido) return;
    revisarZona(zonaDe(parte));
  }
  // También se puede elegir de la lista: se ilumina en el 3D dónde está
  function revisarZona(zona, desdeLista = false) {
    if (!zona) { visor.rotulo(''); return; }
    const z = ZONAS[zona];
    if (desdeLista && visor.visor && z.partes.length) visor.visor.resaltar(z.partes[0]);
    visor.rotulo(z.nombre);
    if (estado.seguridad.size < SEGURIDAD.length) {
      // tocar dentro sin prepararse: aviso y cuenta como fallo de seguridad
      estado.avisoSeguridad = true;
      if (estado.seguridadAntes === null) estado.seguridadAntes = false;
      pintar();
      return;
    }
    if (estado.seguridadAntes === null) estado.seguridadAntes = true;
    let texto = z.bien; const mal = zona === caso.fallo.zona;
    if (ZONAS_VISIBLES.has(zona)) texto = 'Lo tienes delante: gira el equipo, acércate y mira cómo está.';
    else if (zona === 'fpanel') texto = (caso.fallo.id === 'pled' ? caso.fallo.mal : 'En los cables de los LED, el hilo + está en la patilla + del manual.') + ' Si los cables están puestos o no, míralo en el 3D.';
    else if (mal) texto = caso.fallo.mal;
    if (!estado.revisadas.includes(zona)) { estado.revisadas.push(zona); estado.registro.push({ zona, texto, mal }); }
    pintar();
  }

  // Pone el 3D y el monitor como dice el síntoma. Al apagar o desenchufar (paso 2), el equipo se para.
  function ambientar() {
    if (!equipo) return;
    const f = caso.fallo;
    const enchufado = !estado.seguridad.has('apagar') && !estado.seguridad.has('desenchufar');
    const giran = enchufado && (f.ventiladores || arrancando);
    equipo.ambientar(giran ? {
      giran: { fuente: true, disipador: true, caja: true, grafica: caso.conGpu && f.id !== 'gpu' },
      led: f.led, luz: f.id !== 'pled', pantalla: arrancando ? 'Apagada' : f.pantalla,
    } : null);
  }

  function pintar() {
    ambientar();
    const f = caso.fallo;
    const leds = h('div.av-leds', LEDS.map(([n, c]) => h('span' + (f.led === n ? '.on' : ''), { style: `--led:${c}` }, h('i'), n)));
    const ficha = h('div.tarjeta.av-ficha',
      h('span.etiqueta', caso.equipo), h('h2', 'Lo que pasa'), h('p', f.sintoma),
      h('p.av-nota', 'El equipo está encendido ahora mismo. Míralo en el 3D: los ventiladores, el monitor, la luz del frontal y los LED de la placa, junto al conector de 24 pines.'));

    // 1. Fase
    const fase = h('div.tarjeta.av-paso', h('h3', '1 · ¿En qué paso del arranque falla?'),
      h('div.av-opciones', Object.entries(FASES).map(([id, txt]) => h('button.opcion' + (estado.corregido ? (f.fase.includes(id) ? '.ok' : estado.fase === id ? '.ko' : '') : estado.fase === id ? '.elegida' : ''),
        { type: 'button', disabled: !!estado.corregido, onclick: () => { estado.fase = id; pintar(); } }, txt))),
      estado.corregido ? h('p.explicacion', { html: (f.fase.includes(estado.fase) ? '<b>Bien.</b> ' : '<b>No era ese.</b> ') + md(explicaFase(f)) }) : null);

    // 2. Seguridad
    const seg = h('div.tarjeta.av-paso' + (estado.fase ? '' : '.bloqueado'), h('h3', '2 · Antes de abrir la caja'),
      h('div.av-seguridad', SEGURIDAD.map(([id, txt]) => h('button.av-check' + (estado.seguridad.has(id) ? '.hecho' : ''),
        { type: 'button', disabled: !estado.fase || estado.seguridad.has(id) || !!estado.corregido, onclick: () => { estado.seguridad.add(id); estado.avisoSeguridad = false; pintar(); } },
        h('span', estado.seguridad.has(id) ? '✓' : ''), txt))),
      estado.avisoSeguridad ? h('p.mensaje.error', '¡Alto! Has ido a tocar dentro sin prepararte: es un fallo crítico y este equipo ya no pasa de un 4. Apaga, interruptor en 0, desenchufa, descarga y ponte la pulsera.') : null);

    // 3. Revisar
    const listo = estado.seguridad.size === SEGURIDAD.length;
    const rev = h('div.tarjeta.av-paso' + (listo ? '' : '.bloqueado'), h('h3', '3 · Mira y revisa el equipo'),
      h('p.av-nota', listo ? 'Gira el equipo y acércate: lo que está mal montado se ve. Toca una pieza para revisarla con las manos (o elígela de la lista): algunas cosas no se ven y hay que medirlas o leerlas, como la pila, los separadores o la hoja de montaje. Nadie te va a decir cuál es el fallo.' : 'Primero, el paso 2.'),
      h('div.av-zonas', Object.entries(ZONAS).map(([id, z]) => h('button.chip' + (estado.revisadas.includes(id) ? '.ok' : ''), { type: 'button', disabled: !!estado.corregido, onclick: () => revisarZona(id, true) }, z.nombre))),
      estado.registro.length ? h('ol.av-registro', estado.registro.map(r => h('li' + (r.mal && estado.corregido ? '.mal' : ''), h('b', ZONAS[r.zona].nombre + ': '), r.mal && estado.corregido ? caso.fallo.mal : r.texto))) : null);

    // 4. Diagnóstico
    const diag = h('div.tarjeta.av-paso' + (estado.registro.length ? '' : '.bloqueado'), h('h3', '4 · ¿Qué está mal?'),
      h('div.av-opciones', caso.causas.map(c => h('button.opcion' + (estado.causa === c.id ? '.elegida' : '') + (estado.corregido ? (c.id === f.id ? '.ok' : estado.causa === c.id ? '.ko' : '') : ''),
        { type: 'button', disabled: !estado.registro.length || !!estado.corregido, onclick: () => { estado.causa = c.id; pintar(); } }, c.texto))),
      );

    // 5. Informe de montaje
    const listoInforme = () => !!estado.causa && (!!reto || informeCompleto(estado.informe));
    const bComprobar = h('button.btn.azul', { type: 'button', disabled: !listoInforme(), onclick: () => comprobar() }, 'Comprobar');
    const inf = h('div.tarjeta.av-paso' + (estado.registro.length ? '' : '.bloqueado'), h('h3', '5 · Escribe el informe'),
      h('p.av-nota', 'Lo que irá en el informe de montaje: qué pasaba, qué has revisado, cuál era la causa y cómo se arregla.'),
      informeAlumno(estado.informe, { bloqueado: !estado.registro.length || !!estado.corregido, alCambiar: () => { bComprobar.disabled = !listoInforme(); } }),
      !estado.corregido ? bComprobar : null);

    const partes = reto ? [ficha, fase, seg, rev, diag, estado.corregido ? null : h('div', bComprobar)].filter(Boolean) : [ficha, fase, seg, rev, diag, inf];
    if (estado.corregido) partes.push(resultado());
    panel.replaceChildren(...partes);
  }

  function explicaFase(f) {
    const txt = {
      fuente: 'Si **no pasa nada** (o se enciende y se apaga enseguida), la fuente no llega a arrancar o se corta: enchufe, interruptor, 24 pines, POWER SW o un cortocircuito.',
      post: 'Si **los ventiladores giran** pero no hay imagen, o sale un aviso al arrancar, el fallo está en el **POST**: memoria, EPS, gráfica, monitor o ventilador del procesador.',
      arranque: 'Si pasa el POST pero dice que **no encuentra con qué arrancar**, el fallo está en la búsqueda del arranque: disco, orden de arranque o sistema.',
      despues: 'Si **arranca y funciona**, el fallo no está en el arranque: sale después, al comprobar el equipo en la UEFI, en Windows o con una utilidad (velocidad y canales de la memoria, temperatura, TPM, luces del frontal).',
      reposo: 'Si **funciona** pero pierde la fecha y la hora al desenchufarlo, el fallo está en lo que guarda la placa en **reposo**: la pila.',
    };
    return f.fase.map(x => txt[x]).join(' ');
  }

  function comprobar() {
    estado.corregido = corregir(caso, { fase: estado.fase, seguridadAntes: !!estado.seguridadAntes, revisadas: estado.revisadas, causa: estado.causa, informe: reto ? null : estado.informe });
    if (reto) { notas[turno] = estado.corregido.nota; if (turno === casosReto.length - 1) { fin = Date.now(); clearInterval(tic); pintaMarcador(); } }
    else progreso.anotarPractica({ tema: 'tema3', tipo: CLAVE, nota: estado.corregido.nota });
    const v = visor.visor;
    if (v && ZONAS[caso.fallo.zona].partes.length) v.resaltar(ZONAS[caso.fallo.zona].partes[0]);
    visor.rotulo('Aquí estaba el fallo: ' + ZONAS[caso.fallo.zona].nombre);
    pintar();
  }

  function resultado() {
    const r = estado.corregido, p = r.puntos, f = caso.fallo;
    const fila = (ok, txt) => h('li' + (ok ? '.ok' : '.ko'), ok ? '✓ ' : '✗ ', txt);
    return h('div.tarjeta.av-resultado',
      h('h3', `Resultado: ${r.nota.toLocaleString('es-ES')} / 10`),
      r.criticos.length ? h('p.mensaje.error', h('b', `Fallo crítico: la nota no pasa de ${TOPE_CRITICO}. `), r.criticos.join(' ')) : null,
      h('ul.av-puntos',
        fila(p.fase, p.fase ? 'Has acertado en qué paso del arranque falla.' : 'El paso del arranque no era ese: ' + f.fase.map(x => FASES[x]).join(' o ') + '.'),
        fila(p.seguridad, p.seguridad ? 'Te has preparado con seguridad antes de tocar nada.' : 'Has intentado tocar dentro sin apagar, desenchufar y ponerte la pulsera.'),
        fila(p.zona, p.zona ? 'Has revisado donde estaba el fallo.' : 'No has revisado: ' + minus(ZONAS[f.zona].nombre) + '.'),
        fila(p.causa, p.causa ? 'Diagnóstico correcto.' : 'El fallo era: ' + minus(f.causa) + '.'),
        ...(r.informe ? [['incidencia', 'Informe · incidencia'], ['comprobaciones', 'Informe · qué has comprobado'], ['causa', 'Informe · causa'], ['solucion', 'Informe · solución']]
          .map(([id, txt]) => fila(r.informe.campos[id].ok, r.informe.campos[id].ok ? txt + ': vale.' : txt + ': ' + minus(r.informe.campos[id].porque))) : [])),
      r.informe ? h('p.av-nota', 'El informe lo corrige la web buscando si cada apartado nombra lo que tiene que nombrar. Si crees que el tuyo está bien y te lo ha dado por malo, enséñaselo al profesor.') : null,
      h('p', h('b', 'Solución: '), f.solucion),
      reto ? null : informeComparado(estado.informe, informeReferencia(caso)),
      h('p.av-nota', `Has revisado ${estado.revisadas.length} ${estado.revisadas.length === 1 ? 'zona' : 'zonas'}. Un técnico empieza por lo más sencillo y por lo que señalan el síntoma y los LED.`),
      !reto ? h('button.btn.azul', { type: 'button', onclick: () => { nuevo(); el.scrollIntoView({ behavior: 'smooth' }); } }, 'Otro equipo')
        : turno < casosReto.length - 1 ? h('button.btn.azul', { type: 'button', onclick: () => { turno++; pintaMarcador(); nuevo(); el.scrollIntoView({ behavior: 'smooth' }); } }, `Siguiente equipo (${turno + 2} de ${casosReto.length})`)
        : finalReto());
  }

  function finalReto() {
    const media = Math.round(notas.reduce((a, b) => a + b, 0) / notas.length * 10) / 10;
    return h('div.av-final',
      h('h3', `Reto ${reto} terminado`),
      h('p.av-final-nota', h('b', media.toLocaleString('es-ES') + ' / 10'), ' en ', h('b', reloj(fin - inicio))),
      h('ol', casosReto.map((c, i) => h('li', `${c.fallo.causa}: `, h('b', notas[i].toLocaleString('es-ES'))))),
      h('p.av-nota', 'Enséñale esta pantalla al profesor. Gana quien tenga más nota; si hay empate, quien haya tardado menos. Con un fallo crítico, ese equipo no pasa de un 4.'),
      h('a.btn.sec', { href: '#/tema3/practica' }, 'Volver a la práctica'));
  }

  return { el, montado() { if (reto) { inicio = Date.now(); pintaMarcador(); tic = setInterval(pintaMarcador, 1000); } nuevo(); }, destruir() { clearInterval(tic); clearTimeout(pulso); visor.destruir(); } };
}
