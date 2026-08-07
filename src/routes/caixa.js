const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Calcula o valor esperado em dinheiro no caixa: valor inicial + entradas
// manuais - saídas manuais + vendas pagas em dinheiro durante o período
// que esse caixa esteve aberto. Cartão e Pix não entram aqui porque não
// afetam o dinheiro físico na gaveta.
async function calcularValorEsperado(caixa) {
  const movimentacoes = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) AS entradas,
       COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) AS saidas
     FROM movimentacao_caixa WHERE id_caixa = $1`,
    [caixa.id_caixa]
  );

  const vendasDinheiro = await pool.query(
    `SELECT COALESCE(SUM(pg.valor), 0) AS total
     FROM pagamentos pg
     JOIN formas_pagamento fp ON fp.id_forma_pagamento = pg.id_forma_pagamento
     WHERE fp.forma = 'Dinheiro'
       AND pg.data_pagamento >= $1
       AND pg.data_pagamento <= $2`,
    [caixa.data_abertura, caixa.data_fechamento || new Date()]
  );

  const { entradas, saidas } = movimentacoes.rows[0];
  const totalDinheiro = vendasDinheiro.rows[0].total;

  return Number(caixa.valor_inicial) + Number(entradas) - Number(saidas) + Number(totalDinheiro);
}

// GET /api/caixa/atual -> o caixa aberto agora, se houver
router.get('/atual', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT c.*, f.nome AS funcionario FROM caixa c
       JOIN funcionarios f ON f.id_funcionario = c.id_funcionario
       WHERE c.status = 'ABERTO' LIMIT 1`
    );
    if (resultado.rows.length === 0) {
      return res.json({ aberto: false });
    }
    const caixa = resultado.rows[0];
    const valorEsperado = await calcularValorEsperado(caixa);
    res.json({ aberto: true, ...caixa, valor_esperado_atual: valorEsperado });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar caixa atual.' });
  }
});

// GET /api/caixa?status=FECHADO -> histórico
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const parametros = [];
    let sql = `SELECT c.*, f.nome AS funcionario FROM caixa c
               JOIN funcionarios f ON f.id_funcionario = c.id_funcionario`;
    if (status) {
      parametros.push(status);
      sql += ' WHERE c.status = $1';
    }
    sql += ' ORDER BY c.data_abertura DESC LIMIT 50';

    const resultado = await pool.query(sql, parametros);
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar histórico de caixa.' });
  }
});

// GET /api/caixa/:id -> detalhe + movimentações manuais
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caixaResultado = await pool.query(
      `SELECT c.*, f.nome AS funcionario FROM caixa c
       JOIN funcionarios f ON f.id_funcionario = c.id_funcionario
       WHERE c.id_caixa = $1`,
      [id]
    );
    if (caixaResultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Caixa não encontrado.' });
    }
    const caixa = caixaResultado.rows[0];

    const movimentacoes = await pool.query(
      `SELECT m.*, f.nome AS funcionario FROM movimentacao_caixa m
       JOIN funcionarios f ON f.id_funcionario = m.id_funcionario
       WHERE m.id_caixa = $1 ORDER BY m.data_movimentacao DESC`,
      [id]
    );

    const valorEsperado = caixa.status === 'ABERTO' ? await calcularValorEsperado(caixa) : caixa.valor_esperado;

    res.json({ ...caixa, movimentacoes: movimentacoes.rows, valor_esperado_atual: valorEsperado });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar detalhe do caixa.' });
  }
});

// POST /api/caixa/abrir
router.post('/abrir', async (req, res) => {
  try {
    const { valor_inicial, id_funcionario } = req.body;

    if (valor_inicial === undefined || valor_inicial < 0) {
      return res.status(400).json({ erro: 'Informe um valor inicial válido.' });
    }
    if (!id_funcionario) {
      return res.status(400).json({ erro: 'Informe quem está abrindo o caixa.' });
    }

    const jaAberto = await pool.query(`SELECT id_caixa FROM caixa WHERE status = 'ABERTO'`);
    if (jaAberto.rows.length > 0) {
      return res.status(409).json({ erro: 'Já existe um caixa aberto. Feche-o antes de abrir outro.' });
    }

    const resultado = await pool.query(
      `INSERT INTO caixa (data_abertura, valor_inicial, status, id_funcionario)
       VALUES (CURRENT_TIMESTAMP, $1, 'ABERTO', $2)
       RETURNING id_caixa`,
      [valor_inicial, id_funcionario]
    );

    res.status(201).json({ id_caixa: resultado.rows[0].id_caixa });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao abrir caixa.' });
  }
});

// POST /api/caixa/:id/movimentacao -> sangria (SAIDA) ou suprimento (ENTRADA) manual
router.post('/:id/movimentacao', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, descricao, valor } = req.body;

    if (!['ENTRADA', 'SAIDA'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido (use ENTRADA ou SAIDA).' });
    }
    if (!valor || valor <= 0) {
      return res.status(400).json({ erro: 'Informe um valor válido.' });
    }

    const caixa = await pool.query('SELECT status FROM caixa WHERE id_caixa = $1', [id]);
    if (caixa.rows.length === 0) {
      return res.status(404).json({ erro: 'Caixa não encontrado.' });
    }
    if (caixa.rows[0].status !== 'ABERTO') {
      return res.status(400).json({ erro: 'Este caixa já está fechado.' });
    }

    const resultado = await pool.query(
      `INSERT INTO movimentacao_caixa (id_caixa, tipo, descricao, valor, id_funcionario)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, tipo, descricao || null, valor, req.usuario.id_funcionario]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao registrar movimentação.' });
  }
});

// POST /api/caixa/:id/fechar
router.post('/:id/fechar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { valor_contado } = req.body;

    if (valor_contado === undefined || valor_contado < 0) {
      return res.status(400).json({ erro: 'Informe o valor contado na gaveta.' });
    }

    await client.query('BEGIN');

    const caixaResultado = await client.query('SELECT * FROM caixa WHERE id_caixa = $1 FOR UPDATE', [id]);
    if (caixaResultado.rows.length === 0) {
      throw Object.assign(new Error('Caixa não encontrado.'), { status: 404 });
    }
    if (caixaResultado.rows[0].status !== 'ABERTO') {
      throw Object.assign(new Error('Este caixa já está fechado.'), { status: 400 });
    }

    const valorEsperado = await calcularValorEsperado(caixaResultado.rows[0]);
    const diferenca = Number((valor_contado - valorEsperado).toFixed(2));

    await client.query(
      `UPDATE caixa SET status = 'FECHADO', data_fechamento = CURRENT_TIMESTAMP,
              valor_esperado = $1, valor_contado = $2, diferenca = $3
       WHERE id_caixa = $4`,
      [valorEsperado, valor_contado, diferenca, id]
    );

    await client.query('COMMIT');
    res.json({ mensagem: 'Caixa fechado com sucesso.', valor_esperado: valorEsperado, diferenca });
  } catch (erro) {
    await client.query('ROLLBACK');
    const status = erro.status || 500;
    if (status === 500) console.error(erro);
    res.status(status).json({ erro: erro.message || 'Erro ao fechar caixa.' });
  } finally {
    client.release();
  }
});

module.exports = router;
