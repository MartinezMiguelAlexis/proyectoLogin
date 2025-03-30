const mysql = require('mysql2/promise');
const config = require('../config');

// Pool de conexiones para mejor manejo
const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
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