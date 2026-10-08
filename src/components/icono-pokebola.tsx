import type { SVGProps } from "react";

/**
 * Una Pokébola con el trazo de los iconos de Lucide (24 × 24, 2 px,
 * `currentColor`), para que en la barra no se distinga de sus vecinos.
 * Lucide no la trae.
 */
export function IconoPokebola(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h7m6 0h7" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
