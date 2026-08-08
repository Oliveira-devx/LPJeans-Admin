exigirLogin();
montarSidebar('configuracoes');
montarTopbar('Configurações');

async function carregarFormasPagamento() {
  const tbody = document.getElementById('tabelaFormasPagamento');
  try {
    const formas = await apiFetch('/api/formas-pagamento?todas=true');
    tbody.innerHTML = formas.map(f => `
      <tr>
        <td>${f.forma}</td>
        <td>${f.ativo ? '<span class="badge-ok">Ativa</span>' : '<span class="badge-neutro">Inativa</span>'}</td>
        <td>
          ${f.ativo
            ? `<button class="secundario" onclick="alternarForma(${f.id_forma_pagamento}, false)">Desativar</button>`
            : `<button class="secundario" onclick="alternarForma(${f.id_forma_pagamento}, true)">Ativar</button>`}
        </td>
      </tr>
    `).join('');
  } catch (erro) {
    tbody.innerHTML = `<tr><td colspan="3">${erro.message}</td></tr>`;
  }
}

async function alternarForma(id, ativo) {
  try {
    await apiFetch(`/api/formas-pagamento/${id}`, { method: 'PUT', body: JSON.stringify({ ativo }) });
    await carregarFormasPagamento();
  } catch (erro) {
    alert(erro.message);
  }
}

document.getElementById('formNovaForma').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgForma');
  try {
    await apiFetch('/api/formas-pagamento', {
      method: 'POST',
      body: JSON.stringify({ forma: document.getElementById('nomeForma').value }),
    });
    document.getElementById('formNovaForma').reset();
    msg.textContent = 'Forma de pagamento adicionada.';
    msg.className = 'msg sucesso';
    await carregarFormasPagamento();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

async function carregarTiposProduto() {
  const tbody = document.getElementById('tabelaTiposProduto');
  try {
    const tipos = await apiFetch('/api/tipos-produto');
    tbody.innerHTML = tipos.length === 0
      ? '<tr><td>Nenhum tipo cadastrado ainda (cadastre pela tela de Produtos).</td></tr>'
      : tipos.map(t => `<tr><td>${t.nome}</td></tr>`).join('');
  } catch (erro) {
    tbody.innerHTML = `<tr><td>${erro.message}</td></tr>`;
  }
}

carregarFormasPagamento();
carregarTiposProduto();

async function carregarMatriz() {
  const container = document.getElementById('matrizPermissoes');
  try {
    const matriz = await apiFetch('/api/permissoes');

    if (matriz.length === 0) {
      container.innerHTML = '<p>Nenhum cargo configurável encontrado.</p>';
      return;
    }

    container.innerHTML = matriz.map(bloco => `
      <div style="margin-bottom: 22px;">
        <h3 style="font-size:14px; color:var(--pinho-escuro); margin-bottom:10px;">${bloco.cargo === 'Vendedora' ? 'Vendedora' : bloco.cargo}</h3>
        <div class="wrapper-tabela">
          <table>
            <thead><tr><th>Módulo</th><th style="width:100px;">Permitido</th></tr></thead>
            <tbody>
              ${bloco.modulos.map(m => `
                <tr>
                  <td>${m.rotulo}</td>
                  <td>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                      <input type="checkbox"
                        data-cargo="${bloco.cargo}"
                        data-modulo="${m.modulo}"
                        ${m.permitido ? 'checked' : ''}
                        onchange="alterarPermissao(this)"
                        style="width:16px; height:16px; cursor:pointer;">
                    </label>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
  } catch (erro) {
    container.innerHTML = `<p style="color:var(--vermelho);">${erro.message}</p>`;
  }
}

async function alterarPermissao(checkbox) {
  const cargo = checkbox.dataset.cargo;
  const modulo = checkbox.dataset.modulo;
  const permitido = checkbox.checked;

  checkbox.disabled = true;
  try {
    await apiFetch('/api/permissoes', {
      method: 'PUT',
      body: JSON.stringify({ cargo, modulo, permitido }),
    });
  } catch (erro) {
    alert('Não foi possível salvar: ' + erro.message);
    checkbox.checked = !permitido; // desfaz visualmente se der erro
  } finally {
    checkbox.disabled = false;
  }
}

carregarMatriz();
