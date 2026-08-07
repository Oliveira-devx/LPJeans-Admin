exigirLogin();
montarSidebar('estoque');
montarTopbar('Estoque');

let idVariacaoAtual = null;
let timerBusca = null;

async function carregarEstoque(termo) {
  const query = termo ? `?busca=${encodeURIComponent(termo)}` : '';
  const itens = await apiFetch(`/api/estoque${query}`);
  const tbody = document.getElementById('tabelaEstoque');

  if (itens.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum item encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = itens.map(i => `
    <tr>
      <td>${i.produto} <span style="color:var(--texto-suave); font-size:12px;">(${i.referencia})</span></td>
      <td>${i.tamanho}</td>
      <td>${i.cor}</td>
      <td>${i.quantidade_atual <= i.estoque_minimo
        ? `<span class="badge-baixo">${i.quantidade_atual}</span>`
        : `<span class="badge-ok">${i.quantidade_atual}</span>`}</td>
      <td>${i.estoque_minimo}</td>
      <td><button class="secundario" onclick="abrirHistorico(${i.id_variacao}, '${i.produto.replace(/'/g, "\\'")} — ${i.tamanho}/${i.cor}')">Histórico</button></td>
    </tr>
  `).join('');
}

document.getElementById('busca').addEventListener('input', (e) => {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(() => carregarEstoque(e.target.value), 300);
});

async function abrirHistorico(idVariacao, titulo) {
  idVariacaoAtual = idVariacao;
  document.getElementById('tituloHistorico').textContent = `Histórico — ${titulo}`;
  document.getElementById('cardHistorico').style.display = 'block';
  document.getElementById('cardHistorico').scrollIntoView({ behavior: 'smooth' });

  const tbody = document.getElementById('tabelaHistorico');
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

  try {
    const movimentacoes = await apiFetch(`/api/estoque/${idVariacao}/movimentacoes`);
    if (movimentacoes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhuma movimentação registrada ainda.</td></tr>';
      return;
    }
    tbody.innerHTML = movimentacoes.map(m => `
      <tr>
        <td>${new Date(m.data_movimentacao).toLocaleString('pt-BR')}</td>
        <td>${m.tipo}</td>
        <td>${m.origem || '—'}</td>
        <td>${m.quantidade}</td>
        <td>${m.funcionario}</td>
        <td>${m.observacoes || '—'}</td>
      </tr>
    `).join('');
  } catch (erro) {
    tbody.innerHTML = `<tr><td colspan="6">${erro.message}</td></tr>`;
  }
}

function fecharHistorico() {
  document.getElementById('cardHistorico').style.display = 'none';
  idVariacaoAtual = null;
}

document.getElementById('formAjuste').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgAjuste');
  const delta = Number(document.getElementById('deltaAjuste').value);
  const observacoes = document.getElementById('motivoAjuste').value;

  try {
    await apiFetch(`/api/estoque/${idVariacaoAtual}/ajuste`, {
      method: 'POST',
      body: JSON.stringify({ delta, observacoes }),
    });
    document.getElementById('formAjuste').reset();
    msg.textContent = 'Ajuste registrado com sucesso.';
    msg.className = 'msg sucesso';
    await abrirHistorico(idVariacaoAtual, document.getElementById('tituloHistorico').textContent.replace('Histórico — ', ''));
    await carregarEstoque(document.getElementById('busca').value);
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

carregarEstoque();
