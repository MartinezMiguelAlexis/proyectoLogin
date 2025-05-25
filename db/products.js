const db = require("./connection");

module.exports = {
  async createProduct(
    userId,
    { nombre, cantidad, precio, unidad, fecha_compra }
  ) {
    const [result] = await db.query(
      "INSERT INTO productos (nombre, cantidad, precio_actual, unidad, fecha_compra, usuario_id) VALUES (?, ?, ?, ?, ?, ?)",
      [nombre, cantidad, precio, unidad, fecha_compra || new Date(), userId]
    );

    // Insertar en historial de precios
    await db.query(
      "INSERT INTO historial_precios (producto_id, precio, usuario_id) VALUES (?, ?, ?)",
      [result.insertId, precio, userId]
    );

    return {
      id: result.insertId,
      nombre,
      cantidad,
      precio, // Mantenemos el nombre que espera el frontend
      unidad,
      fecha_compra,
    };
  },

  async getProducts(userId) {
    const [products] = await db.query(
      `SELECT 
            id, 
            nombre, 
            cantidad, 
            precio_actual AS precio,
            unidad, 
            fecha_compra 
         FROM productos 
         WHERE usuario_id = ?`,
      [userId]
    );
    return products;
  },

  async getProductById(userId, productId) {
    const [products] = await db.query(
      `SELECT 
            id, 
            nombre, 
            cantidad, 
            precio_actual AS precio,
            unidad, 
            fecha_compra 
         FROM productos 
         WHERE id = ? AND usuario_id = ?`,
      [productId, userId]
    );
    return products[0] || null;
  },

  async updateProduct(
    userId,
    productId,
    { nombre, cantidad, unidad, fecha_compra }
  ) {
    const [result] = await db.query(
      "UPDATE productos SET nombre = ?, cantidad = ?, unidad = ?, fecha_compra = ? WHERE id = ? AND usuario_id = ?",
      [nombre, cantidad, unidad, fecha_compra || new Date(), productId, userId]
    );
    return result.affectedRows > 0;
  },

  async deleteProduct(userId, productId) {
    const [result] = await db.query(
      "DELETE FROM productos WHERE id = ? AND usuario_id = ?",
      [productId, userId]
    );
    return result.affectedRows > 0;
  },

  async checkProductStock(userId, productId, requiredQuantity) {
    const [rows] = await db.query(
      "SELECT cantidad FROM productos WHERE id = ? AND usuario_id = ?",
      [productId, userId]
    );

    if (rows.length === 0) return { exists: false };
    if (rows[0].cantidad < requiredQuantity)
      return { exists: true, inStock: false };

    return { exists: true, inStock: true, currentStock: rows[0].cantidad };
  },

  async updateProductStock(userId, productId, newQuantity) {
    const [result] = await db.query(
      "UPDATE productos SET cantidad = ? WHERE id = ? AND usuario_id = ?",
      [newQuantity, productId, userId]
    );
    return result.affectedRows > 0;
  },

  async updateProductPrice(userId, productId, newPrice) {
    // Primero actualizar el producto
    const [updateResult] = await db.query(
      "UPDATE productos SET precio_actual = ? WHERE id = ? AND usuario_id = ?",
      [newPrice, productId, userId]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error("Producto no encontrado o no tienes permisos");
    }

    return true;
  },

  async getPriceHistory(userId, productId) {
    const [history] = await db.query(
      `SELECT hp.precio, hp.fecha_inicio, hp.fecha_fin, u.nombreUsuario
       FROM historial_precios hp
       JOIN usuarios u ON hp.usuario_id = u.id
       WHERE hp.producto_id = ? AND hp.usuario_id = ?
       ORDER BY hp.fecha_inicio DESC`,
      [productId, userId]
    );
    return history;
  },

  async getCurrentPrice(userId, productId) {
    const [rows] = await db.query(
      "SELECT precio_actual FROM productos WHERE id = ? AND usuario_id = ?",
      [productId, userId]
    );
    return rows[0]?.precio_actual;
  },
};
