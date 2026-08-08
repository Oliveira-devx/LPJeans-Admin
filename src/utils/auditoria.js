// Helper reutilizável para gravar auditoria. Não registramos TODA ação
// trivial do sistema (isso poluiria o log e não ajudaria ninguém a achar
// o que importa) — focamos no que tem peso financeiro ou de segurança:
// login/logout, vendas finalizadas/canceladas, compras, caixa, ajustes
// de estoque e mudanças em usuários/permissões.

async function registrarAuditoria(clientOuPool, { tabela, operacao, registro, id_funcionario, detalhes }) {
  try {
    await clientOuPool.query(
      `INSERT INTO auditoria (tabela, operacao, registro, id_funcionario, detalhes)
       VALUES ($1, $2, $3, $4, $5)`,
      [tabela, operacao, registro, id_funcionario || null, detalhes || null]
    );
  } catch (erro) {
    // Auditoria nunca deve derrubar a operação principal — só logamos o erro.
    console.error('Falha ao registrar auditoria:', erro.message);
  }
}

module.exports = registrarAuditoria;
