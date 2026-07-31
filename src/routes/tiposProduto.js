const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM tipos_produto ORDER BY nome');
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar tipos de produto.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });

    const resultado = await pool.query(
      'INSERT INTO tipos_produto (nome) VALUES ($1) RETURNING *',
      [nome]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Esse tipo de produto já existe.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar tipo de produto.' });
  }
});

module.exports = router;
