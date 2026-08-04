exigirLogin();
montarSidebar('configuracoes');
montarTopbar('Configurações');

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
