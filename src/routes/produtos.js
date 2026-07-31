const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/produtos -> lista produtos ativos, com o nome do tipo já junto
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT p.id_produto, p.referencia, p.descricao, p.genero, p.tecido,
              p.colecao, p.ativo, t.nome AS tipo
       FROM produtos p
       LEFT JOIN tipos_produto t ON t.id_tipo = p.id_tipo
       WHERE p.ativo = TRUE
       ORDER BY p.descricao`
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

// GET /api/produtos/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      `SELECT p.*, t.nome AS tipo
       FROM produtos p
       LEFT JOIN tipos_produto t ON t.id_tipo = p.id_tipo
       WHERE p.id_produto = $1`,
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar produto.' });
  }
});

// POST /api/produtos
router.post('/', async (req, res) => {
  try {
    const { referencia, descricao, id_tipo, genero, tecido, colecao } = req.body;

    if (!referencia || !descricao) {
      return res.status(400).json({ erro: 'Referência e descrição são obrigatórias.' });
    }

    const resultado = await pool.query(
      `INSERT INTO produtos (referencia, descricao, id_tipo, genero, tecido, colecao)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [referencia, descricao, id_tipo || null, genero || null, tecido || null, colecao || null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um produto com essa referência.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar produto.' });
  }
});

// PUT /api/produtos/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { referencia, descricao, id_tipo, genero, tecido, colecao, ativo } = req.body;

    const resultado = await pool.query(
      `UPDATE produtos
       SET referencia = COALESCE($1, referencia),
           descricao = COALESCE($2, descricao),
           id_tipo = COALESCE($3, id_tipo),
           genero = COALESCE($4, genero),
           tecido = COALESCE($5, tecido),
           colecao = COALESCE($6, colecao),
           ativo = COALESCE($7, ativo)
       WHERE id_produto = $8
       RETURNING *`,
      [referencia, descricao, id_tipo, genero, tecido, colecao, ativo, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
});

// DELETE /api/produtos/:id -> inativa
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      'UPDATE produtos SET ativo = FALSE WHERE id_produto = $1 RETURNING id_produto',
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    res.json({ mensagem: 'Produto inativado com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao inativar produto.' });
  }
});

module.exports = router;
