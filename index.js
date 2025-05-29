const express = require("express");
const cors = require("cors");
const path = require("path");
const auth = require("./db/auth");
const products = require("./db/products");
const db = require("./db/connection");
const app = express();
const port = process.env.PORT || 3000;
const config = require("./config");
const stripe = require("stripe")(config.stripe.secretKey, {
  apiVersion: "2023-08-16",
  maxNetworkRetries: 2,
  timeout: 20000, // 20 segundos de timeout
  telemetry: false,
});
const bodyParser = require("body-parser");

app.use(express.static(path.join(__dirname, "public")));

app.post(
  "/webhook-stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const payload = req.body; // Esto ya es un Buffer

    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        sig,
        config.stripe.webhookSecret
      );

      // Manejar el evento checkout.session.completed
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // 1. Registrar pago
        await db.query(
          "INSERT INTO pagos (usuario_id, session_id, payment_intent, monto, moneda, estado) VALUES (?, ?, ?, ?, ?, ?)",
          [
            session.metadata.userId,
            session.id,
            session.payment_intent,
            session.amount_total / 100,
            session.currency,
            "completado",
          ]
        );

        // 2. Actualizar stock
        const productos = JSON.parse(session.metadata.productos);
        for (const p of productos) {
          await db.query(
            "UPDATE productos SET cantidad = cantidad - ? WHERE id = ? AND usuario_id = ?",
            [p.cantidad, p.productId, session.metadata.userId]
          );
        }

        console.log(`✅ Pago ${session.id} procesado y stock actualizado`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("⚠️ Webhook error:", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para verificar token
function verificarToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "Token no proporcionado" });

  try {
    const decoded = auth.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token inválido" });
  }
}

// Rutas de autenticación
app.post("/registro", async (req, res) => {
  try {
    const { nombreUsuario, password } = req.body;
    if (!nombreUsuario || !password) {
      return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    }

    const user = await auth.registerUser(nombreUsuario, password);
    res.status(201).json({ mensaje: "Usuario registrado", user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { nombreUsuario, password } = req.body;
    if (!nombreUsuario || !password) {
      return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    }

    const { token, usuario } = await auth.loginUser(nombreUsuario, password);
    res.json({ token, usuario });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/perfil", verificarToken, (req, res) => {
  res.json({ mensaje: `Bienvenido ${req.user.nombreUsuario}`, user: req.user });
});

// Rutas de productos
app.post("/productos", verificarToken, async (req, res) => {
  try {
    const { nombre, precio, cantidad, unidad, fecha_compra } = req.body;
    if (!nombre || !precio || !cantidad || !unidad) {
      return res.status(400).json({
        error: "Nombre, precio, cantidad y unidad son requeridos",
      });
    }

    const product = await products.createProduct(req.user.userId, {
      nombre,
      precio,
      cantidad,
      unidad,
      fecha_compra,
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/productos/:id", verificarToken, async (req, res) => {
  try {
    const { nombre, precio, cantidad, unidad, fecha_compra } = req.body;
    if (!nombre || !precio || !cantidad || !unidad) {
      return res.status(400).json({
        error: "Nombre, precio, cantidad y unidad son requeridos",
      });
    }

    const updated = await products.updateProduct(
      req.user.userId,
      req.params.id,
      {
        nombre,
        precio,
        cantidad,
        unidad,
        fecha_compra,
      }
    );

    if (!updated) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    res.json({ mensaje: "Producto actualizado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/productos", verificarToken, async (req, res) => {
  try {
    const productos = await products.getProducts(req.user.userId);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/productos/:id", verificarToken, async (req, res) => {
  try {
    const producto = await products.getProductById(
      req.user.userId,
      req.params.id
    );
    if (!producto)
      return res.status(404).json({ error: "Producto no encontrado" });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/productos/:id", verificarToken, async (req, res) => {
  try {
    const { nombre, cantidad, unidad, fecha_compra } = req.body;
    if (!nombre || !cantidad || !unidad) {
      return res
        .status(400)
        .json({ error: "Nombre, cantidad y unidad requeridos" });
    }

    const updated = await products.updateProduct(
      req.user.userId,
      req.params.id,
      {
        nombre,
        cantidad,
        unidad,
        fecha_compra,
      }
    );

    if (!updated)
      return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ mensaje: "Producto actualizado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/productos/:id", verificarToken, async (req, res) => {
  try {
    const deleted = await products.deleteProduct(
      req.user.userId,
      req.params.id
    );
    if (!deleted)
      return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ mensaje: "Producto eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para servir el archivo HTML principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rutas de pagos
app.post("/crear-sesion-pago", verificarToken, async (req, res) => {
  try {
    const { productos } = req.body;
    console.log("Productos recibidos:", productos); // Debug

    if (!productos || !Array.isArray(productos)) {
      return res.status(400).json({ error: "Lista de productos inválida" });
    }

    // 1. Primero calculamos el monto total
    const montoTotal = productos.reduce((total, producto) => {
      return total + producto.precio * producto.cantidad * 100; // Convertir a centavos
    }, 0);

    console.log("Monto calculado:", montoTotal); // Debug

    if (montoTotal <= 0) {
      return res
        .status(400)
        .json({ error: "El monto total debe ser mayor que cero" });
    }

    // 2. Luego creamos la sesión de pago
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: productos.map((producto) => ({
        price_data: {
          currency: "mxn",
          product_data: {
            name: producto.nombre,
            metadata: {
              productId: producto.productId,
            },
          },
          unit_amount: Math.round(producto.precio * 100),
        },
        quantity: producto.cantidad,
      })),
      mode: "payment",
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/cancelado`,
      metadata: {
        userId: req.user.userId.toString(),
        productos: JSON.stringify(
          productos.map((p) => ({
            productId: p.productId,
            cantidad: p.cantidad,
          }))
        ),
      },
    });

    console.log("Sesión creada:", session.id); // Debug

    res.json({
      id: session.id,
      url: session.url,
      amount_total: session.amount_total,
      monto_total: montoTotal / 100, // Para mostrar en frontend
    });
  } catch (error) {
    console.error("Error en crear-sesion-pago:", error);
    res.status(500).json({
      error: "Error al crear sesión de pago",
      detalle: error.message,
    });
  }
});

app.get("/verificar-pago/:sessionId", verificarToken, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(
      req.params.sessionId
    );

    // Verificar que el pago pertenece al usuario
    if (session.metadata.userId !== req.user.userId.toString()) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para ver este pago" });
    }

    res.json({
      status: session.payment_status,
      amount_total: session.amount_total / 100, // Convertir a pesos
      currency: session.currency,
      customer_email: session.customer_email,
      payment_intent: session.payment_intent,
    });
  } catch (error) {
    console.error("Error en verificar-pago:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/verificar-productos-pago", verificarToken, async (req, res) => {
  try {
    const { productos } = req.body;
    const verificaciones = [];

    for (const producto of productos) {
      const { productId, cantidad } = producto;
      const check = await products.checkProductStock(
        req.user.userId,
        productId,
        cantidad
      );
      verificaciones.push({ productId, ...check });
    }

    res.json({ verificaciones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/test-stripe", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: "mxn",
    });
    res.json(paymentIntent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rutas para manejar la redirección después del pago
app.get("/exito", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"],
    });

    // Verificar stock actualizado
    const productosComprados = session.line_items.data.map((item) => ({
      nombre: item.price.product.name,
      cantidad: item.quantity,
      precio: item.price.unit_amount / 100,
    }));

    res.send(`
      <h1>¡Compra exitosa!</h1>
      <h3>Resumen:</h3>
      <ul>
        ${productosComprados
          .map(
            (p) => `
          <li>${p.nombre} - ${p.cantidad} x $${p.precio.toFixed(2)}</li>
        `
          )
          .join("")}
      </ul>
      <p>Total: $${(session.amount_total / 100).toFixed(2)}</p>
    `);
  } catch (error) {
    res.status(500).send("Error al verificar compra");
  }
});

app.get("/cancelado", (req, res) => {
  res.send(`
    <html>
      <head><title>Pago Cancelado</title></head>
      <body>
        <h1>Pago cancelado</h1>
        <p>El pago no se completó.</p>
        <a href="/">Volver al inicio</a>
      </body>
    </html>
  `);
});

app.post("/verificar-stock", verificarToken, async (req, res) => {
  try {
    const { productos } = req.body;
    const problemas = [];

    for (const producto of productos) {
      const existe = await products.getProductById(
        req.user.userId,
        producto.productId
      );
      if (!existe) {
        problemas.push({ productId: producto.productId, error: "No existe" });
        continue;
      }

      if (existe.cantidad < producto.cantidad) {
        problemas.push({
          productId: producto.productId,
          error: "Stock insuficiente",
          disponible: existe.cantidad,
        });
      }
    }

    if (problemas.length > 0) {
      return res.json({
        valido: false,
        mensaje: "Problemas con el stock",
        detalles: problemas,
      });
    }

    res.json({ valido: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar estas nuevas rutas
app.put("/productos/:id/precio", verificarToken, async (req, res) => {
  try {
    const { nuevoPrecio } = req.body;
    if (!nuevoPrecio || isNaN(nuevoPrecio)) {
      return res.status(400).json({ error: "Precio inválido" });
    }

    await products.updateProductPrice(
      req.user.userId,
      req.params.id,
      nuevoPrecio
    );
    res.json({ mensaje: "Precio actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/productos/:id/precio/historial", verificarToken, async (req, res) => {
  try {
    const historial = await products.getPriceHistory(
      req.user.userId,
      req.params.id
    );
    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error("Error global:", err.stack);
  res.status(500).json({ error: "Algo salió mal en el servidor" });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
