# Kanastra de la Familia: guía para ponerla en internet

Cuando termines esta guía vas a tener un enlace como **https://kanastra-familia.onrender.com**.
Lo mandas por WhatsApp, cada familiar lo abre en su celular, toca **Instalar** y le queda la Kanastra como una app más, con su ícono en la pantalla de inicio.
Nadie tiene que descargar Claude ni nada de una tienda de apps.

Tardas unos 15 minutos y todo es gratis. Lo haces una sola vez.

---

## Paso 1: Guardar el juego en GitHub

GitHub es donde Render va a buscar los archivos del juego.

1. Entra a https://github.com y crea una cuenta gratis (o inicia sesión).
2. Arriba a la derecha toca **+** y luego **New repository**.
3. En *Repository name* escribe `kanastra-familia`. Deja lo demás igual y toca **Create repository**.
4. En la página que aparece, toca el enlace **uploading an existing file**.
5. Descomprime el zip en tu computador. Abre la carpeta `kanastra-online` y **arrastra todo lo que hay adentro** a la página de GitHub:
   `server.js`, `engine.js`, `package.json`, `render.yaml`, `LEEME.md` y la carpeta `public`.
   (Arrastra el contenido de la carpeta, no la carpeta `kanastra-online` completa.)
6. Espera a que suban todos los archivos y toca **Commit changes**.

Revisa que en GitHub se vea la carpeta `public` y, al lado, `server.js`. Si solo ves una carpeta llamada `kanastra-online`, subiste la carpeta completa: bórrala y vuelve a arrastrar lo que hay adentro.

## Paso 2: Publicarlo en Render

1. Entra a https://render.com y toca **Get Started**. Regístrate con tu cuenta de GitHub, es lo más fácil.
2. En el panel toca **New +** y luego **Web Service**.
3. Conecta tu cuenta de GitHub si te lo pide y elige el repositorio `kanastra-familia`.
4. Llena así:
   - **Name:** `kanastra-familia` (esto sale en el enlace)
   - **Language / Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Toca **Deploy Web Service** y espera 2 o 3 minutos, hasta que diga **Live**.
6. Arriba sale tu enlace, algo como `https://kanastra-familia.onrender.com`. Ese es el de la familia.

Si Render pide tarjeta para el plan gratis, no te cobra nada mientras uses la instancia **Free**.

## Paso 3: Instalarla en los celulares

Manda el enlace por WhatsApp. Cada persona hace esto una sola vez:

- **Android (Chrome):** abre el enlace y toca **Instalar Kanastra**, en la misma página.
  Si no sale el botón: menú **⋮** y luego **Instalar app** o **Agregar a la pantalla principal**.
- **iPhone:** abre el enlace en **Safari**, toca **Compartir** (el cuadrado con la flecha) y luego **Agregar a inicio**.

Desde ese momento abren la Kanastra desde su ícono, como cualquier app.

## ¿Ya lo habías subido? Cómo actualizarlo

Sube encima los archivos que cambiaron, cada uno en su carpeta:

1. En la **página principal** del repositorio: toca **Add file** → **Upload files**, arrastra `engine.js`, `server.js` y `bots.js` y toca **Commit changes**.
2. Entra a la carpeta **`public`**: toca **Add file** → **Upload files**, arrastra `index.html` y `sw.js` y toca **Commit changes**.
3. En 2 o 3 minutos Render publica la versión nueva sola.

## Cómo se juega

1. Una persona escribe su nombre y toca **Crear mesa nueva**. Sale un código de 4 letras.
2. Toca el botón con el código para copiar el enlace de la mesa y mándalo al grupo.
3. Cada uno entra, escribe su nombre y se sienta. Los asientos 1 y 3 son pareja contra los asientos 2 y 4.
4. Con los cuatro sentados, cualquiera toca **Repartir cartas**.

**Con bots:** en el inicio, **Jugar contra 3 bots** arma una partida tuya contra la máquina. En la sala de espera, cualquier asiento vacío tiene **Poner bot** para completar la mesa si faltan jugadores.

**Gestos en la mesa:**
- Toca una carta para elegirla. Desliza el dedo de lado sobre varias para elegirlas juntas.
- Arrastra cartas hacia arriba: al **piso** para tirar o comprar, a una **combinación tuya** para añadir, o a **tu zona** para bajar una nueva.
- Toca el **mazo** para robar.
- El sonido se prende y se apaga con el botón del parlante.

Cada celular ve solo sus propias cartas. Si alguien cambia de celular a mitad de la partida, entra a la mesa y toca **Soy (su nombre)**.
Las reglas completas de la familia están en el botón **Reglas**.

## Bueno saber (plan gratis de Render)

- Si nadie usa el juego por 15 minutos, el servidor se duerme. La primera persona que lo abra después espera **cerca de un minuto** mientras despierta. Luego va normal.
- Mientras haya alguien con una mesa abierta, la app mantiene despierto el servidor.
- Cuando el servidor se duerme **se borran las mesas sin terminar**. Terminen la partida en una sentada, o pasen a un plan pago de Render (unos 7 dólares al mes) con un disco para guardarlas.

## Cambiar algo del juego más adelante

Si cambias archivos en GitHub (por ejemplo, con una versión nueva que te pase Claude), Render actualiza el juego solo en un par de minutos. Los celulares reciben la versión nueva la próxima vez que abran la app.

## Probarlo en tu computador (opcional)

Si tienes Node.js instalado (https://nodejs.org), abre una terminal en esta carpeta, escribe `node server.js` y entra a http://localhost:3000.
