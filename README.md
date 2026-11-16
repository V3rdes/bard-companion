# Bard Companion — Pathfinder 1e

App estática y gratuita para seguir los conjuros conocidos y los espacios diarios de un bardo de Pathfinder 1e. Diseñada para celulares; también funciona sin conexión después de la primera visita (PWA).

## Funciones

- Grimorio precargado con **14 conjuros** del bardo nivel 6, CAR 20.
- Descripciones explicativas propias en español; cada ficha abre una búsqueda del conjuro en **d20PFSRD**, la fuente de reglas utilizada por la app.
- Seguimiento de espacios gastados por nivel, botones para usar/recuperar y descanso diario.
- Subida a nivel 7 (o cualquier nivel 1–20): calcula slots del bardo base y bonificaciones por Carisma, sin borrar conjuros.
- Aviso de conjuros conocidos pendientes según la progresión de bardo consultada en d20PFSRD (nivel 7: un conjuro nuevo de nivel 1 y dos de nivel 3).
- Agregar conjuros desde una selección rápida o manualmente; el catálogo completo de bardo se consulta en d20PFSRD. Editar descripciones/atributos, consultar y eliminar.
- Filtros, búsqueda, exportar/importar un respaldo JSON.
- Sin cuentas, sin anuncios, sin servidor ni base de datos externa. Persiste en localStorage en el mismo navegador/dispositivo.

## Publicación gratis en GitHub Pages

1. Crear un repositorio público de GitHub llamado `bard-companion`.
2. Subir estos archivos a la raíz de la rama principal (`index.html`, `icon.svg`, `manifest.webmanifest`, `sw.js`, `README.md`).
3. En Settings > Pages, elegir **Deploy from a branch** > rama principal / (root) y guardar.
4. Tras la publicación, la app quedará accesible en una dirección del tipo `https://USUARIO.github.io/bard-companion/` (la URL exacta debe verificarse tras desplegar).
5. Abrir desde Chrome o Safari en el celular; en el menú elegir **Agregar a pantalla de inicio**.

## Desarrollo local

No requiere Node ni instalar dependencias. Para probar PWA localmente, servir la carpeta con un servidor HTTP, por ejemplo `python -m http.server 8000` y abrir `http://localhost:8000`. El HTML también puede abrirse directamente, aunque el modo PWA offline requiere HTTP(S).

## Precauciones y próximas mejoras

- Los datos **no se sincronizan** entre dispositivos. Usar exportación/importación JSON para transferirlos. Limpiar los datos del navegador puede borrarlos.
- De cara a múltiples personajes/jugadores: datos separados de la vista y estructura `characters`, preparado para extender con IDs y cuentas; sincronización requerirá otro almacenamiento.
- El selector de la app es una selección breve, no una base completa ni una consulta en vivo. Para revisar el listado completo, usar [Bard Spells en d20PFSRD](https://www.d20pfsrd.com/magic/spell-lists-and-domains/spell-lists-bard/); luego se puede agregar el conjuro por nombre. d20PFSRD incluye una lista separada de conjuros de terceros.
- Las descripciones son resúmenes didácticos propios, no copias textuales. d20PFSRD es la única referencia de reglas enlazada por esta app.
- La CD se calcula como 10 + nivel del conjuro + modificador CAR, +1 para conjuro de Encantamiento con salvación si se activa Spell Focus. No se suma automáticamente a otros tipos de conjuros.
- Se asume **bardo base** sin modificaciones de arquetipos, objetos o reglas caseras en cantidad de espacios diarios.

## Licencia y atribución

Código de ejemplo de uso personal; no contiene arte ni texto oficial copiado en bloque. Pathfinder es marca de Paizo Inc.; este proyecto es no oficial y no está afiliado con Paizo.
