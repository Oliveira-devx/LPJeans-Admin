exigirLogin();
montarSidebar('clientes');
montarTopbar('Clientes');

let timerBusca = null;

async function carregarClientes(termo) {
  const query = termo ? `?busca=${encodeURIComponent(termo)}` : '';
  const clientes = await apiFetch(`/api/clientes${query}`);
  const tbody = document.getElementById('tabelaClientes');

  if (clientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum cliente encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = clientes.map(c => `
    <tr>
      <td>${c.nome}</td>
      <td>${c.cpf || '—'}</td>
      <td>${c.telefone || '—'}</td>
      <td>${c.cidade || '—'}</td>
      <td><button class="secundario" onclick="inativarCliente(${c.id_cliente})">Inativar</button></td>
    </tr>
  `).join('');
}

async function inativarCliente(id) {
  if (!confirm('Tem certeza que deseja inativar este cliente?')) return;
  try {
    await apiFetch(`/api/clientes/${id}`, { method: 'DELETE' });
    await carregarClientes(document.getElementById('busca').value);
  } catch (erro) {
    alert(erro.message);
  }
}

document.getElementById('busca').addEventListener('input', (e) => {
  clearTimeout(timerBusca);
  // Espera 300ms depois de parar de digitar antes de buscar,
  // pra não disparar uma requisição a cada letra.
  timerBusca = setTimeout(() => carregarClientes(e.target.value), 300);
});

document.getElementById('formCliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgCliente');

  const corpo = {
    nome: document.getElementById('nome').value,
    cpf: document.getElementById('cpf').value.replace(/\D/g, '') || null,
    telefone: document.getElementById('telefone').value || null,
    email: document.getElementById('email').value || null,
    instagram: document.getElementById('instagram').value || null,
    data_nascimento: document.getElementById('dataNascimento').value || null,
    cidade: document.getElementById('cidade').value || null,
  };

  try {
    await apiFetch('/api/clientes', { method: 'POST', body: JSON.stringify(corpo) });
    document.getElementById('formCliente').reset();
    msg.textContent = 'Cliente cadastrado com sucesso.';
    msg.className = 'msg sucesso';
    await carregarClientes();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

carregarClientes().catch(erro => {
  document.getElementById('tabelaClientes').innerHTML =
    `<tr><td colspan="5">Erro ao carregar clientes: ${erro.message}</td></tr>`;
});
