const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { permitirModulo } = require('../middleware/permissoes');
const registrarAuditoria = require('../utils/auditoria');

// GET /api/estoque?busca=texto -> lista todas as variações com saldo,
// aberto pra qualquer pessoa logada (vendedora precisa conferir estoque
// no dia a dia, mesmo sem poder ajustar).
router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;
    const parametros = [];
    let sql = `
      SELECT v.id_variacao, v.tamanho, v.cor, v.codigo_barras, v.estoque_minimo,
             p.id_produto, p.referencia, p.descricao AS produto,
             e.quantidade_atual, e.ultima_atualizacao
      FROM produto_variacoes v
      JOIN produtos p ON p.id_produto = v.id_produto
      JOIN estoque e ON e.id_variacao = v.id_variacao
      WHERE v.ativo = TRUE
    `;
    if (busca) {
      parametros.push(`%${busca}%`);
      sql += ` AND (p.descricao ILIKE $1 OR p.referencia ILIKE $1 OR v.codigo_barras ILIKE $1)`;
    }
    sql += ' ORDER BY p.descricao, v.tamanho, v.cor';

    const resultado = await pool.query(sql, parametros);
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar estoque.' });
  }
});

// GET /api/estoque/:idVariacao/movimentacoes -> histórico de uma variação
router.get('/:idVariacao/movimentacoes', async (req, res) => {
  try {
    const { idVariacao } = req.params;
    const resultado = await pool.query(
      `SELECT m.*, f.nome AS funcionario
       FROM movimentacao_estoque m
       JOIN funcionarios f ON f.id_funcionario = m.id_funcionario
       WHERE m.id_variacao = $1
       ORDER BY m.data_movimentacao DESC
       LIMIT 100`,
      [idVariacao]
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar movimentações.' });
  }
});

// POST /api/estoque/:idVariacao/ajuste -> ajuste manual (só quem tem a
// permissão "estoque" liberada). Delta pode ser positivo (achou peça a
// mais na contagem) ou negativo (perda, avaria, extravio).
router.post('/:idVariacao/ajuste', permitirModulo('estoque'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { idVariacao } = req.params;
    const { delta, observacoes } = req.body;

    if (!delta || delta === 0) {
      return res.status(400).json({ erro: 'Informe uma quantidade diferente de zero para o ajuste.' });
    }
    if (!observacoes || observacoes.trim().length < 3) {
      return res.status(400).json({ erro: 'Descreva o motivo do ajuste (obrigatório para auditoria).' });
    }

    await client.query('BEGIN');

    const estoqueAtual = await client.query(
      'SELECT quantidade_atual FROM estoque WHERE id_variacao = $1 FOR UPDATE',
      [idVariacao]
    );
    if (estoqueAtual.rows.length === 0) {
      throw Object.assign(new Error('Variação não encontrada.'), { status: 404 });
    }

    const novoSaldo = estoqueAtual.rows[0].quantidade_atual + Number(delta);
    if (novoSaldo < 0) {
      throw Object.assign(
        new Error(`Esse ajuste deixaria o estoque negativo (saldo atual: ${estoqueAtual.rows[0].quantidade_atual}).`),
        { status: 400 }
      );
    }

    await client.query(
      'UPDATE estoque SET quantidade_atual = $1, ultima_atualizacao = CURRENT_TIMESTAMP WHERE id_variacao = $2',
      [novoSaldo, idVariacao]
    );

    await client.query(
      `INSERT INTO movimentacao_estoque (id_variacao, id_funcionario, tipo, origem, quantidade, observacoes)
       VALUES ($1, $2, 'AJUSTE', 'AJUSTE_MANUAL', $3, $4)`,
      [idVariacao, req.usuario.id_funcionario, Math.abs(delta), `${delta > 0 ? 'Acréscimo' : 'Redução'}: ${observacoes}`]
    );

    await client.query('COMMIT');

    await registrarAuditoria(pool, {
      tabela: 'estoque', operacao: 'UPDATE', registro: Number(idVariacao),
      id_funcionario: req.usuario.id_funcionario,
      detalhes: `Ajuste manual: ${delta > 0 ? '+' : ''}${delta} — ${observacoes}`,
    });

    res.json({ mensagem: 'Ajuste realizado com sucesso.', novo_saldo: novoSaldo });
  } catch (erro) {
    await client.query('ROLLBACK');
    const status = erro.status || 500;
    if (status === 500) console.error(erro);
    res.status(status).json({ erro: erro.message || 'Erro ao ajustar estoque.' });
  } finally {
    client.release();
  }
});

module.exports = router;
