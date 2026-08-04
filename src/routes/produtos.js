const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/produtos/busca-venda?q=texto -> busca otimizada para a tela de
// Vendas: já traz o produto E suas variações com estoque numa única
// chamada, pra busca ficar rápida (poucos cliques, sem várias requisições).
router.get('/busca-venda', async (req, res) => {
  try {
    const termo = req.query.q || '';
    if (termo.trim().length < 2) {
      return res.json([]);
    }

    const produtos = await pool.query(
      `SELECT id_produto, referencia, descricao, preco_venda
       FROM produtos
       WHERE ativo = TRUE AND (referencia ILIKE $1 OR descricao ILIKE $1)
       ORDER BY descricao
       LIMIT 15`,
      [`%${termo}%`]
    );

    if (produtos.rows.length === 0) {
      return res.json([]);
    }

    const idsProdutos = produtos.rows.map(p => p.id_produto);
    const variacoes = await pool.query(
      `SELECT v.id_variacao, v.id_produto, v.tamanho, v.cor, e.quantidade_atual
       FROM produto_variacoes v
       JOIN estoque e ON e.id_variacao = v.id_variacao
       WHERE v.id_produto = ANY($1) AND v.ativo = TRUE
       ORDER BY v.tamanho, v.cor`,
      [idsProdutos]
    );

    const resultado = produtos.rows.map(p => ({
      ...p,
      variacoes: variacoes.rows.filter(v => v.id_produto === p.id_produto),
    }));

    res.json(resultado);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

// GET /api/produtos -> lista produtos ativos, com o nome do tipo já junto
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT p.id_produto, p.referencia, p.descricao, p.genero, p.tecido,
              p.colecao, p.preco_venda, p.ativo, t.nome AS tipo
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
    const { referencia, descricao, id_tipo, genero, tecido, colecao, preco_venda } = req.body;

    if (!referencia || !descricao) {
      return res.status(400).json({ erro: 'Referência e descrição são obrigatórias.' });
    }
    if (preco_venda === undefined || preco_venda === null || Number(preco_venda) < 0) {
      return res.status(400).json({ erro: 'Informe um preço de venda válido.' });
    }

    const resultado = await pool.query(
      `INSERT INTO produtos (referencia, descricao, id_tipo, genero, tecido, colecao, preco_venda)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [referencia, descricao, id_tipo || null, genero || null, tecido || null, colecao || null, preco_venda]
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
    const { referencia, descricao, id_tipo, genero, tecido, colecao, preco_venda, ativo } = req.body;

    const resultado = await pool.query(
      `UPDATE produtos
       SET referencia = COALESCE($1, referencia),
           descricao = COALESCE($2, descricao),
           id_tipo = COALESCE($3, id_tipo),
           genero = COALESCE($4, genero),
           tecido = COALESCE($5, tecido),
           colecao = COALESCE($6, colecao),
           preco_venda = COALESCE($7, preco_venda),
           ativo = COALESCE($8, ativo)
       WHERE id_produto = $9
       RETURNING *`,
      [referencia, descricao, id_tipo, genero, tecido, colecao, preco_venda, ativo, id]
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
