const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/fornecedores?busca=texto
router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;

    let sql = `SELECT id_fornecedor, razao_social, representante, telefone, cidade, estado, ativo, data_cadastro
               FROM fornecedores WHERE ativo = TRUE`;
    const parametros = [];

    if (busca) {
      parametros.push(`%${busca}%`);
      sql += ` AND (razao_social ILIKE $1 OR representante ILIKE $1 OR telefone ILIKE $1)`;
    }

    sql += ' ORDER BY razao_social';

    const resultado = await pool.query(sql, parametros);
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar fornecedores.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query('SELECT * FROM fornecedores WHERE id_fornecedor = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar fornecedor.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { razao_social, representante, telefone, cidade, estado, observacoes } = req.body;

    if (!razao_social || razao_social.trim().length < 2) {
      return res.status(400).json({ erro: 'Razão social é obrigatória.' });
    }
    if (estado && estado.trim().length !== 2) {
      return res.status(400).json({ erro: 'Estado deve ter 2 letras (ex: SP, PI).' });
    }

    const resultado = await pool.query(
      `INSERT INTO fornecedores (razao_social, representante, telefone, cidade, estado, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [razao_social, representante || null, telefone || null, cidade || null,
       estado ? estado.toUpperCase() : null, observacoes || null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar fornecedor.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { razao_social, representante, telefone, cidade, estado, observacoes, ativo } = req.body;

    if (estado && estado.trim().length !== 2) {
      return res.status(400).json({ erro: 'Estado deve ter 2 letras (ex: SP, PI).' });
    }

    const resultado = await pool.query(
      `UPDATE fornecedores SET
         razao_social = COALESCE($1, razao_social), representante = COALESCE($2, representante),
         telefone = COALESCE($3, telefone), cidade = COALESCE($4, cidade),
         estado = COALESCE($5, estado), observacoes = COALESCE($6, observacoes), ativo = COALESCE($7, ativo)
       WHERE id_fornecedor = $8
       RETURNING *`,
      [razao_social, representante, telefone, cidade, estado ? estado.toUpperCase() : null, observacoes, ativo, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar fornecedor.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      'UPDATE fornecedores SET ativo = FALSE WHERE id_fornecedor = $1 RETURNING id_fornecedor',
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    }
    res.json({ mensagem: 'Fornecedor inativado com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao inativar fornecedor.' });
  }
});

module.exports = router;
