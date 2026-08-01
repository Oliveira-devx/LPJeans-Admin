exigirLogin();
montarSidebar('fornecedores');
montarTopbar('Fornecedores');

let timerBusca = null;

async function carregarFornecedores(termo) {
  const query = termo ? `?busca=${encodeURIComponent(termo)}` : '';
  const fornecedores = await apiFetch(`/api/fornecedores${query}`);
  const tbody = document.getElementById('tabelaFornecedores');

  if (fornecedores.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum fornecedor encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = fornecedores.map(f => `
    <tr>
      <td>${f.razao_social}</td>
      <td>${f.representante || '—'}</td>
      <td>${f.telefone || '—'}</td>
      <td>${f.cidade ? `${f.cidade}${f.estado ? '/' + f.estado : ''}` : '—'}</td>
      <td><button class="secundario" onclick="inativarFornecedor(${f.id_fornecedor})">Inativar</button></td>
    </tr>
  `).join('');
}

async function inativarFornecedor(id) {
  if (!confirm('Tem certeza que deseja inativar este fornecedor?')) return;
  try {
    await apiFetch(`/api/fornecedores/${id}`, { method: 'DELETE' });
    await carregarFornecedores(document.getElementById('busca').value);
  } catch (erro) {
    alert(erro.message);
  }
}

document.getElementById('busca').addEventListener('input', (e) => {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(() => carregarFornecedores(e.target.value), 300);
});

document.getElementById('formFornecedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgFornecedor');

  const corpo = {
    razao_social: document.getElementById('razaoSocial').value,
    representante: document.getElementById('representante').value || null,
    telefone: document.getElementById('telefone').value || null,
    cidade: document.getElementById('cidade').value || null,
    estado: document.getElementById('estado').value || null,
  };

  try {
    await apiFetch('/api/fornecedores', { method: 'POST', body: JSON.stringify(corpo) });
    document.getElementById('formFornecedor').reset();
    msg.textContent = 'Fornecedor cadastrado com sucesso.';
    msg.className = 'msg sucesso';
    await carregarFornecedores();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

carregarFornecedores().catch(erro => {
  document.getElementById('tabelaFornecedores').innerHTML =
    `<tr><td colspan="5">Erro ao carregar fornecedores: ${erro.message}</td></tr>`;
});
