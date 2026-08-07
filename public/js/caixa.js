exigirLogin();
montarSidebar('caixa');
montarTopbar('Caixa');

let idCaixaAtual = null;

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function carregarFuncionarios() {
  const funcionarios = await apiFetch('/api/funcionarios');
  const select = document.getElementById('funcionarioAbertura');
  select.innerHTML = funcionarios.filter(f => f.ativo).map(f => `<option value="${f.id_funcionario}">${f.nome}</option>`).join('');
}

async function verificarCaixaAtual() {
  const status = await apiFetch('/api/caixa/atual');

  if (!status.aberto) {
    idCaixaAtual = null;
    document.getElementById('painelAbrir').style.display = 'block';
    document.getElementById('painelAberto').style.display = 'none';
    return;
  }

  idCaixaAtual = status.id_caixa;
  document.getElementById('painelAbrir').style.display = 'none';
  document.getElementById('painelAberto').style.display = 'block';

  document.getElementById('indValorInicial').textContent = formatarMoeda(status.valor_inicial);
  document.getElementById('indValorEsperado').textContent = formatarMoeda(status.valor_esperado_atual);
  document.getElementById('indAbertoDesde').textContent = new Date(status.data_abertura).toLocaleString('pt-BR');

  await carregarMovimentacoes();
}

async function carregarMovimentacoes() {
  const detalhe = await apiFetch(`/api/caixa/${idCaixaAtual}`);
  document.getElementById('indValorEsperado').textContent = formatarMoeda(detalhe.valor_esperado_atual);

  const tbody = document.getElementById('tabelaMovimentacoes');
  if (detalhe.movimentacoes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhuma movimentação manual registrada ainda.</td></tr>';
    return;
  }
  tbody.innerHTML = detalhe.movimentacoes.map(m => `
    <tr>
      <td>${new Date(m.data_movimentacao).toLocaleString('pt-BR')}</td>
      <td>${m.tipo === 'ENTRADA' ? '<span class="badge-ok">Entrada</span>' : '<span class="badge-baixo">Saída</span>'}</td>
      <td>${m.descricao || '—'}</td>
      <td>${formatarMoeda(m.valor)}</td>
      <td>${m.funcionario}</td>
    </tr>
  `).join('');
}

async function carregarHistoricoCaixa() {
  const historico = await apiFetch('/api/caixa?status=FECHADO');
  const tbody = document.getElementById('tabelaHistoricoCaixa');

  if (historico.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum caixa fechado ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = historico.map(c => `
    <tr>
      <td>${new Date(c.data_abertura).toLocaleString('pt-BR')}</td>
      <td>${c.data_fechamento ? new Date(c.data_fechamento).toLocaleString('pt-BR') : '—'}</td>
      <td>${c.funcionario}</td>
      <td>${formatarMoeda(c.valor_esperado)}</td>
      <td>${formatarMoeda(c.valor_contado)}</td>
      <td style="color:${Math.abs(c.diferenca) < 0.01 ? 'var(--verde-sucesso)' : 'var(--vermelho)'}; font-weight:600;">
        ${formatarMoeda(c.diferenca)}
      </td>
    </tr>
  `).join('');
}

document.getElementById('formAbrirCaixa').addEventListener('submit', async (e) => {
  e.preventDefault();
  const valorInicial = Number(document.getElementById('valorInicial').value);
  const idFuncionario = Number(document.getElementById('funcionarioAbertura').value);

  try {
    await apiFetch('/api/caixa/abrir', {
      method: 'POST',
      body: JSON.stringify({ valor_inicial: valorInicial, id_funcionario: idFuncionario }),
    });
    await verificarCaixaAtual();
  } catch (erro) {
    alert(erro.message);
  }
});

document.getElementById('formMovimentacao').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgMovimentacao');

  const corpo = {
    tipo: document.getElementById('tipoMovimentacao').value,
    valor: Number(document.getElementById('valorMovimentacao').value),
    descricao: document.getElementById('descricaoMovimentacao').value || null,
  };

  try {
    await apiFetch(`/api/caixa/${idCaixaAtual}/movimentacao`, { method: 'POST', body: JSON.stringify(corpo) });
    document.getElementById('formMovimentacao').reset();
    msg.textContent = 'Movimentação registrada.';
    msg.className = 'msg sucesso';
    await carregarMovimentacoes();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

document.getElementById('formFecharCaixa').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgFechamento');
  const valorContado = Number(document.getElementById('valorContado').value);

  if (!confirm('Tem certeza que deseja fechar o caixa? Essa ação não pode ser desfeita.')) return;

  try {
    const resultado = await apiFetch(`/api/caixa/${idCaixaAtual}/fechar`, {
      method: 'POST',
      body: JSON.stringify({ valor_contado: valorContado }),
    });
    msg.textContent = `Caixa fechado. Diferença: ${formatarMoeda(resultado.diferenca)}`;
    msg.className = 'msg sucesso';
    setTimeout(async () => {
      await verificarCaixaAtual();
      await carregarHistoricoCaixa();
    }, 1200);
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

(async function iniciar() {
  await carregarFuncionarios();
  await verificarCaixaAtual();
  await carregarHistoricoCaixa();
})();
