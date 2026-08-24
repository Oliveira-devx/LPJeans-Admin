exigirLogin();
montarSidebar('clientes');
montarTopbar('Clientes');

let timerBusca = null;

async function carregarClientes(termo) {
  const query = termo ? `?busca=${encodeURIComponent(termo)}` : '';
  const clientes = await apiFetch(`/api/clientes${query}`);
  const container = document.getElementById('tabelaClientes');

  if (clientes.length === 0) {
    container.innerHTML = '<div class="cliente-vazio">Nenhum cliente encontrado.</div>';
    return;
  }

  container.innerHTML = clientes.map(c => `
    <div class="cartao-cliente">
      <div class="cartao-cliente-nome">${c.nome}</div>
      <div class="cartao-cliente-linha">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/></svg>
        CPF: ${c.cpf || '—'}
      </div>
      <div class="cartao-cliente-linha">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        ${c.telefone || '—'}
      </div>
      <div class="cartao-cliente-linha">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${c.cidade || '—'}
      </div>
      <div class="cartao-cliente-rodape">
        <button class="secundario" onclick="inativarCliente(${c.id_cliente})">Inativar</button>
      </div>
    </div>
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
    `<div class="cliente-vazio">Erro ao carregar clientes: ${erro.message}</div>`;
});