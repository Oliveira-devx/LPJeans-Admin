const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { permitirCargos } = require('../middleware/permissoes');

// Lista de módulos configuráveis. Administrador e Proprietaria sempre têm
// acesso a todos eles (regra fixa no middleware) — esta lista só importa
// pros demais cargos (hoje, só Vendedora).
const MODULOS_CONFIGURAVEIS = [
  { chave: 'funcionarios', rotulo: 'Funcionários (cadastrar/editar)' },
  { chave: 'fornecedores', rotulo: 'Fornecedores' },
  { chave: 'compras', rotulo: 'Compras' },
  { chave: 'usuarios', rotulo: 'Usuários e permissões' },
  { chave: 'vendas_desconto', rotulo: 'Aplicar desconto ou alterar preço na venda' },
  { chave: 'estoque', rotulo: 'Estoque (ajustes manuais)' },
  { chave: 'caixa', rotulo: 'Caixa' },
  { chave: 'relatorios', rotulo: 'Relatórios' },
];

const CARGOS_CONFIGURAVEIS = ['Vendedora'];

// GET /api/permissoes/minhas -> só os módulos que O PRÓPRIO usuário logado
// pode acessar. Qualquer pessoa autenticada pode chamar isso (é sobre ela
// mesma). Usado pelo menu lateral pra decidir o que mostrar.
router.get('/minhas', async (req, res) => {
  try {
    if (['Administrador', 'Proprietaria'].includes(req.usuario.cargo)) {
      return res.json({ cargo: req.usuario.cargo, todosLiberados: true, modulos: [] });
    }

    const resultado = await pool.query(
      `SELECT modulo FROM permissoes_modulo WHERE cargo = $1 AND permitido = TRUE`,
      [req.usuario.cargo]
    );

    res.json({
      cargo: req.usuario.cargo,
      todosLiberados: false,
      modulos: resultado.rows.map(r => r.modulo),
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar suas permissões.' });
  }
});

// GET /api/permissoes -> matriz completa (cargo x módulo), preenchendo com
// "false" os pares que ainda não têm registro no banco.
router.get('/', permitirCargos('Administrador', 'Proprietaria'), async (req, res) => {
  try {
    const resultado = await pool.query('SELECT cargo, modulo, permitido FROM permissoes_modulo');
    const existentes = new Map(resultado.rows.map(r => [`${r.cargo}::${r.modulo}`, r.permitido]));

    const matriz = CARGOS_CONFIGURAVEIS.map(cargo => ({
      cargo,
      modulos: MODULOS_CONFIGURAVEIS.map(m => ({
        modulo: m.chave,
        rotulo: m.rotulo,
        permitido: existentes.get(`${cargo}::${m.chave}`) || false,
      })),
    }));

    res.json(matriz);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar permissões.' });
  }
});

// PUT /api/permissoes -> liga/desliga UM módulo para UM cargo
router.put('/', permitirCargos('Administrador', 'Proprietaria'), async (req, res) => {
  try {
    const { cargo, modulo, permitido } = req.body;

    if (!CARGOS_CONFIGURAVEIS.includes(cargo)) {
      return res.status(400).json({ erro: 'Este cargo não é configurável (Administrador e Proprietaria sempre têm acesso total).' });
    }
    if (!MODULOS_CONFIGURAVEIS.some(m => m.chave === modulo)) {
      return res.status(400).json({ erro: 'Módulo inválido.' });
    }

    await pool.query(
      `INSERT INTO permissoes_modulo (cargo, modulo, permitido)
       VALUES ($1, $2, $3)
       ON CONFLICT (cargo, modulo) DO UPDATE SET permitido = EXCLUDED.permitido`,
      [cargo, modulo, !!permitido]
    );

    res.json({ mensagem: 'Permissão atualizada.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar permissão.' });
  }
});

module.exports = router;
