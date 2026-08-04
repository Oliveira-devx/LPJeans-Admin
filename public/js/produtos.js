exigirLogin();
montarSidebar('produtos');
montarTopbar('Produtos');

async function carregarTipos() {
  const tipos = await apiFetch('/api/tipos-produto');
  const select = document.getElementById('idTipo');
  select.innerHTML = '<option value="">—</option>' +
    tipos.map(t => `<option value="${t.id_tipo}">${t.nome}</option>`).join('');
  return tipos;
}

async function carregarProdutos() {
  const produtos = await apiFetch('/api/produtos');
  const tbody = document.getElementById('tabelaProdutos');
  tbody.innerHTML = '';

  for (const p of produtos) {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${p.referencia}</td>
      <td>${p.descricao}</td>
      <td>${p.tipo || '—'}</td>
      <td>${p.genero || '—'}</td>
      <td>${Number(p.preco_venda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td><button class="secundario" onclick="alternarVariacoes(${p.id_produto}, this)">Ver variações</button></td>
    `;
    tbody.appendChild(linha);

    const linhaDetalhe = document.createElement('tr');
    linhaDetalhe.id = `detalhe-${p.id_produto}`;
    linhaDetalhe.className = 'variacoes-linha';
    linhaDetalhe.style.display = 'none';
    linhaDetalhe.innerHTML = `<td colspan="5"></td>`;
    tbody.appendChild(linhaDetalhe);
  }
}

async function alternarVariacoes(idProduto, botao) {
  const linha = document.getElementById(`detalhe-${idProduto}`);
  const aberta = linha.style.display !== 'none';

  if (aberta) {
    linha.style.display = 'none';
    botao.textContent = 'Ver variações';
    return;
  }

  linha.style.display = 'table-row';
  botao.textContent = 'Ocultar variações';
  await renderizarVariacoes(idProduto);
}

async function renderizarVariacoes(idProduto) {
  const celula = document.querySelector(`#detalhe-${idProduto} td`);
  celula.innerHTML = 'Carregando...';

  const variacoes = await apiFetch(`/api/produtos/${idProduto}/variacoes`);

  const linhasTabela = variacoes.map(v => `
    <tr>
      <td>${v.tamanho}</td>
      <td>${v.cor}</td>
      <td>${v.codigo_barras || '—'}</td>
      <td>${v.quantidade_atual <= v.estoque_minimo
            ? `<span class="badge-baixo">${v.quantidade_atual}</span>`
            : `<span class="badge-ok">${v.quantidade_atual}</span>`}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">Nenhuma variação cadastrada ainda.</td></tr>';

  celula.innerHTML = `
    <strong>Variações deste produto</strong>
    <table>
      <thead><tr><th>Tamanho</th><th>Cor</th><th>Código de barras</th><th>Estoque</th></tr></thead>
      <tbody>${linhasTabela}</tbody>
    </table>

    <form id="formVariacao-${idProduto}" style="margin-top:12px;">
      <div class="campo"><label>Tamanho</label><input type="text" name="tamanho" required></div>
      <div class="campo"><label>Cor</label><input type="text" name="cor" required></div>
      <div class="campo"><label>Código de barras</label><input type="text" name="codigo_barras"></div>
      <div class="campo"><label>Estoque mínimo</label><input type="number" name="estoque_minimo" value="0" min="0"></div>
      <button type="submit" class="primario">Adicionar variação</button>
    </form>
    <div id="msgVariacao-${idProduto}" class="msg"></div>
  `;

  document.getElementById(`formVariacao-${idProduto}`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = document.getElementById(`msgVariacao-${idProduto}`);

    try {
      await apiFetch(`/api/produtos/${idProduto}/variacoes`, {
        method: 'POST',
        body: JSON.stringify({
          tamanho: form.tamanho.value,
          cor: form.cor.value,
          codigo_barras: form.codigo_barras.value || null,
          estoque_minimo: Number(form.estoque_minimo.value) || 0,
        }),
      });
      form.reset();
      await renderizarVariacoes(idProduto);
    } catch (erro) {
      msg.textContent = erro.message;
      msg.className = 'msg erro';
    }
  });
}

document.getElementById('formTipo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nomeTipo').value;
  const msg = document.getElementById('msgTipo');

  try {
    await apiFetch('/api/tipos-produto', { method: 'POST', body: JSON.stringify({ nome }) });
    document.getElementById('formTipo').reset();
    msg.textContent = 'Tipo adicionado.';
    msg.className = 'msg sucesso';
    await carregarTipos();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

document.getElementById('formProduto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgProduto');

  const corpo = {
    referencia: document.getElementById('referencia').value,
    descricao: document.getElementById('descricao').value,
    id_tipo: document.getElementById('idTipo').value || null,
    genero: document.getElementById('genero').value || null,
    tecido: document.getElementById('tecido').value || null,
    colecao: document.getElementById('colecao').value || null,
    preco_venda: Number(document.getElementById('precoVenda').value),
  };

  try {
    await apiFetch('/api/produtos', { method: 'POST', body: JSON.stringify(corpo) });
    document.getElementById('formProduto').reset();
    msg.textContent = 'Produto cadastrado com sucesso.';
    msg.className = 'msg sucesso';
    await carregarProdutos();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

(async function iniciar() {
  await carregarTipos();
  await carregarProdutos();
})();
