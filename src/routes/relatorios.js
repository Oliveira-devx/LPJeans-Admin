const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Converte o filtro de período em uma data de início.
function dataInicioPorPeriodo(periodo) {
  const agora = new Date();
  switch (periodo) {
    case 'hoje':
      return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    case 'semana': {
      const inicio = new Date(agora);
      inicio.setDate(agora.getDate() - 7);
      return inicio;
    }
    case 'mes':
    default: {
      const inicio = new Date(agora);
      inicio.setDate(agora.getDate() - 30);
      return inicio;
    }
  }
}

// GET /api/relatorios/vendas?periodo=hoje|semana|mes
router.get('/vendas', async (req, res) => {
  try {
    const periodo = req.query.periodo || 'hoje';
    const dataInicio = dataInicioPorPeriodo(periodo);

    const resumo = await pool.query(
      `SELECT COUNT(*) AS numero_vendas, COALESCE(SUM(valor_final), 0) AS faturamento
       FROM vendas
       WHERE status = 'FINALIZADA' AND data_venda >= $1`,
      [dataInicio]
    );

    const topProdutos = await pool.query(
      `SELECT p.descricao AS produto, SUM(iv.quantidade) AS quantidade_vendida,
              SUM(iv.subtotal) AS valor_vendido
       FROM itens_venda iv
       JOIN vendas v ON v.id_venda = iv.id_venda
       JOIN produto_variacoes pv ON pv.id_variacao = iv.id_variacao
       JOIN produtos p ON p.id_produto = pv.id_produto
       WHERE v.status = 'FINALIZADA' AND v.data_venda >= $1
       GROUP BY p.descricao
       ORDER BY quantidade_vendida DESC
       LIMIT 5`,
      [dataInicio]
    );

    const porFormaPagamento = await pool.query(
      `SELECT fp.forma, COALESCE(SUM(pg.valor), 0) AS total
       FROM pagamentos pg
       JOIN formas_pagamento fp ON fp.id_forma_pagamento = pg.id_forma_pagamento
       JOIN vendas v ON v.id_venda = pg.id_venda
       WHERE v.status = 'FINALIZADA' AND v.data_venda >= $1
       GROUP BY fp.forma
       ORDER BY total DESC`,
      [dataInicio]
    );

    const numeroVendas = Number(resumo.rows[0].numero_vendas);
    const faturamento = Number(resumo.rows[0].faturamento);

    res.json({
      periodo,
      numero_vendas: numeroVendas,
      faturamento,
      ticket_medio: numeroVendas > 0 ? faturamento / numeroVendas : 0,
      top_produtos: topProdutos.rows,
      por_forma_pagamento: porFormaPagamento.rows,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao gerar relatório de vendas.' });
  }
});

// GET /api/relatorios/auditoria?limite=100 -> log de ações importantes
router.get('/auditoria', async (req, res) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 300);
    const resultado = await pool.query(
      `SELECT a.*, f.nome AS funcionario
       FROM auditoria a
       LEFT JOIN funcionarios f ON f.id_funcionario = a.id_funcionario
       ORDER BY a.data_hora DESC
       LIMIT $1`,
      [limite]
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar auditoria.' });
  }
});

module.exports = router;
