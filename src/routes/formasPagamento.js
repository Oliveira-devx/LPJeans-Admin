const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id_forma_pagamento, forma FROM formas_pagamento WHERE ativo = TRUE ORDER BY forma'
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar formas de pagamento.' });
  }
});

module.exports = router;
