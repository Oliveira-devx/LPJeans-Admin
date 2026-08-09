exigirLogin();
montarSidebar('relatorios');
montarTopbar('Relatórios');

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function mudarPeriodo(periodo, botao) {
  document.querySelectorAll('.filtro-periodo button').forEach(b => b.classList.remove('ativo'));
  botao.classList.add('ativo');
  await carregarRelatorioVendas(periodo);
}

async function carregarRelatorioVendas(periodo) {
  try {
    const dados = await apiFetch(`/api/relatorios/vendas?periodo=${periodo}`);

    document.getElementById('indNumeroVendas').textContent = dados.numero_vendas;
    document.getElementById('indFaturamento').textContent = formatarMoeda(dados.faturamento);
    document.getElementById('indTicketMedio').textContent = formatarMoeda(dados.ticket_medio);

    const dinheiro = dados.por_forma_pagamento.find(f => f.forma === 'Dinheiro');
    const pix = dados.por_forma_pagamento.find(f => f.forma === 'Pix');
    document.getElementById('indDinheiro').textContent = formatarMoeda(dinheiro ? dinheiro.total : 0);
    document.getElementById('indPix').textContent = formatarMoeda(pix ? pix.total : 0);

    const tbodyTop = document.getElementById('tabelaTopProdutos');
    tbodyTop.innerHTML = dados.top_produtos.length === 0
      ? '<tr><td colspan="3">Nenhuma venda no período.</td></tr>'
      : dados.top_produtos.map(p => `
          <tr><td>${p.produto}</td><td>${p.quantidade_vendida}</td><td>${formatarMoeda(p.valor_vendido)}</td></tr>
        `).join('');

    const tbodyFormas = document.getElementById('tabelaFormasPagamento');
    tbodyFormas.innerHTML = dados.por_forma_pagamento.length === 0
      ? '<tr><td colspan="2">Nenhum pagamento no período.</td></tr>'
      : dados.por_forma_pagamento.map(f => `
          <tr><td>${f.forma}</td><td>${formatarMoeda(f.total)}</td></tr>
        `).join('');
  } catch (erro) {
    document.getElementById('indNumeroVendas').textContent = '—';
    alert(erro.message);
  }
}

async function carregarAuditoria() {
  const tbody = document.getElementById('tabelaAuditoria');
  try {
    const log = await apiFetch('/api/relatorios/auditoria?limite=150');
    tbody.innerHTML = log.length === 0
      ? '<tr><td colspan="5">Nenhum registro ainda.</td></tr>'
      : log.map(l => `
          <tr>
            <td>${new Date(l.data_hora).toLocaleString('pt-BR')}</td>
            <td>${l.operacao}</td>
            <td>${l.tabela}</td>
            <td>${l.funcionario || '—'}</td>
            <td>${l.detalhes || '—'}</td>
          </tr>
        `).join('');
  } catch (erro) {
    tbody.innerHTML = `<tr><td colspan="5">${erro.message}</td></tr>`;
  }
}

(async function iniciar() {
  await carregarRelatorioVendas('hoje');
  await carregarAuditoria();
})();
