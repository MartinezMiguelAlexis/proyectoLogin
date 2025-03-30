const db = require('./connection');

module.exports = {
  async createProduct(userId, { nombre, cantidad, unidad, fecha_compra }) {
    const [result] = await db.query(
      'INSERT INTO productos (nombre, cantidad, unidad, fecha_compra, usuario_id) VALUES (?, ?, ?, ?, ?)',
      [nombre, cantidad, unidad, fecha_compra || new Date(), userId]
    );
    return { id: result.insertId, nombre, cantidad, unidad, fecha_compra };
  },

  async getProducts(userId) {
    const [products] = await db.query(
      'SELECT id, nombre, cantidad, unidad, fecha_compra FROM productos WHERE usuario_id = ?',
      [userId]
    );
    return products;
  },

  async getProductById(userId, productId) {
    const [products] = await db.query(
      'SELECT id, nombre, cantidad, unidad, fecha_compra FROM productos WHERE id = ? AND usuario_id = ?',
      [productId, userId]
    );
    return products[0] || null;
  },

  async updateProduct(userId, productId, { nombre, cantidad, unidad, fecha_compra }) {
    const [result] = await db.query(
      'UPDATE productos SET nombre = ?, cantidad = ?, unidad = ?, fecha_compra = ? WHERE id = ? AND usuario_id = ?',
      [nombre, cantidad, unidad, fecha_compra || new Date(), productId, userId]
    );
    return result.affectedRows > 0;
  },

  async deleteProduct(userId, productId) {
    const [result] = await db.query(
      'DELETE FROM productos WHERE id = ? AND usuario_id = ?',
      [productId, userId]
    );
    return result.affectedRows > 0;
  }
};