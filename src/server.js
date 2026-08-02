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
const fornecedoresRoutes = require('./routes/fornecedores');
const comprasRoutes = require('./routes/compras');
const usuariosRoutes = require('./routes/usuarios');
const authMiddleware = require('./middleware/auth');
const permitirCargos = require('./middleware/permissoes');

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

// Módulos administrativos/financeiros — restritos a Administrador e Proprietaria.
// Vendedoras não precisam (e não devem) enxergar fornecedores, compras ou
// gerenciar outros usuários no dia a dia de venda.
app.use('/api/fornecedores', authMiddleware, permitirCargos('Administrador', 'Proprietaria'), fornecedoresRoutes);
app.use('/api/compras', authMiddleware, permitirCargos('Administrador', 'Proprietaria'), comprasRoutes);
app.use('/api/usuarios', authMiddleware, permitirCargos('Administrador', 'Proprietaria'), usuariosRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando em http://localhost:${PORT}`);
});
