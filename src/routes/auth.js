const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const MAX_TENTATIVAS = 5;

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, senha } = req.body;

    if (!login || !senha) {
      return res.status(400).json({ erro: 'Login e senha são obrigatórios.' });
    }

    const resultado = await pool.query(
      `SELECT id_usuario, login, senha_hash, bloqueado, ativo, tentativas_login
       FROM usuarios WHERE login = $1`,
      [login]
    );

    // Mensagem genérica de propósito: não revelamos se o erro foi
    // "login não existe" ou "senha errada" — evita dar dica a invasores.
    if (resultado.rows.length === 0) {
      return res.status(401).json({ erro: 'Login ou senha inválidos.' });
    }

    const usuario = resultado.rows[0];

    if (!usuario.ativo) {
      return res.status(403).json({ erro: 'Usuário inativo. Contate o administrador.' });
    }

    if (usuario.bloqueado) {
      return res.status(403).json({ erro: 'Usuário bloqueado por excesso de tentativas. Contate o administrador.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaCorreta) {
      const novasTentativas = usuario.tentativas_login + 1;
      const deveBloquear = novasTentativas >= MAX_TENTATIVAS;

      await pool.query(
        `UPDATE usuarios SET tentativas_login = $1, bloqueado = $2 WHERE id_usuario = $3`,
        [novasTentativas, deveBloquear, usuario.id_usuario]
      );

      return res.status(401).json({ erro: 'Login ou senha inválidos.' });
    }

    // Login certo: zera as tentativas e registra o horário
    await pool.query(
      `UPDATE usuarios SET tentativas_login = 0, ultimo_login = CURRENT_TIMESTAMP WHERE id_usuario = $1`,
      [usuario.id_usuario]
    );

    // Token válido por 14 horas — cobre um turno inteiro de trabalho
    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, login: usuario.login },
      process.env.JWT_SECRET,
      { expiresIn: '14h' }
    );

    res.json({ token });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao efetuar login.' });
  }
});

module.exports = router;
