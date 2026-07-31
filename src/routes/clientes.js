const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/clientes?busca=texto -> lista clientes ativos, com busca opcional
// por nome, CPF ou telefone. Pesquisa "contém" (ILIKE), sem diferenciar
// maiúsculas/minúsculas — mais amigável pra digitação rápida no balcão.
router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;

    let sql = `SELECT id_cliente, nome, cpf, telefone, email, cidade, ativo, data_cadastro
               FROM clientes WHERE ativo = TRUE`;
    const parametros = [];

    if (busca) {
      parametros.push(`%${busca}%`);
      sql += ` AND (nome ILIKE $1 OR cpf ILIKE $1 OR telefone ILIKE $1)`;
    }

    sql += ' ORDER BY nome';

    const resultado = await pool.query(sql, parametros);
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar clientes.' });
  }
});

// GET /api/clientes/:id -> detalhe do cliente
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      'SELECT * FROM clientes WHERE id_cliente = $1',
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar cliente.' });
  }
});

// Validação simples de formato de CPF (11 dígitos numéricos).
// Não verifica o dígito verificador matemático — para uma loja pequena,
// o principal risco é erro de digitação/CPF incompleto, que isso já cobre.
// Se no futuro for necessário validar o dígito verificador de verdade
// (ex: para emissão fiscal), essa função deve ser reforçada.
function cpfTemFormatoValido(cpf) {
  const somenteNumeros = cpf.replace(/\D/g, '');
  return somenteNumeros.length === 11;
}

router.post('/', async (req, res) => {
  try {
    const { nome, cpf, telefone, email, instagram, data_nascimento, bairro, cidade, observacoes } = req.body;

    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({ erro: 'Nome deve ter pelo menos 3 caracteres.' });
    }
    if (cpf && !cpfTemFormatoValido(cpf)) {
      return res.status(400).json({ erro: 'CPF inválido. Deve conter 11 dígitos.' });
    }

    const resultado = await pool.query(
      `INSERT INTO clientes (nome, cpf, telefone, email, instagram, data_nascimento, bairro, cidade, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [nome, cpf || null, telefone || null, email || null, instagram || null,
       data_nascimento || null, bairro || null, cidade || null, observacoes || null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um cliente cadastrado com esse CPF.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar cliente.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cpf, telefone, email, instagram, data_nascimento, bairro, cidade, observacoes, ativo } = req.body;

    if (cpf && !cpfTemFormatoValido(cpf)) {
      return res.status(400).json({ erro: 'CPF inválido. Deve conter 11 dígitos.' });
    }

    const resultado = await pool.query(
      `UPDATE clientes SET
         nome = COALESCE($1, nome), cpf = COALESCE($2, cpf), telefone = COALESCE($3, telefone),
         email = COALESCE($4, email), instagram = COALESCE($5, instagram),
         data_nascimento = COALESCE($6, data_nascimento), bairro = COALESCE($7, bairro),
         cidade = COALESCE($8, cidade), observacoes = COALESCE($9, observacoes), ativo = COALESCE($10, ativo)
       WHERE id_cliente = $11
       RETURNING *`,
      [nome, cpf, telefone, email, instagram, data_nascimento, bairro, cidade, observacoes, ativo, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar cliente.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      'UPDATE clientes SET ativo = FALSE WHERE id_cliente = $1 RETURNING id_cliente',
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    res.json({ mensagem: 'Cliente inativado com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao inativar cliente.' });
  }
});

module.exports = router;
