const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { permitirModulo } = require('../middleware/permissoes');

const CARGOS_SEMPRE_LIBERADOS = ['Administrador', 'Proprietaria'];

// Verifica se o cargo do usuário pode dar desconto/alterar preço.
// Não usamos permitirModulo() aqui como middleware de rota inteira porque
// a permissão só é exigida SE realmente houver desconto — uma vendedora
// sem essa permissão ainda pode vender normalmente, sem desconto.
async function podeDarDesconto(cargo) {
  if (CARGOS_SEMPRE_LIBERADOS.includes(cargo)) return true;
  const resultado = await pool.query(
    `SELECT permitido FROM permissoes_modulo WHERE cargo = $1 AND modulo = 'vendas_desconto'`,
    [cargo]
  );
  return resultado.rows.length > 0 && resultado.rows[0].permitido;
}

// GET /api/vendas?status=ABERTA -> lista vendas (filtro opcional por status)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const parametros = [];
    let sql = `
      SELECT v.id_venda, v.status, v.data_venda, v.valor_total, v.valor_final, v.desconto_total,
             c.nome AS cliente, f.nome AS funcionario
      FROM vendas v
      LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
      JOIN funcionarios f ON f.id_funcionario = v.id_funcionario
    `;
    if (status) {
      parametros.push(status);
      sql += ' WHERE v.status = $1';
    }
    sql += ' ORDER BY v.data_venda DESC LIMIT 100';

    const resultado = await pool.query(sql, parametros);
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar vendas.' });
  }
});

// GET /api/vendas/:id -> detalhe completo (itens + pagamentos, se houver)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const venda = await pool.query(
      `SELECT v.*, c.nome AS cliente, f.nome AS funcionario
       FROM vendas v
       LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
       JOIN funcionarios f ON f.id_funcionario = v.id_funcionario
       WHERE v.id_venda = $1`,
      [id]
    );
    if (venda.rows.length === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada.' });
    }

    const itens = await pool.query(
      `SELECT iv.*, pv.tamanho, pv.cor, p.descricao AS produto
       FROM itens_venda iv
       JOIN produto_variacoes pv ON pv.id_variacao = iv.id_variacao
       JOIN produtos p ON p.id_produto = pv.id_produto
       WHERE iv.id_venda = $1
       ORDER BY iv.id_item_venda`,
      [id]
    );

    const pagamentos = await pool.query(
      `SELECT pg.*, fp.forma
       FROM pagamentos pg
       JOIN formas_pagamento fp ON fp.id_forma_pagamento = pg.id_forma_pagamento
       WHERE pg.id_venda = $1`,
      [id]
    );

    res.json({ ...venda.rows[0], itens: itens.rows, pagamentos: pagamentos.rows });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar detalhe da venda.' });
  }
});

// POST /api/vendas -> inicia uma venda em aberto (carrinho vazio)
router.post('/', async (req, res) => {
  try {
    const { id_cliente, id_funcionario } = req.body;

    if (!id_funcionario) {
      return res.status(400).json({ erro: 'Informe quem está realizando a venda.' });
    }

    const resultado = await pool.query(
      `INSERT INTO vendas (id_cliente, id_funcionario, valor_total, valor_final, status)
       VALUES ($1, $2, 0, 0, 'ABERTA')
       RETURNING id_venda`,
      [id_cliente || null, id_funcionario]
    );

    res.status(201).json({ id_venda: resultado.rows[0].id_venda });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao iniciar venda.' });
  }
});

// POST /api/vendas/:id/itens -> adiciona um item à venda em aberto
router.post('/:id/itens', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_variacao, quantidade, preco_vendido, valor_desconto } = req.body;
    const desconto = Number(valor_desconto) || 0;

    if (!id_variacao || !quantidade || quantidade <= 0) {
      return res.status(400).json({ erro: 'Variação e quantidade são obrigatórias.' });
    }
    if (preco_vendido === undefined || preco_vendido < 0) {
      return res.status(400).json({ erro: 'Informe um preço de venda válido.' });
    }

    const venda = await pool.query('SELECT status FROM vendas WHERE id_venda = $1', [id]);
    if (venda.rows.length === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada.' });
    }
    if (venda.rows[0].status !== 'ABERTA') {
      return res.status(400).json({ erro: 'Esta venda já foi finalizada ou cancelada.' });
    }

    const produtoInfo = await pool.query(
      `SELECT p.preco_venda FROM produto_variacoes v
       JOIN produtos p ON p.id_produto = v.id_produto
       WHERE v.id_variacao = $1`,
      [id_variacao]
    );
    if (produtoInfo.rows.length === 0) {
      return res.status(404).json({ erro: 'Variação não encontrada.' });
    }
    const precoTabela = Number(produtoInfo.rows[0].preco_venda);

    // Regra de negócio: só quem tem permissão pode vender abaixo do preço de tabela.
    const temDesconto = preco_vendido < precoTabela || desconto > 0;
    if (temDesconto) {
      const autorizado = await podeDarDesconto(req.usuario.cargo);
      if (!autorizado) {
        return res.status(403).json({ erro: 'Você não tem permissão para alterar preço ou dar desconto.' });
      }
    }

    const subtotal = Number((preco_vendido * quantidade - desconto).toFixed(2));
    if (subtotal < 0) {
      return res.status(400).json({ erro: 'O desconto não pode deixar o subtotal negativo.' });
    }

    const resultado = await pool.query(
      `INSERT INTO itens_venda (id_venda, id_variacao, quantidade, preco_tabela, preco_vendido, valor_desconto, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, id_variacao, quantidade, precoTabela, preco_vendido, desconto, subtotal]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao adicionar item.' });
  }
});

// PUT /api/vendas/:id/itens/:idItem -> edita quantidade/preço/desconto de um item
router.put('/:id/itens/:idItem', async (req, res) => {
  try {
    const { id, idItem } = req.params;
    const { quantidade, preco_vendido, valor_desconto } = req.body;
    const desconto = Number(valor_desconto) || 0;

    if (!quantidade || quantidade <= 0) {
      return res.status(400).json({ erro: 'Quantidade inválida.' });
    }
    if (preco_vendido === undefined || preco_vendido < 0) {
      return res.status(400).json({ erro: 'Preço inválido.' });
    }

    const venda = await pool.query('SELECT status FROM vendas WHERE id_venda = $1', [id]);
    if (venda.rows.length === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada.' });
    }
    if (venda.rows[0].status !== 'ABERTA') {
      return res.status(400).json({ erro: 'Esta venda já foi finalizada ou cancelada.' });
    }

    const itemAtual = await pool.query('SELECT preco_tabela FROM itens_venda WHERE id_item_venda = $1', [idItem]);
    if (itemAtual.rows.length === 0) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }
    const precoTabela = Number(itemAtual.rows[0].preco_tabela);

    const temDesconto = preco_vendido < precoTabela || desconto > 0;
    if (temDesconto) {
      const autorizado = await podeDarDesconto(req.usuario.cargo);
      if (!autorizado) {
        return res.status(403).json({ erro: 'Você não tem permissão para alterar preço ou dar desconto.' });
      }
    }

    const subtotal = Number((preco_vendido * quantidade - desconto).toFixed(2));
    if (subtotal < 0) {
      return res.status(400).json({ erro: 'O desconto não pode deixar o subtotal negativo.' });
    }

    const resultado = await pool.query(
      `UPDATE itens_venda SET quantidade = $1, preco_vendido = $2, valor_desconto = $3, subtotal = $4
       WHERE id_item_venda = $5 AND id_venda = $6
       RETURNING *`,
      [quantidade, preco_vendido, desconto, subtotal, idItem, id]
    );

    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar item.' });
  }
});

// DELETE /api/vendas/:id/itens/:idItem -> remove item de uma venda em aberto
router.delete('/:id/itens/:idItem', async (req, res) => {
  try {
    const { id, idItem } = req.params;

    const venda = await pool.query('SELECT status FROM vendas WHERE id_venda = $1', [id]);
    if (venda.rows.length === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada.' });
    }
    if (venda.rows[0].status !== 'ABERTA') {
      return res.status(400).json({ erro: 'Esta venda já foi finalizada ou cancelada.' });
    }

    await pool.query('DELETE FROM itens_venda WHERE id_item_venda = $1 AND id_venda = $2', [idItem, id]);
    res.json({ mensagem: 'Item removido.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover item.' });
  }
});

// PUT /api/vendas/:id/cancelar -> cancela uma venda em aberto (sem impacto no estoque,
// já que o estoque só é baixado na finalização)
router.put('/:id/cancelar', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      `UPDATE vendas SET status = 'CANCELADA' WHERE id_venda = $1 AND status = 'ABERTA' RETURNING id_venda`,
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(400).json({ erro: 'Só é possível cancelar vendas em aberto.' });
    }
    res.json({ mensagem: 'Venda cancelada.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cancelar venda.' });
  }
});

// POST /api/vendas/:id/finalizar -> a operação mais crítica do sistema.
// Confere estoque, baixa estoque, registra pagamentos, tudo numa transação
// só. Usa FOR UPDATE para travar as linhas de estoque durante a operação —
// isso impede que duas vendas finalizando ao mesmo tempo vendam a mesma
// última peça duas vezes.
router.post('/:id/finalizar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { desconto_total, pagamentos } = req.body;
    const descontoTotal = Number(desconto_total) || 0;

    if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
      return res.status(400).json({ erro: 'Informe ao menos uma forma de pagamento.' });
    }

    if (descontoTotal > 0) {
      const autorizado = await podeDarDesconto(req.usuario.cargo);
      if (!autorizado) {
        return res.status(403).json({ erro: 'Você não tem permissão para aplicar desconto geral na venda.' });
      }
    }

    await client.query('BEGIN');

    const vendaResultado = await client.query(
      `SELECT status FROM vendas WHERE id_venda = $1 FOR UPDATE`,
      [id]
    );
    if (vendaResultado.rows.length === 0) {
      throw Object.assign(new Error('Venda não encontrada.'), { status: 404 });
    }
    if (vendaResultado.rows[0].status !== 'ABERTA') {
      throw Object.assign(new Error('Esta venda já foi finalizada ou cancelada.'), { status: 400 });
    }

    const itens = await client.query(
      `SELECT * FROM itens_venda WHERE id_venda = $1`,
      [id]
    );
    if (itens.rows.length === 0) {
      throw Object.assign(new Error('Não é possível finalizar uma venda sem itens.'), { status: 400 });
    }

    const valorTotal = itens.rows.reduce((soma, item) => soma + Number(item.subtotal), 0);
    const valorFinal = Number((valorTotal - descontoTotal).toFixed(2));
    if (valorFinal < 0) {
      throw Object.assign(new Error('O desconto geral não pode deixar o valor final negativo.'), { status: 400 });
    }

    // Confere e baixa o estoque de cada item, um por vez, com a linha travada.
    for (const item of itens.rows) {
      const estoque = await client.query(
        `SELECT quantidade_atual FROM estoque WHERE id_variacao = $1 FOR UPDATE`,
        [item.id_variacao]
      );
      if (estoque.rows.length === 0 || estoque.rows[0].quantidade_atual < item.quantidade) {
        throw Object.assign(
          new Error(`Estoque insuficiente para um dos itens da venda (variação ${item.id_variacao}).`),
          { status: 409 }
        );
      }

      await client.query(
        `UPDATE estoque SET quantidade_atual = quantidade_atual - $1, ultima_atualizacao = CURRENT_TIMESTAMP
         WHERE id_variacao = $2`,
        [item.quantidade, item.id_variacao]
      );

      await client.query(
        `INSERT INTO movimentacao_estoque (id_variacao, id_funcionario, tipo, origem, quantidade, observacoes)
         VALUES ($1, (SELECT id_funcionario FROM vendas WHERE id_venda = $2), 'SAIDA', 'VENDA', $3, $4)`,
        [item.id_variacao, id, item.quantidade, `Venda #${id}`]
      );
    }

    // Confere se a soma dos pagamentos bate com o valor final (com pequena
    // tolerância pra arredondamento de centavos).
    const somaPagamentos = pagamentos.reduce((soma, p) => soma + Number(p.valor), 0);
    if (Math.abs(somaPagamentos - valorFinal) > 0.01) {
      throw Object.assign(
        new Error(`O total pago (${somaPagamentos.toFixed(2)}) não bate com o valor da venda (${valorFinal.toFixed(2)}).`),
        { status: 400 }
      );
    }

    for (const pagamento of pagamentos) {
      await client.query(
        `INSERT INTO pagamentos (id_venda, id_forma_pagamento, parcelas, valor)
         VALUES ($1, $2, $3, $4)`,
        [id, pagamento.id_forma_pagamento, pagamento.parcelas || 1, pagamento.valor]
      );
    }

    await client.query(
      `UPDATE vendas SET status = 'FINALIZADA', valor_total = $1, valor_final = $2, desconto_total = $3
       WHERE id_venda = $4`,
      [valorTotal, valorFinal, descontoTotal, id]
    );

    await client.query('COMMIT');
    res.json({ mensagem: 'Venda finalizada com sucesso.', valor_final: valorFinal });
  } catch (erro) {
    await client.query('ROLLBACK');
    const status = erro.status || 500;
    if (status === 500) console.error(erro);
    res.status(status).json({ erro: erro.message || 'Erro ao finalizar venda. Nada foi salvo.' });
  } finally {
    client.release();
  }
});

module.exports = router;
