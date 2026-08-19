/**
 * Fundido al cambiar de sección.
 *
 * Va en `template.tsx` y no en `layout.tsx` porque Next vuelve a montar el
 * template en cada navegación, que es justo lo que reinicia la animación; un
 * layout se conserva y no se animaría nada.
 *
 * Se hace con una animación CSS y no con la View Transitions API porque esa API
 * no existe en los navegadores de las televisiones viejas, que son el destino
 * principal de esta app. Así la transición se ve donde se puede y donde no,
 * simplemente aparece la página, sin romper nada.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="app-fade">{children}</div>;
}
