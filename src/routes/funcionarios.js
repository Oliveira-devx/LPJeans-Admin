const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id_funcionario, nome, cargo, telefone, email, ativo, data_cadastro
       FROM funcionarios
       ORDER BY nome`
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar funcionários.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      `SELECT id_funcionario, nome, cargo, telefone, email, ativo, data_cadastro
       FROM funcionarios WHERE id_funcionario = $1`,
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Funcionário não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar funcionário.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nome, cargo, telefone, email } = req.body;
    if (!nome || !cargo) {
      return res.status(400).json({ erro: 'Nome e cargo são obrigatórios.' });
    }
    const cargosValidos = ['Administrador', 'Proprietaria', 'Vendedora'];
    if (!cargosValidos.includes(cargo)) {
      return res.status(400).json({ erro: `Cargo inválido. Use: ${cargosValidos.join(', ')}` });
    }
    const resultado = await pool.query(
      `INSERT INTO funcionarios (nome, cargo, telefone, email)
       VALUES ($1, $2, $3, $4)
       RETURNING id_funcionario, nome, cargo, telefone, email, ativo, data_cadastro`,
      [nome, cargo, telefone || null, email || null]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar funcionário.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cargo, telefone, email, ativo } = req.body;
    const resultado = await pool.query(
      `UPDATE funcionarios
       SET nome = COALESCE($1, nome),
           cargo = COALESCE($2, cargo),
           telefone = COALESCE($3, telefone),
           email = COALESCE($4, email),
           ativo = COALESCE($5, ativo)
       WHERE id_funcionario = $6
       RETURNING id_funcionario, nome, cargo, telefone, email, ativo, data_cadastro`,
      [nome, cargo, telefone, email, ativo, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Funcionário não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar funcionário.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      `UPDATE funcionarios SET ativo = FALSE WHERE id_funcionario = $1
       RETURNING id_funcionario`,
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Funcionário não encontrado.' });
    }
    res.json({ mensagem: 'Funcionário inativado com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao inativar funcionário.' });
  }
});

module.exports = router;
