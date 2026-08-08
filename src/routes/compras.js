const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const registrarAuditoria = require('../utils/auditoria');

// GET /api/compras -> lista compras com nome do fornecedor e do funcionário
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT c.id_compra, c.numero_nota, c.data_compra, c.valor_total, c.observacoes,
              f.razao_social AS fornecedor, fu.nome AS funcionario
       FROM compras c
       JOIN fornecedores f ON f.id_fornecedor = c.id_fornecedor
       JOIN funcionarios fu ON fu.id_funcionario = c.id_funcionario
       ORDER BY c.data_cadastro DESC
       LIMIT 100`
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar compras.' });
  }
});

// GET /api/compras/:id -> detalhe da compra + itens
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const compra = await pool.query(
      `SELECT c.*, f.razao_social AS fornecedor, fu.nome AS funcionario
       FROM compras c
       JOIN fornecedores f ON f.id_fornecedor = c.id_fornecedor
       JOIN funcionarios fu ON fu.id_funcionario = c.id_funcionario
       WHERE c.id_compra = $1`,
      [id]
    );

    if (compra.rows.length === 0) {
      return res.status(404).json({ erro: 'Compra não encontrada.' });
    }

    const itens = await pool.query(
      `SELECT ic.*, pv.tamanho, pv.cor, p.descricao AS produto
       FROM itens_compra ic
       JOIN produto_variacoes pv ON pv.id_variacao = ic.id_variacao
       JOIN produtos p ON p.id_produto = pv.id_produto
       WHERE ic.id_compra = $1`,
      [id]
    );

    res.json({ ...compra.rows[0], itens: itens.rows });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar detalhe da compra.' });
  }
});

// POST /api/compras -> cria a compra inteira (cabeçalho + itens + estoque + movimentação)
// TUDO dentro de uma única transação: se qualquer etapa falhar, nada é salvo.
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_fornecedor, id_funcionario, numero_nota, data_compra, observacoes, itens } = req.body;

    // ===== Validações — nunca confiamos no que vem do frontend =====
    if (!id_fornecedor || !id_funcionario) {
      return res.status(400).json({ erro: 'Fornecedor e funcionário responsável são obrigatórios.' });
    }
    if (!data_compra) {
      return res.status(400).json({ erro: 'Data da compra é obrigatória.' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'A compra precisa ter pelo menos um item.' });
    }
    for (const item of itens) {
      if (!item.id_variacao || !item.quantidade || item.quantidade <= 0) {
        return res.status(400).json({ erro: 'Todo item precisa de uma variação e quantidade maior que zero.' });
      }
      if (item.preco_custo === undefined || item.preco_custo < 0) {
        return res.status(400).json({ erro: 'Todo item precisa de um preço de custo válido.' });
      }
    }

    const valorTotal = itens.reduce((soma, item) => soma + item.quantidade * item.preco_custo, 0);

    await client.query('BEGIN');

    // 1. Cria o cabeçalho da compra
    const compraResultado = await client.query(
      `INSERT INTO compras (id_fornecedor, id_funcionario, numero_nota, data_compra, valor_total, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_compra`,
      [id_fornecedor, id_funcionario, numero_nota || null, data_compra, valorTotal, observacoes || null]
    );
    const idCompra = compraResultado.rows[0].id_compra;

    // 2. Para cada item: registra o item, soma no estoque, e grava o histórico
    for (const item of itens) {
      const subtotal = item.quantidade * item.preco_custo;

      await client.query(
        `INSERT INTO itens_compra (id_compra, id_variacao, quantidade, preco_custo, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [idCompra, item.id_variacao, item.quantidade, item.preco_custo, subtotal]
      );

      // O saldo do estoque é sempre atualizado aqui — nunca diretamente
      // pelo frontend. UPDATE ... SET quantidade_atual = quantidade_atual + X
      // é seguro mesmo com várias compras acontecendo ao mesmo tempo,
      // porque o PostgreSQL trava a linha durante a transação.
      const estoqueAtualizado = await client.query(
        `UPDATE estoque SET quantidade_atual = quantidade_atual + $1, ultima_atualizacao = CURRENT_TIMESTAMP
         WHERE id_variacao = $2
         RETURNING id_estoque`,
        [item.quantidade, item.id_variacao]
      );

      if (estoqueAtualizado.rows.length === 0) {
        // Isso só aconteceria se a variação não tivesse registro de estoque —
        // não deveria ser possível, já que toda variação nova já nasce com
        // um registro zerado (ver rotas de variações). Mas se acontecer,
        // abortamos a compra inteira em vez de deixar o dado inconsistente.
        throw new Error(`Variação ${item.id_variacao} não possui registro de estoque.`);
      }

      await client.query(
        `INSERT INTO movimentacao_estoque (id_variacao, id_funcionario, tipo, origem, quantidade, observacoes)
         VALUES ($1, $2, 'ENTRADA', 'COMPRA', $3, $4)`,
        [item.id_variacao, id_funcionario, item.quantidade, `Compra #${idCompra}`]
      );
    }

    await client.query('COMMIT');

    await registrarAuditoria(pool, {
      tabela: 'compras', operacao: 'INSERT', registro: idCompra,
      id_funcionario: id_funcionario, detalhes: `Compra registrada — valor total: R$ ${valorTotal.toFixed(2)}`,
    });

    res.status(201).json({ id_compra: idCompra, valor_total: valorTotal });
  } catch (erro) {
    await client.query('ROLLBACK');
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma compra cadastrada com esse número de nota.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao registrar compra. Nada foi salvo.' });
  } finally {
    client.release();
  }
});

module.exports = router;
