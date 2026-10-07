/**
 * Marcador del mismo tamaño mientras carga el reproductor. Evita el salto.
 *
 * Vive en archivo propio y no en `live-card.tsx`: `dashboard.tsx` lo importa
 * de forma ESTÁTICA como `loading` del `dynamic()` de `LiveCard`, y si
 * viviera en ese módulo arrastraría `StreamPlayer` y los motores de vídeo al
 * bundle inicial —anulando el `dynamic` que los aparta—.
 */
export function LiveCardSkeleton() {
  return (
    <section className="live-card" aria-hidden="true">
      <div className="live-card-marco">
        <div className="live-card-video is-cargando" />
      </div>
    </section>
  );
}
