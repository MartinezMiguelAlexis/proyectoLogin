const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./connection');
const config = require('../config');

// Funciones de autenticación
module.exports = {
  async registerUser(nombreUsuario, password) {
    // Verificar si el usuario ya existe
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE nombreUsuario = ?',
      [nombreUsuario]
    );

    if (rows.length > 0) {
      throw new Error('El usuario ya existe');
    }

    // Cifrar la contraseña
    const passwordCifrada = await bcrypt.hash(password, 10);

    // Guardar el usuario
    const [result] = await db.query(
      'INSERT INTO usuarios (nombreUsuario, password) VALUES (?, ?)',
      [nombreUsuario, passwordCifrada]
    );

    return { id: result.insertId, nombreUsuario };
  },

  async loginUser(nombreUsuario, password) {
    // Buscar el usuario
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE nombreUsuario = ?',
      [nombreUsuario]
    );

    if (rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const usuario = rows[0];

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      throw new Error('Contraseña incorrecta');
    }

    // Generar token JWT
    const token = jwt.sign(
      { nombreUsuario, userId: usuario.id, esAdmin: usuario.es_admin },
      config.auth.secret,
      { expiresIn: '1h' }
    );

    return { token, usuario };
  },

  verifyToken(token) {
    return jwt.verify(token, config.auth.secret);
  }
};