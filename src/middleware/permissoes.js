// Middleware de AUTORIZAÇÃO por módulo, configurável pela própria
// proprietária, sem precisar mexer em código.
//
// Regra de segurança fixa (não configurável, de propósito): Administrador
// e Proprietaria SEMPRE têm acesso total. Isso existe para impedir que
// alguém, por engano, tire o próprio acesso da tela de permissões e fique
// sem conseguir corrigir depois.
//
// Para os demais cargos, a permissão vem da tabela `permissoes_modulo`.

const pool = require('../config/db');

const CARGOS_SEMPRE_LIBERADOS = ['Administrador', 'Proprietaria'];

function permitirModulo(nomeModulo) {
  return async (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    if (CARGOS_SEMPRE_LIBERADOS.includes(req.usuario.cargo)) {
      return next();
    }

    try {
      const resultado = await pool.query(
        `SELECT permitido FROM permissoes_modulo WHERE cargo = $1 AND modulo = $2`,
        [req.usuario.cargo, nomeModulo]
      );

      // Se não existe registro nenhum ainda, o padrão é NEGAR — mais seguro
      // "esquecer de liberar" do que "esquecer de bloquear".
      const permitido = resultado.rows.length > 0 && resultado.rows[0].permitido;

      if (!permitido) {
        return res.status(403).json({
          erro: 'Você não tem permissão para acessar este recurso. Fale com um administrador.',
        });
      }

      next();
    } catch (erro) {
      console.error(erro);
      res.status(500).json({ erro: 'Erro ao verificar permissões.' });
    }
  };
}

// Continua existindo para casos fixos (ex: a própria tela de permissões —
// não faz sentido ela mesma ser configurável, senão vira um paradoxo).
function permitirCargos(...cargosPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !cargosPermitidos.includes(req.usuario.cargo)) {
      return res.status(403).json({
        erro: 'Você não tem permissão para acessar este recurso. Fale com um administrador.',
      });
    }
    next();
  };
}

module.exports = { permitirModulo, permitirCargos };
