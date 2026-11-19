// cablea.js — Práctica «Cablea el equipo»: se coge un cable, se lleva a su conector y se enciende para ver qué pasa.
import { h, md } from '../util.js';
import { huecoVisor } from './comun.js';
import { crearEquipo } from '../equipo3d.js';
import { CABLES, DESTINOS, destinoDeParte, crearCaso, estadoInicial, cableEn, conectar, quitar, encender, apagar, explica, puntuar, solucion, TOPE_CRITICO } from '../practica/cablea.js';

const COLOR_CABLE = { atx24: 0x17191c, eps: 0x17191c, pcie: 0x17191c, satac: 0x17191c, satad: 0xc0392b, fancpu: 0x4a4f57, fancaja: 0x4a4f57, frontal: 0x9aa0a8 };

export function vistaCablea() {
  let caso, estado, sel = null, pendiente = null, ultimo = null, aviso = null;
  let equipo = null;
  const visor = huecoVisor({ pista: 'Arrastra para girar · rueda para acercar · toca la clavija de un cable para cogerlo y después su conector', alTocar: parte => tocar(parte) });
  const panel = h('div.av-panel');
  const el = h('section.av',
    h('span.etiqueta', 'Práctica · Tema 3 · no cuenta para nota'), h('h1', 'Cablea el equipo'),
    h('p.lead', 'Las piezas ya están montadas, pero falta conectar todos los cables. Coge un cable, llévalo a su conector y, cuando creas que está todo, enchufa y enciende.'),
    h('div.av-rejilla', h('div.av-visor', visor.el), panel));

  function ambientar() { if (equipo) equipo.ambientar(estado.enchufado ? ultimo : null); }
  function dibujarCables() { if (equipo) equipo.poner(estado.conex, { cogido: sel, forzados: estado.forzados }); }

  function nuevo() {
    caso = crearCaso(Math.floor(Math.random() * 2147483647));
    estado = estadoInicial(); sel = null; pendiente = null; ultimo = null; aviso = null;
    const v = visor.iniciar();
    if (v) { equipo = crearEquipo({ conGpu: caso.conGpu, m2: caso.m2 }); v.mostrar(equipo.modelo, { vista: 'frente' }); }
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
    if (!parte) { visor.rotulo(sel ? 'En la mano: ' + CABLES[sel].nombre : ''); return; }
    if (parte.startsWith('cable:')) { // una clavija: se coge; si estaba conectada, se saca
      const id = parte.slice(6);
      if (estado.terminado) return;
      if (estado.conex[id]) { soltar(id); if (!estado.conex[id]) { sel = id; aviso = ['info', `Has sacado y tienes en la mano: ${CABLES[id].nombre}.`]; } }
      else { sel = sel === id ? null : id; pendiente = null; aviso = null; }
      visor.rotulo(sel ? 'En la mano: ' + CABLES[sel].nombre : CABLES[id].nombre);
      pintar(); return;
    }
    const d = destinoDeParte(parte, caso);
    if (!d) { visor.rotulo(sel ? 'En la mano: ' + CABLES[sel].nombre : ''); return; }
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
      h('p.av-nota', 'Están sueltos dentro de la caja: toca su clavija en el 3D para cogerlo, o usa «Coger». Puede que sobre alguno: la fuente trae todos sus cables aunque el equipo no los necesite.'),
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
