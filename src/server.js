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
const permissoesRoutes = require('./routes/permissoes');
const vendasRoutes = require('./routes/vendas');
const formasPagamentoRoutes = require('./routes/formasPagamento');
const estoqueRoutes = require('./routes/estoque');
const caixaRoutes = require('./routes/caixa');
const relatoriosRoutes = require('./routes/relatorios');
const authMiddleware = require('./middleware/auth');
const { permitirModulo, permitirCargos } = require('./middleware/permissoes');

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
app.use('/api/formas-pagamento', authMiddleware, formasPagamentoRoutes);
app.use('/api/vendas', authMiddleware, vendasRoutes);

// Consulta de estoque é aberta a qualquer cargo logado; o AJUSTE manual
// (dentro do próprio arquivo de rotas) é que exige a permissão 'estoque'.
app.use('/api/estoque', authMiddleware, estoqueRoutes);

// Módulos com permissão configurável pela tela de Configurações.
app.use('/api/fornecedores', authMiddleware, permitirModulo('fornecedores'), fornecedoresRoutes);
app.use('/api/compras', authMiddleware, permitirModulo('compras'), comprasRoutes);
app.use('/api/usuarios', authMiddleware, permitirModulo('usuarios'), usuariosRoutes);
app.use('/api/caixa', authMiddleware, permitirModulo('caixa'), caixaRoutes);
app.use('/api/relatorios', authMiddleware, permitirModulo('relatorios'), relatoriosRoutes);
app.use('/api/permissoes', authMiddleware, permissoesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando em http://localhost:${PORT}`);
});
