const express = require('express');
const cors = require('cors'); // Importar el paquete cors
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(express.json());

// Configurar CORS
app.use(cors()); // Habilita CORS para todas las rutas

// Configuración de la conexión a MySQL
const connection = mysql.createConnection({
    host: 'localhost',      // Dirección del servidor MySQL
    user: 'Conexion',           // Usuario de MySQL
    password: 'Conexion123',   // Contraseña de MySQL
    database: 'proyecto2'   // Nombre de la base de datos
});

// Conectar a la base de datos
connection.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        process.exit(1); // Salir si no se puede conectar
    }
    console.log('Conectado a la base de datos MySQL');
});

// Clave secreta para firmar los tokens JWT
const SECRETO = 'mi_clave_secreta';

// Middleware para verificar el token JWT
function verificarToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    jwt.verify(token, SECRETO, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido' });
        }
        req.nombreUsuario = decoded.nombreUsuario; // Guardar el nombre de usuario en la solicitud
        next();
    });
}

// Endpoint POST /registro
app.post('/registro', async (req, res) => {
    const { nombreUsuario, password } = req.body;

    if (!nombreUsuario || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
    }

    try {
        // Verificar si el usuario ya existe
        const [rows] = await connection.promise().query(
            'SELECT * FROM usuarios WHERE nombreUsuario = ?',
            [nombreUsuario]
        );

        if (rows.length > 0) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        // Cifrar la contraseña
        const passwordCifrada = await bcrypt.hash(password, 10);

        // Guardar el usuario en la base de datos
        await connection.promise().query(
            'INSERT INTO usuarios (nombreUsuario, password) VALUES (?, ?)',
            [nombreUsuario, passwordCifrada]
        );

        res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
    } catch (error) {
        console.error('Error en el registro:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Endpoint POST /login
app.post('/login', async (req, res) => {
    const { nombreUsuario, password } = req.body;

    if (!nombreUsuario || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
    }

    try {
        // Buscar el usuario en la base de datos
        const [rows] = await connection.promise().query(
            'SELECT * FROM usuarios WHERE nombreUsuario = ?',
            [nombreUsuario]
        );

        // Verificar si el usuario existe
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        const usuarioEncontrado = rows[0];

        // Verificar si la contraseña está definida
        if (!usuarioEncontrado.password) {
            console.log('Usuario encontrado:', usuarioEncontrado); // Agrega este log para depurar
            return res.status(500).json({ error: 'Error en el servidor: contraseña no definida' });
        }

        // Verificar la contraseña
        const passwordValida = await bcrypt.compare(password, usuarioEncontrado.password);
        if (!passwordValida) {
            return res.status(400).json({ error: 'Contraseña incorrecta' });
        }

        // Generar un token JWT
        const token = jwt.sign({ nombreUsuario }, SECRETO, { expiresIn: '1h' });

        res.json({ token });
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Endpoint GET /perfil (protegido)
app.get('/perfil', verificarToken, (req, res) => {
    res.json({ mensaje: `Bienvenido, ${req.nombreUsuario}` });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});