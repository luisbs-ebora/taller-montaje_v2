# Taller de Montaje · prototipo cartoon

Prueba de estilo: una sola escena con la placa base y 8 pasos de montaje animados.
No depende de nada de la web principal ni de Google.

## Subirlo a GitHub Pages (repositorio aparte)

1. Crea un repositorio público nuevo, por ejemplo `montaje-cartoon`.
2. Sube **el contenido de esta carpeta** a la raíz del repositorio. `index.html` tiene que quedar en la raíz. Incluye también el archivo oculto `.nojekyll`.
3. Ve a **Settings > Pages** y elige *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
4. En unos minutos estará en `https://tuusuario.github.io/montaje-cartoon/`.

## Qué probar

- Haz clic en las piezas: dan un salto, se marcan en naranja y aparece su ficha. Con doble clic se montan directamente.
- Haz los pasos en desorden:
  - El procesador sin la pulsera puesta: la pieza tiembla y sale un aviso.
  - El cable de corriente antes de tiempo: salta un chispazo.
- Monta todo: al enchufar, se encienden los ventiladores, el LED de la placa y la RAM, y cae confeti.
- Ábrelo en un PC del aula para ver si va fluido.

## Archivos

| Archivo | Qué es |
|---|---|
| `assets/js/toon.js` | El estilo: sombreado por bandas y contorno negro |
| `assets/js/piezas.js` | Las piezas y la animación de montaje de cada una |
| `assets/js/app.js` | Escena, cámara, clics, avisos y efectos |
| `assets/js/anim.js` | Animaciones con curvas de rebote, muelle, etc. |
| `assets/vendor/three/` | three.js 0.169 (licencia MIT) |

Todas las piezas están hechas con código. No hay modelos descargados, así que no hay créditos ni licencias de terceros aparte de three.js.
