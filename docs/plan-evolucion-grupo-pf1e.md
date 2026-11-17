# Evolución de Bard Companion: grupo y hojas PF1e

## Objetivo

Evolucionar la app actual para que 3–4 personas puedan tener cuentas y fichas de personajes independientes, conservarlas entre dispositivos y administrarlas durante la campaña. La aplicación seguirá enfocada en Pathfinder 1e y d20PFSRD seguirá siendo la referencia de reglas acordada.

## Estado actual observado

- La app es una PWA estática de un solo archivo (`index.html`) publicada en GitHub Pages.
- Los datos se guardan en `localStorage`: solo existen en ese navegador y dispositivo.
- El estado ya contiene una colección `characters`, pero solo se edita un perfil activo.
- El grimorio, los espacios gastados y el descanso diario siguen siendo globales, por lo que varios personajes compartirían esos datos.
- La progresión automática está implementada para el bardo base. No hay todavía fichas generales, habilidades, dotes ni equipo.

## Arquitectura recomendada

- **Interfaz y código:** mantener el repositorio como fuente de verdad y GitHub Pages como alojamiento del frontend mientras alcance.
- **Backend:** Supabase Auth + Postgres para cuentas y datos persistentes. La clave pública del cliente puede estar en el frontend; las claves administrativas nunca.
- **Autorización:** cada ficha pertenece a una cuenta. Dejar preparado un modelo de campaña con miembros y permisos para compartir fichas más adelante, sin hacer públicas las fichas por defecto.
- **Catálogo:** separar reglas compartidas de las elecciones y estados particulares de cada personaje. Guardar nombre, nivel, categoría, fuente y URL d20PFSRD; precargar solo el contenido que la app realmente necesite.
- **Persistencia desacoplada:** definir una capa de acceso a datos para que la interfaz no dependa directamente de `localStorage` o de Supabase. Permite conservar modo local/respaldo y cambiar de backend sin reescribir pantallas.

## Modelo inicial de datos

- `profiles`: identidad de usuario y preferencias.
- `campaigns` y `campaign_members`: grupo y membresías, preparados para compartir.
- `characters`: dueño, nombre, ascendencia, alineamiento, nivel total, PG actuales/máximos, atributos, tamaño, velocidad y estado.
- `character_classes`: clase y nivel por clase para permitir multiclase más adelante.
- `character_skills`: rangos, habilidad de clase y modificadores manuales explicados.
- `character_feats` y `character_traits`: elecciones y anotaciones por ficha.
- `character_spells`: conjuros conocidos/preparados y metadatos de regla por personaje.
- `spell_slots`: espacios totales/usados por personaje y nivel; descanso afecta solo al personaje seleccionado.
- `character_inventory`: cantidad, peso, precio, espacio, equipado y notas.
- `catalog_* `: clases, habilidades, dotes, conjuros, armas, armaduras e ítems disponibles para buscar.

Los totales derivados (ataque, CA, salvaciones, CD, carga) deberían calcularse desde atributos, progresión y equipo, mostrando el desglose para poder corregir excepciones o reglas caseras.

## Etapas propuestas

### 0. Preparación técnica

1. Modularizar el archivo monolítico en componentes de interfaz, reglas, estado y persistencia.
2. Definir el esquema de personaje y una capa de almacenamiento.
3. Crear migración de `schema:1` que convierta los datos existentes en un primer personaje sin perder grimorio ni espacios gastados.
4. Mantener respaldo JSON compatible durante la transición.

### 1. Fichas múltiples y datos separados

1. Crear, seleccionar, renombrar, duplicar, archivar y borrar personajes.
2. Mover perfil, grimorio, espacios, descanso y preferencias a cada personaje.
3. Mantener los conjuros y el estado actuales en el personaje migrado.
4. Incorporar fichas completas de habilidades, dotes y rasgos, inicialmente con edición guiada/manual.

### 2. Cuentas y sincronización

1. Añadir registro e inicio de sesión.
2. Persistir fichas en Postgres y aplicar políticas de acceso por propietario.
3. Incorporar exportación/importación y recuperación ante errores de sincronización.
4. Habilitar espacios de campaña e invitaciones solo cuando definamos si el grupo necesita ver o editar fichas ajenas.

### 3. Equipo y reglas

1. Registrar inventario, armas y armaduras; marcar equipo equipado.
2. Calcular primero CA, iniciativa, ataques, daño, salvaciones, carga y modificadores de habilidad.
3. Añadir bonificadores de objetos y excepciones con un desglose visible.
4. Vincular cada registro consultable a su ficha de d20PFSRD.

### 4. Subida de nivel

1. Crear un flujo que muestre las elecciones debidas según clase y nivel.
2. Confirmar con el jugador cada elección antes de aplicar el nuevo nivel.
3. Actualizar PG, ataque base, salvaciones, habilidades, dotes, rasgos y progresión de conjuros.
4. Añadir multiclase y arquetipos tras cubrir las clases que use el grupo.

## Alcance recomendado para la primera versión compartida

- Cuentas para el grupo y fichas privadas por usuario.
- Personajes múltiples con inventario básico, atributos, habilidades, dotes y conjuros.
- Equipo equipado con cálculos iniciales de CA, ataques y salvaciones.
- Subida de nivel guiada para las clases que jueguen en la campaña.
- Campañas compartidas como siguiente iteración si quieren que otros jugadores o el director de juego accedan a una ficha.

## Criterios para avanzar

- Ningún personaje comparte grimorio, espacios, equipo o progreso con otro.
- La migración conserva todos los datos del bardo actual.
- Una cuenta solo puede leer y modificar fichas autorizadas.
- Se puede exportar una ficha y restaurarla.
- Los cálculos muestran sus componentes y las reglas especiales pueden anotarse.

## Decisiones aún abiertas

- Qué clases juegan las 3–4 personas y si necesitan multiclase desde el inicio.
- Si cada ficha será privada, visible al grupo o visible solo al director de juego.
- Si quieren crear un grupo/campaña compartida o solo usar cuentas individuales.
- Qué versión de la ficha PF1e será el formato objetivo.

Estas decisiones no bloquean la preparación técnica ni el modelo de datos. Antes de conectar usuarios reales se debe configurar y revisar el backend y sus políticas de acceso.
