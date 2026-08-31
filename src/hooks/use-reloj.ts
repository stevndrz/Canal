"use client";

import { useEffect, useState } from "react";

/**
 * La hora, en el formato de casa.
 *
 * Estaba escrito dos veces —en `dashboard.tsx` y en `top-nav.tsx`— con el
 * mismo `toLocaleTimeString` y el mismo intervalo. Duplicar esto no rompe
 * nada, pero significa que cambiar el formato exige acordarse de los dos
 * sitios, y el segundo se olvida.
 *
 * Se refresca cada 20 segundos y no cada segundo: solo se enseñan horas y
 * minutos, así que despertar sesenta veces por minuto para pintar lo mismo es
 * batería tirada en un teléfono.
 *
 * Empieza vacío a propósito. El servidor y el navegador están en husos
 * distintos, así que pintar una hora en el render de servidor haría saltar un
 * aviso de hidratación —y enseñaría la hora equivocada durante un instante.
 */
export function useReloj(): string {
  const [hora, setHora] = useState("");

  useEffect(() => {
    const actualizar = () =>
      setHora(new Date().toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" }));

    actualizar();
    const temporizador = setInterval(actualizar, 20_000);
    return () => clearInterval(temporizador);
  }, []);

  return hora;
}

/**
 * El mismo reloj, pero en milisegundos.
 *
 * Lo pide la parrilla: para colocar la línea del «ahora» y saber qué bloque
 * está en emisión hace falta el instante, no la hora ya formateada. Va aquí y
 * no en un hook aparte para que las dos formas de mirar la hora compartan
 * cadencia; dos temporizadores distintos despertando el televisor por lo mismo
 * es exactamente lo que `useReloj` vino a evitar cuando estaba duplicado.
 *
 * Empieza en `0` por el mismo motivo que el otro empieza vacío: el instante del
 * servidor no es el del navegador, y quien lo consuma debe poder distinguir
 * «todavía no se sabe» de una hora de verdad.
 */
export function useInstante(): number {
  const [instante, setInstante] = useState(0);

  useEffect(() => {
    const actualizar = () => setInstante(Date.now());

    actualizar();
    const temporizador = setInterval(actualizar, 20_000);
    return () => clearInterval(temporizador);
  }, []);

  return instante;
}
