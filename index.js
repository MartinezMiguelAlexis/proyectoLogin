const express = require('express');
const cors = require('cors');
const path = require('path');
const auth = require('./db/auth');
const products = require('./db/products');
const app = express();
const port = 3000;

// Configuración
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para verificar token
function verificarToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  try {
    const decoded = auth.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Rutas de autenticación
app.post('/registro', async (req, res) => {
  try {
    const { nombreUsuario, password } = req.body;
    if (!nombreUsuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const user = await auth.registerUser(nombreUsuario, password);
    res.status(201).json({ mensaje: 'Usuario registrado', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { nombreUsuario, password } = req.body;
    if (!nombreUsuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const { token, usuario } = await auth.loginUser(nombreUsuario, password);
    res.json({ token, usuario });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/perfil', verificarToken, (req, res) => {
  res.json({ mensaje: `Bienvenido ${req.user.nombreUsuario}`, user: req.user });
});

// Rutas de productos
app.post('/productos', verificarToken, async (req, res) => {
  try {
    const { nombre, cantidad, unidad, fecha_compra } = req.body;
    if (!nombre || !cantidad || !unidad) {
      return res.status(400).json({ error: 'Nombre, cantidad y unidad requeridos' });
    }

    const product = await products.createProduct(req.user.userId, {
      nombre, cantidad, unidad, fecha_compra
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/productos', verificarToken, async (req, res) => {
  try {
    const productos = await products.getProducts(req.user.userId);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/productos/:id', verificarToken, async (req, res) => {
  try {
    const producto = await products.getProductById(req.user.userId, req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/productos/:id', verificarToken, async (req, res) => {
  try {
    const { nombre, cantidad, unidad, fecha_compra } = req.body;
    if (!nombre || !cantidad || !unidad) {
      return res.status(400).json({ error: 'Nombre, cantidad y unidad requeridos' });
    }

    const updated = await products.updateProduct(req.user.userId, req.params.id, {
      nombre, cantidad, unidad, fecha_compra
    });
    
    if (!updated) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/productos/:id', verificarToken, async (req, res) => {
  try {
    const deleted = await products.deleteProduct(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para servir el archivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});