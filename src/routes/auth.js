const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const MAX_TENTATIVAS = 5;

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, senha } = req.body;

    if (!login || !senha) {
      return res.status(400).json({ erro: 'Login e senha são obrigatórios.' });
    }

    const resultado = await pool.query(
      `SELECT u.id_usuario, u.login, u.senha_hash, u.bloqueado, u.ativo, u.tentativas_login,
              f.id_funcionario, f.nome, f.cargo
       FROM usuarios u
       JOIN funcionarios f ON f.id_funcionario = u.id_funcionario
       WHERE u.login = $1`,
      [login]
    );

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

    await pool.query(
      `UPDATE usuarios SET tentativas_login = 0, ultimo_login = CURRENT_TIMESTAMP WHERE id_usuario = $1`,
      [usuario.id_usuario]
    );

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        login: usuario.login,
        id_funcionario: usuario.id_funcionario,
        nome: usuario.nome,
        cargo: usuario.cargo,
      },
      process.env.JWT_SECRET,
      { expiresIn: '14h' }
    );

    res.json({ token });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao efetuar login.' });
  }
});

// GET /api/auth/status -> dados da conta de acesso do usuário logado
// (protegida: exige token válido, já que só faz sentido "ver meu status" logado)
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT login, bloqueado, tentativas_login, ultimo_login FROM usuarios WHERE id_usuario = $1`,
      [req.usuario.id_usuario]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar status da conta.' });
  }
});

// POST /api/auth/resetar-tentativas -> zera o contador de tentativas erradas
// Útil como medida preventiva: se alguém errou a senha algumas vezes mas
// já conseguiu entrar depois, dá pra zerar o contador sem esperar acumular
// erro futuro em cima de erro antigo.
router.post('/resetar-tentativas', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE usuarios SET tentativas_login = 0 WHERE id_usuario = $1`,
      [req.usuario.id_usuario]
    );
    res.json({ mensagem: 'Tentativas de login resetadas com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao resetar tentativas.' });
  }
});

// PUT /api/auth/senha -> troca a senha, exigindo a senha atual como confirmação
router.put('/senha', authMiddleware, async (req, res) => {
  try {
    const { senha_atual, senha_nova } = req.body;

    if (!senha_atual || !senha_nova) {
      return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
    }
    if (senha_nova.length < 8) {
      return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    }

    const resultado = await pool.query(
      `SELECT senha_hash FROM usuarios WHERE id_usuario = $1`,
      [req.usuario.id_usuario]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const senhaAtualCorreta = await bcrypt.compare(senha_atual, resultado.rows[0].senha_hash);
    if (!senhaAtualCorreta) {
      return res.status(401).json({ erro: 'Senha atual incorreta.' });
    }

    const novoHash = await bcrypt.hash(senha_nova, 10);
    await pool.query(
      `UPDATE usuarios SET senha_hash = $1 WHERE id_usuario = $2`,
      [novoHash, req.usuario.id_usuario]
    );

    res.json({ mensagem: 'Senha alterada com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao alterar senha.' });
  }
});

module.exports = router;
