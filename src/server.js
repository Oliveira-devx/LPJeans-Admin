const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const funcionariosRoutes = require('./routes/funcionarios');
const tiposProdutoRoutes = require('./routes/tiposProduto');
const produtosRoutes = require('./routes/produtos');
const variacoesRoutes = require('./routes/variacoes');
const clientesRoutes = require('./routes/clientes');
const authMiddleware = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/funcionarios', authMiddleware, funcionariosRoutes);
app.use('/api/tipos-produto', authMiddleware, tiposProdutoRoutes);
app.use('/api/produtos', authMiddleware, produtosRoutes);
app.use('/api/produtos/:id_produto/variacoes', authMiddleware, variacoesRoutes);
app.use('/api/clientes', authMiddleware, clientesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando em http://localhost:${PORT}`);
});
