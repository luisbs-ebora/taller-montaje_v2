// luces3d.js — Luces del equipo en 3D: LED de diagnóstico de la placa y luz de encendido del frontal.
import * as THREE from 'three';

// --- Lo que se ve en el equipo: ventiladores, LED de diagnóstico de la placa, luz del frontal y monitor ---
export const COLOR_LED = { CPU: 0xff3b30, DRAM: 0xffb020, VGA: 0xffffff, BOOT: 0x35d07f };
const luz = () => new THREE.MeshStandardMaterial({ color: 0x23262b, emissive: 0x000000, roughness: 0.4 });
export function ponerLuces(modelo) {
  const luces = {};
  let atx = null, cajaG = null;
  modelo.traverse(o => { if (!atx && o.userData.parte === 'atx24') atx = o; if (!cajaG && o.userData.tipo === 'caja') cajaG = o; });
  if (atx) ['CPU', 'DRAM', 'VGA', 'BOOT'].forEach((n, i) => {
    // cuatro LED en fila junto al conector de 24 pines, como en una placa real
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.35), luz());
    m.position.set(atx.position.x - 1.3, atx.position.y + 1.8 - i * 1.2, atx.position.z);
    m.userData.parte = atx.userData.parte;
    atx.parent.add(m); luces[n] = m;
  });
  if (cajaG) {
    const { P, A, W } = cajaG.userData;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), luz());
    m.position.set((P / 2 + 5) / 10, (A / 2 - 30) / 10, (W / 2 - 25) / 10);
    m.userData.noTocar = true;
    cajaG.add(m); luces.POWER = m;
  }
  return luces;
}
export const encender = (m, color) => { if (!m) return; m.material.emissive.setHex(color || 0x000000); m.material.emissiveIntensity = color ? 2.2 : 0; m.material.color.setHex(color || 0x23262b); };

