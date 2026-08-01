exigirLogin();
montarSidebar('dashboard');
montarTopbar('Dashboard');

// Indicadores que já temos dado real, e os que dependem de módulos
// futuros (Vendas, Clientes, Compras, Caixa) — mostramos "—" de forma
// honesta em vez de inventar um número.
const INDICADORES_BASE = [
  { chave: 'vendasHoje', rotulo: 'Vendas de hoje', disponivel: false },
  { chave: 'faturamentoDia', rotulo: 'Faturamento do dia', disponivel: false },
  { chave: 'produtosCadastrados', rotulo: 'Produtos cadastrados', disponivel: true },
  { chave: 'estoqueBaixo', rotulo: 'Produtos com estoque baixo', disponivel: true, alerta: true },
  { chave: 'clientesCadastrados', rotulo: 'Clientes cadastrados', disponivel: false },
  { chave: 'comprasMes', rotulo: 'Compras do mês', disponivel: false },
  { chave: 'caixaAtual', rotulo: 'Caixa atual', disponivel: false },
];

function renderizarIndicadores(valores) {
  const container = document.getElementById('indicadores');
  container.innerHTML = INDICADORES_BASE.map(ind => `
    <div class="indicador ${ind.alerta && valores[ind.chave] > 0 ? 'alerta' : ''}">
      <div class="rotulo">${ind.rotulo}</div>
      <div class="valor">${ind.disponivel ? valores[ind.chave] : '—'}</div>
      ${!ind.disponivel ? '<div style="font-size:11px;color:var(--texto-suave);margin-top:4px;">Em breve</div>' : ''}
    </div>
  `).join('');
}

async function carregarDashboard() {
  const produtos = await apiFetch('/api/produtos');

  // Busca as variações de cada produto para calcular estoque baixo.
  // Para o catálogo pequeno de uma loja, isso é rápido; se o catálogo
  // crescer muito no futuro, esse cálculo deve virar uma rota própria
  // no backend (ex: /api/estoque/baixo) para não sobrecarregar o navegador.
  const todasVariacoes = await Promise.all(
    produtos.map(p => apiFetch(`/api/produtos/${p.id_produto}/variacoes`)
      .then(vs => vs.map(v => ({ ...v, produto: p.descricao }))))
  );

  const variacoesBaixas = todasVariacoes.flat()
    .filter(v => v.ativo && v.quantidade_atual <= v.estoque_minimo);

  renderizarIndicadores({
    produtosCadastrados: produtos.length,
    estoqueBaixo: variacoesBaixas.length,
  });

  const tbody = document.getElementById('tabelaEstoqueBaixo');
  if (variacoesBaixas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum produto abaixo do estoque mínimo. 🎉</td></tr>';
  } else {
    tbody.innerHTML = variacoesBaixas.map(v => `
      <tr>
        <td>${v.produto}</td>
        <td>${v.tamanho}</td>
        <td>${v.cor}</td>
        <td><span class="badge-baixo">${v.quantidade_atual}</span></td>
        <td>${v.estoque_minimo}</td>
      </tr>
    `).join('');
  }
}

carregarDashboard().catch(erro => {
  console.error(erro);
  document.getElementById('tabelaEstoqueBaixo').innerHTML =
    '<tr><td colspan="5">Não foi possível carregar os dados.</td></tr>';
});
