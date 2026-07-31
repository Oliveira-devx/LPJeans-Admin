// Rotas "aninhadas" dentro de produtos: /api/produtos/:id_produto/variacoes
// mergeParams:true é o que permite ler :id_produto aqui dentro.

const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../config/db');

// GET /api/produtos/:id_produto/variacoes -> lista variações + saldo de estoque
router.get('/', async (req, res) => {
  try {
    const { id_produto } = req.params;
    const resultado = await pool.query(
      `SELECT v.id_variacao, v.tamanho, v.cor, v.codigo_barras,
              v.estoque_minimo, v.ativo, e.quantidade_atual
       FROM produto_variacoes v
       LEFT JOIN estoque e ON e.id_variacao = v.id_variacao
       WHERE v.id_produto = $1
       ORDER BY v.tamanho, v.cor`,
      [id_produto]
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar variações.' });
  }
});

// POST /api/produtos/:id_produto/variacoes
// Cria a variação E o registro de estoque (zerado) na mesma transação.
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_produto } = req.params;
    const { tamanho, cor, codigo_barras, estoque_minimo } = req.body;

    if (!tamanho || !cor) {
      return res.status(400).json({ erro: 'Tamanho e cor são obrigatórios.' });
    }

    await client.query('BEGIN');

    const variacao = await client.query(
      `INSERT INTO produto_variacoes (id_produto, tamanho, cor, codigo_barras, estoque_minimo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id_produto, tamanho, cor, codigo_barras || null, estoque_minimo || 0]
    );

    const idVariacao = variacao.rows[0].id_variacao;

    await client.query(
      `INSERT INTO estoque (id_variacao, quantidade_atual) VALUES ($1, 0)`,
      [idVariacao]
    );

    await client.query('COMMIT');

    res.status(201).json({ ...variacao.rows[0], quantidade_atual: 0 });
  } catch (erro) {
    await client.query('ROLLBACK');
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Código de barras já cadastrado em outra variação.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar variação.' });
  } finally {
    client.release();
  }
});

// PUT /api/produtos/:id_produto/variacoes/:id_variacao
router.put('/:id_variacao', async (req, res) => {
  try {
    const { id_variacao } = req.params;
    const { tamanho, cor, codigo_barras, estoque_minimo, ativo } = req.body;

    const resultado = await pool.query(
      `UPDATE produto_variacoes
       SET tamanho = COALESCE($1, tamanho),
           cor = COALESCE($2, cor),
           codigo_barras = COALESCE($3, codigo_barras),
           estoque_minimo = COALESCE($4, estoque_minimo),
           ativo = COALESCE($5, ativo)
       WHERE id_variacao = $6
       RETURNING *`,
      [tamanho, cor, codigo_barras, estoque_minimo, ativo, id_variacao]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Variação não encontrada.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar variação.' });
  }
});

// DELETE /api/produtos/:id_produto/variacoes/:id_variacao -> inativa
router.delete('/:id_variacao', async (req, res) => {
  try {
    const { id_variacao } = req.params;
    const resultado = await pool.query(
      'UPDATE produto_variacoes SET ativo = FALSE WHERE id_variacao = $1 RETURNING id_variacao',
      [id_variacao]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Variação não encontrada.' });
    }
    res.json({ mensagem: 'Variação inativada com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao inativar variação.' });
  }
});

module.exports = router;
