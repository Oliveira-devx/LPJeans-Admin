const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { permitirCargos } = require('../middleware/permissoes');

router.get('/', async (req, res) => {
  try {
    const mostrarTodas = req.query.todas === 'true';
    const sql = mostrarTodas
      ? 'SELECT id_forma_pagamento, forma, ativo FROM formas_pagamento ORDER BY forma'
      : 'SELECT id_forma_pagamento, forma, ativo FROM formas_pagamento WHERE ativo = TRUE ORDER BY forma';
    const resultado = await pool.query(sql);
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar formas de pagamento.' });
  }
});

// Criar/gerenciar formas de pagamento é uma decisão de configuração do
// negócio — só Administrador/Proprietaria, sempre (não é configurável por
// cargo, pra não abrir um paradoxo de "quem pode configurar o que é
// configurável").
router.post('/', permitirCargos('Administrador', 'Proprietaria'), async (req, res) => {
  try {
    const { forma } = req.body;
    if (!forma || forma.trim().length < 2) {
      return res.status(400).json({ erro: 'Informe o nome da forma de pagamento.' });
    }
    const resultado = await pool.query(
      'INSERT INTO formas_pagamento (forma) VALUES ($1) RETURNING *',
      [forma.trim()]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Essa forma de pagamento já existe.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar forma de pagamento.' });
  }
});

router.put('/:id', permitirCargos('Administrador', 'Proprietaria'), async (req, res) => {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    const resultado = await pool.query(
      'UPDATE formas_pagamento SET ativo = $1 WHERE id_forma_pagamento = $2 RETURNING *',
      [ativo, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Forma de pagamento não encontrada.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar forma de pagamento.' });
  }
});

module.exports = router;
