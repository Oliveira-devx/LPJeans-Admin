// Este "middleware" roda ANTES das rotas protegidas.
// Ele confere se veio um token válido no cabeçalho da requisição.
// Se não vier, ou for inválido/expirado, bloqueia o acesso com 401.

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido. Faça login primeiro.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // fica disponível nas próximas rotas, se precisar
    next(); // libera a passagem para a rota real
  } catch (erro) {
    return res.status(401).json({ erro: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

module.exports = authMiddleware;
