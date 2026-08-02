// Middleware de AUTORIZAÇÃO (diferente de autenticação — o authMiddleware
// já confirma QUEM é a pessoa; este aqui confirma O QUE ela pode fazer).
//
// Uso: router.post('/', permitirCargos('Administrador', 'Proprietaria'), handler)
//
// Precisa rodar DEPOIS do authMiddleware, porque depende de req.usuario
// (que é preenchido a partir do token JWT).

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

module.exports = permitirCargos;
