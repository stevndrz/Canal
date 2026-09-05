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
      <div className="live-card-marco border border-white/10 rounded-2xl overflow-hidden bg-zinc-900/60 backdrop-blur shadow-xl">
        <div className="live-card-video is-cargando hover:scale-105 transition-transform duration-200 border border-white/10" />
      </div>
    </section>
  );
}
