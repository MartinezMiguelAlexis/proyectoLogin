const mysql = require('mysql2/promise');
const config = require('../config');

// Pool de conexiones para mejor manejo
const pool = mysql.createPool({
  host: process.env.DB_HOST || config.database.host,
  user: process.env.DB_USER || config.database.user,
  password: process.env.DB_PASSWORD || config.database.password,
  database: process.env.DB_NAME || config.database.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verificar conexión al iniciar
pool.getConnection()
  .then(conn => {
    console.log('Conexión a MySQL establecida');
    conn.release();
  })
  .catch(err => {
    console.error('Error conectando a MySQL:', err);
    process.exit(1);
  });

module.exports = pool;