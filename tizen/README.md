# Empaquetado para Samsung Smart TV (Tizen)

La app se queda hospedada (Vercel) y el `.wgt` es solo un contenedor que abre
esa URL a pantalla completa. Se eligió así para no romper nada de lo que ya
funciona: el renderizado en servidor, el índice de logos y el endpoint del
Watch Party necesitan un servidor, y un paquete puramente estático no puede
ejecutarlos.

Ventaja añadida: al actualizar el despliegue, la TV ve la versión nueva sin
reinstalar el paquete.

## Requisitos

- [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download)
  con el *TV Extension* instalado.
- Un certificado de Samsung (se crea desde Tizen Studio: *Tools → Certificate
  Manager*). Sin él la TV rechaza el paquete.

## Pasos

1. Edita `config.xml` y pon tu URL real en `<content src="…"/>`.
2. Añade un `icon.png` de 512×512 en esta misma carpeta.
3. Empaqueta y firma:

   ```bash
   tizen package -t wgt -s <tu-perfil-de-certificado> -- .
   ```

4. Instala en la TV (debe estar en *Developer Mode*, con la IP del PC
   autorizada):

   ```bash
   sdb connect <IP-DE-LA-TV>
   tizen install -n CanalCasa.wgt -t <nombre-del-dispositivo>
   ```

## Modo TV

Dentro de la app hay un ajuste de **modo TV** que desactiva los desenfoques y
suaviza las sombras. No es un capricho estético: `backdrop-filter` es de lo más
caro que puede pedirle una página a la GPU de un televisor, y es lo primero que
produce tirones al mover el foco. Se guarda en el navegador, así que basta con
activarlo una vez en la TV.

También hay un ajuste de **nitidez**. Está en "Suave" por defecto a propósito:
realzar el contraste sobre una señal de baja resolución marca los bloques de
compresión en lugar de mejorar la imagen. Conviene probar ambos viendo la TV
real antes de decidir.

## Navegación con el control remoto

Las flechas, `Enter` y las teclas de color se traducen a eventos de teclado
estándar, que es justo lo que la app ya escucha. No hace falta código
específico de Tizen.

| Tecla del control | Acción |
|---|---|
| ↑ ↓ | Cambiar de canal |
| ← → | Cambiar de categoría |
| Enter | Marcar favorito / abrir ficha |
| 0-9 | Ir directo a un canal |
