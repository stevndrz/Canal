# Numeración de canales

> **Estado: APLICADA** (2026-10-08, opción A, aprobada por el dueño). Código
> en `src/lib/numeracion.ts`. Con la lista por defecto: 0 números repetidos
> (antes 885) y todas las regiones dentro de su bloque. Un detalle respecto a
> la tabla de abajo: el orden por nombre es «natural» (Canal 13 antes que
> Canal 100), así que algunos números de Guatemala cambian de sitio entre sí.

## Por qué cambiarla

Hoy el número sale de la centena de la **categoría de numeración**
(Guatemala 1xx, Deportes 2xx, Noticias 3xx…) más el orden dentro de ella.
Con la lista por defecto (4.816 canales) eso tiene un fallo grave:

- **885 números están repetidos.** Las categorías con más de 99 canales se
  desbordan a la centena siguiente: Noticias llega al 928 y pisa a
  Películas (4xx), Documentales (5xx), Infantil (6xx)…; Internacional va
  del 1201 al 3467. Marcar «826» puede llevar a dos canales distintos, y el
  marcado se queda con el primero.
- Los de Guatemala son 101-127 en vez de su número de siempre (Canal 3 =
  101, Canal 7 = 102).
- Un canal nuevo en la lista corre el número de todos los de detrás en su
  categoría.

Los favoritos ya no dependen del número ni de la posición (van por clave
estable, ver `claves-canal.ts`), así que renumerar ya no rompe nada guardado.

## La propuesta

1. **Fijos a mano** para los que la familia marca: el número de la tele de
   siempre. Nunca cambian, pase lo que pase con la lista.
2. **Bloques por región**, en el mismo orden que las secciones de Canales,
   con hueco de sobra para crecer y sin pisarse.
3. Dentro de cada bloque, **orden alfabético**.

| Bloque | Números | Canales hoy | ¿Cabe? |
|---|---|---|---|
| Guatemala (fijos) | 1–29 | 4 | sí |
| Guatemala (el resto) | 30–99 | 23 | sí |
| Centroamérica | 100–299 | 103 | sí |
| México | 300–499 | 79 | sí |
| Caribe | 500–799 | 176 | sí |
| Sudamérica | 1000–1999 | 527 | sí |
| España | 2000–2499 | 124 | sí |
| Estados Unidos | 3000–4999 | 759 | sí |
| Resto del mundo | 5000–8999 | 2455 | sí |
| Sin país | 9000–9999 | 566 | sí |

El marcado admite hasta 4 cifras (`MAX_DIGITOS`), así que todo cabe.

### Guatemala, completa

| Nuevo | Canal | Hoy |
|---:|---|---:|
| **3** | Canal 3 | 101 |
| **7** | Canal 7 | 102 |
| **23** | TN23 | 104 |
| **25** | Guatevision | 103 |
| **30** | Amigos TV Chiquimula | 105 |
| **31** | Aurora Media Films | 106 |
| **32** | Canal 9 Barbe TV | 107 |
| **33** | Canal 13 Esquipulas | 108 |
| **34** | Canal 30 TV Bethel | 109 |
| **35** | Canal 100 Chinique | 110 |
| **36** | Canal TV Radio Maya TGBA | 111 |
| **37** | Conectados con Dios | 112 |
| **38** | MAS TV | 113 |
| **39** | MCN Television | 114 |
| **40** | Nim TV | 115 |
| **41** | Nuestra Imagen TV | 116 |
| **42** | Peniel Kids & Young | 117 |
| **43** | Peniel Musical | 118 |
| **44** | Peniel TV Biblia Abierta | 119 |
| **45** | Radio Coatan Canal 21 | 120 |
| **46** | Rhema TV | 121 |
| **47** | Sol TV | 122 |
| **48** | Telecosta | 123 |
| **49** | TV Florencia | 124 |
| **50** | TV Maya | 125 |
| **51** | TVS Retro | 126 |
| **52** | Visión TV | 127 |

Fijos: Canal 3 = 3, Canal 7 = 7, TN23 = 23, Guatevisión = 25 (su canal UHF).
Queda hueco del 1 al 29 para añadir más (Canal 11, Canal 13, Azteca…) cuando
aparezcan en la lista.

### Centroamérica (primeros 15 de 103)

| Nuevo | Canal | Hoy |
|---:|---|---:|
| 100 | ¡OPA! | 901 |
| 101 | 360 RFTV | 1225 |
| 102 | Agape TV | 826 |
| 103 | Alsacias Televisión (ATV / Canal 28) | 1326 |
| 104 | Antena Seis TV | 1356 |
| 105 | AZA TV | 1397 |
| 106 | Azteca Honduras | 1399 |
| 107 | BestClasicosTV | 1432 |
| 108 | Buendia TV | 440 |
| 109 | Campus TV | 523 |
| 110 | Canal 1 | 1512 |
| 111 | Canal 3 Impresionante | 1520 |
| 112 | Canal 3 KMK TV | 742 |
| 113 | Canal 10 | 1542 |
| 114 | Canal 11 TuTV | 1545 |

## Lo que hay que decidir: estable o alfabético

«Que no cambie cada vez que cambia la lista» tiene dos lecturas:

- **A (recomendada): fijos + alfabético por bloque.** Los fijos no cambian
  nunca. El resto se ordena por nombre dentro de su bloque, así que un canal
  nuevo de Sudamérica que empiece por «A» corre en uno los de detrás **de
  Sudamérica** — nunca los de otro bloque, y nunca los fijos. Los números
  se leen en orden en las listas.
- **B: número por huella del nombre.** Cada canal cae en una casilla de su
  bloque según una huella de su clave estable y solo se mueve si choca con
  uno nuevo. Más estable, pero los números salen salteados (Peniel = 73,
  Rhema = 41) y no siguen ningún orden visible.

Recomendación: **A**, ampliando la lista de fijos con los que de verdad se
marcan en casa.

## Cómo se aplicaría

Un cambio en `desempaquetarCanales` (cliente) que calcule el número con
`regionDe` + la tabla de fijos, en vez de con la categoría. Sin campos
nuevos en `Channel`: `number` ya existe. Pruebas: ningún repetido, los fijos
se respetan y un canal nuevo solo mueve los de su bloque.
