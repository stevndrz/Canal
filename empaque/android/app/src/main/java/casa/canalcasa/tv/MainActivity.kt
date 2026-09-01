package casa.canalcasa.tv

import android.annotation.SuppressLint
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

/**
 * La cáscara de CanalCasa para televisores con Android TV / Google TV.
 *
 * Una WebView a pantalla completa y nada más. La aplicación de verdad vive en
 * el servidor: aquí no hay catálogo, ni reproductor, ni lista de canales. Lo
 * que sí hay son las seis o siete decisiones que separan «una WebView» de «una
 * app de televisor que funciona», y cada una está comentada donde ocurre,
 * porque ninguna es evidente y todas se descubren con la pantalla en negro
 * delante.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    /**
     * Si la página cargó de verdad.
     *
     * Decide qué hace la tecla Atrás: con la página viva, Atrás se le entrega a
     * la aplicación web, que sabe si está en una ficha, en el reproductor o en
     * Inicio. Con la página caída no hay nadie a quien entregársela, y Atrás
     * tiene que cerrar la app — si no, un fallo de red deja al mando sin
     * ninguna salida.
     */
    private var paginaViva = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val url = getString(R.string.url_app)
        if (url.contains("CAMBIA-ESTO")) {
            Toast.makeText(this, R.string.falta_url, Toast.LENGTH_LONG).show()
        }

        /**
         * Que la tele no se apague sola viendo un canal.
         *
         * Android cuenta el tiempo hasta el salvapantallas desde la última
         * pulsación, no desde el último fotograma: viendo una película de dos
         * horas sin tocar el mando, el televisor se va al protector de
         * pantalla en mitad de la película. Esta bandera es la que lo evita, y
         * se suelta sola al salir de la app.
         */
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this)
        setContentView(webView)
        configurar(webView)
        aPantallaCompleta()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = alPulsarAtras()
        })

        webView.loadUrl(url)
    }

    private fun configurar(vista: WebView) {
        val ajustes = vista.settings

        ajustes.javaScriptEnabled = true

        /**
         * `domStorageEnabled` NO es opcional aquí, y es el ajuste que más caro
         * sale olvidar.
         *
         * CanalCasa guarda en `localStorage` los favoritos, el último canal,
         * los ajustes del reproductor y «Mi enlace»: no hay base de datos ni
         * cuentas en toda la aplicación. Y como el código captura la excepción
         * para poder funcionar en el modo privado de webOS, sin esto no habría
         * ningún error visible: simplemente nada se recordaría entre arranques,
         * y parecería un fallo de la aplicación.
         */
        ajustes.domStorageEnabled = true

        /**
         * Sin esto, el vídeo no arranca hasta que alguien toca la pantalla — y
         * un televisor no tiene pantalla que tocar. Es lo que hace que el canal
         * empiece a sonar solo al entrar.
         */
        ajustes.mediaPlaybackRequiresUserGesture = false

        /**
         * El televisor tiene que decir que es un televisor.
         *
         * El servidor decide con el User-Agent en qué orden ofrece los
         * servidores de vídeo: en un televisor, los que esconden el reproductor
         * tras una comprobación antirrobot van los últimos, porque ahí esa
         * comprobación no se pasa nunca y el marco se queda recargándose
         * (`src/lib/dispositivo.ts` lo explica entero). La WebView de un
         * Android TV se anuncia como un Android cualquiera, así que sin esta
         * línea la tele recibiría el orden del teléfono y el primer servidor
         * daría vueltas sin arrancar.
         *
         * El texto se AÑADE al que ya trae, nunca se sustituye: un User-Agent
         * inventado entero rompe la detección de formatos de vídeo de medio
         * internet.
         */
        ajustes.userAgentString = "${ajustes.userAgentString} Android TV CanalCasa/1.0"

        /**
         * Contenido mixto en modo compatible.
         *
         * La app se sirve por HTTPS, y por defecto la WebView bloquea todo lo
         * que venga por HTTP dentro de una página HTTPS. La lista de canales de
         * hoy es HTTPS entera, así que esto no cambia nada — pero las listas
         * IPTV cambian, y el día que una traiga un canal por HTTP, el modo
         * `COMPATIBILITY` deja pasar el VÍDEO y sigue bloqueando los guiones,
         * que es donde está el peligro de verdad. `ALWAYS_ALLOW` dejaría entrar
         * también los guiones y no compensa.
         */
        ajustes.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

        /** El catálogo y los rieles piden imágenes según se enfocan. */
        ajustes.loadsImagesAutomatically = true
        ajustes.cacheMode = WebSettings.LOAD_DEFAULT

        /**
         * El puente para salir de la app.
         *
         * En un navegador, Atrás en la pantalla de inicio no hace nada y está
         * bien. Aquí es la única salida que tiene el mando, así que la
         * aplicación web necesita poder cerrar la Activity. Lo hace llamando a
         * `window.CanalCasaAndroid.salir()`; ver `src/lib/salir-de-la-app.ts`.
         *
         * Es un puente de UNA función y sin parámetros a propósito: cualquier
         * cosa que exponga aquí queda al alcance de todo el JavaScript que se
         * cargue en la WebView, incluido el de los iframes de los proveedores
         * de vídeo. Lo peor que puede hacer alguien con esto es cerrar la app.
         */
        vista.addJavascriptInterface(PuenteDeSalida(), "CanalCasaAndroid")

        vista.setBackgroundColor(android.graphics.Color.BLACK)

        vista.webChromeClient = WebChromeClient()
        vista.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                paginaViva = true
            }

            /**
             * Solo importa el fallo del documento PRINCIPAL.
             *
             * Una lista de 7.800 canales trae logos de cientos de dominios y
             * unos cuantos siempre fallan; tratar eso como «la página se cayó»
             * dejaría a la aplicación marcada como muerta estando perfectamente
             * viva, y con ella la tecla Atrás.
             */
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                // Esta versión del callback y `isForMainFrame` llegaron las dos
                // en Android 6, así que por debajo esto no se llama nunca. La
                // comprobación está para que el analizador no marque la línea.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !request.isForMainFrame) return
                paginaViva = false
                Toast.makeText(this@MainActivity, R.string.sin_conexion, Toast.LENGTH_LONG).show()
            }
        }
    }

    /**
     * Pantalla completa de verdad, sin barras del sistema.
     *
     * En un televisor no hay nada que hacer con la barra de navegación, y
     * ocupa una franja de la imagen. Se usa la API vieja porque la nueva
     * (`WindowInsetsController`) es de Android 11 y muchos televisores TCL con
     * Google TV siguen en 9, 10 y 11 según el modelo.
     */
    @Suppress("DEPRECATION")
    private fun aPantallaCompleta() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }

    /**
     * La tecla Atrás del mando.
     *
     * Android no la entrega a la página como un evento de teclado, así que hay
     * que fabricarla. Se manda como `Escape`, que es la misma tecla que la app
     * ya escucha en un PC y en Tizen (allí llega con el código 10009); así hay
     * UNA sola ruta de «volver» en la aplicación y no una por plataforma.
     *
     * Quién decide qué significa Atrás es la aplicación web, que es la única
     * que sabe si hay una ficha abierta, un panel de géneros desplegado o si
     * ya está en Inicio. Cuando ya no hay adónde volver, es ella quien llama al
     * puente y cierra esto.
     */
    private fun alPulsarAtras() {
        if (!paginaViva) {
            finish()
            return
        }
        if (webView.canGoBack()) {
            webView.goBack()
            return
        }
        webView.evaluateJavascript(
            """
            (function () {
              var opciones = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true };
              window.dispatchEvent(new KeyboardEvent('keydown', opciones));
              window.dispatchEvent(new KeyboardEvent('keyup', opciones));
            })();
            """.trimIndent(),
            null,
        )
    }

    private inner class PuenteDeSalida {
        /**
         * `@JavascriptInterface` es obligatorio desde Android 4.2: sin la
         * anotación el método existe, JavaScript lo ve y la llamada no hace
         * nada, sin ningún error. Es un fallo silencioso clásico.
         *
         * `runOnUiThread` porque esto llega desde el hilo de JavaScript, y
         * `finish()` desde otro hilo lanza.
         */
        @JavascriptInterface
        fun salir() {
            runOnUiThread { finish() }
        }
    }

    /**
     * Al irse a segundo plano, callar.
     *
     * `onPause` de la WebView para el vídeo y los temporizadores. Sin esto, el
     * canal sigue sonando con el televisor en el menú de inicio, que es
     * exactamente lo que nadie espera de una app de tele.
     */
    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers()
    }

    override fun onResume() {
        super.onResume()
        webView.resumeTimers()
        webView.onResume()
        aPantallaCompleta()
    }

    override fun onDestroy() {
        // Sacarla del árbol antes de destruirla: destruir una WebView que
        // todavía cuelga de una vista deja el proceso con una fuga.
        (webView.parent as? android.view.ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }
}
