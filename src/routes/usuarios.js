// Rotas ADMINISTRATIVAS de usuários — diferente de /api/auth, que é
// "autoatendimento" (cada um mexe na própria senha). Aqui é o
// administrador/proprietária criando e gerenciando o acesso de outras
// pessoas. Por isso essa rota inteira é restrita por cargo (ver server.js).

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const registrarAuditoria = require('../utils/auditoria');

// GET /api/usuarios -> lista todos os logins existentes, com nome/cargo do funcionário
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT u.id_usuario, u.login, u.bloqueado, u.ativo, u.ultimo_login, u.tentativas_login,
              f.id_funcionario, f.nome AS funcionario, f.cargo
       FROM usuarios u
       JOIN funcionarios f ON f.id_funcionario = u.id_funcionario
       ORDER BY f.nome`
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar usuários.' });
  }
});

// POST /api/usuarios -> cria um novo login vinculado a um funcionário já existente
router.post('/', async (req, res) => {
  try {
    const { id_funcionario, login, senha } = req.body;

    if (!id_funcionario || !login || !senha) {
      return res.status(400).json({ erro: 'Funcionário, login e senha são obrigatórios.' });
    }
    if (senha.length < 8) {
      return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres.' });
    }

    const hash = await bcrypt.hash(senha, 10);

    const resultado = await pool.query(
      `INSERT INTO usuarios (id_funcionario, login, senha_hash)
       VALUES ($1, $2, $3)
       RETURNING id_usuario, login`,
      [id_funcionario, login, hash]
    );

    await registrarAuditoria(pool, {
      tabela: 'usuarios', operacao: 'INSERT', registro: resultado.rows[0].id_usuario,
      id_funcionario: req.usuario.id_funcionario,
      detalhes: `Novo login criado: ${login} (para funcionário #${id_funcionario})`,
    });

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Esse login já existe, ou esse funcionário já possui um usuário de acesso.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

// PUT /api/usuarios/:id -> bloquear/desbloquear ou ativar/desativar um login
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { bloqueado, ativo } = req.body;

    const resultado = await pool.query(
      `UPDATE usuarios SET
         bloqueado = COALESCE($1, bloqueado),
         ativo = COALESCE($2, ativo),
         tentativas_login = CASE WHEN $1 = FALSE THEN 0 ELSE tentativas_login END
       WHERE id_usuario = $3
       RETURNING id_usuario, login, bloqueado, ativo`,
      [bloqueado, ativo, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
});

module.exports = router;
