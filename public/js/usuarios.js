exigirLogin();
montarSidebar('usuarios');
montarTopbar('Usuários');

async function carregarFuncionarios() {
  const funcionarios = await apiFetch('/api/funcionarios');
  const tbody = document.getElementById('tabelaFuncionarios');

  const ativos = funcionarios.filter(f => f.ativo);
  if (ativos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum funcionário cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = ativos.map(f => `
    <tr>
      <td>${f.nome}</td>
      <td>${f.cargo}</td>
      <td>${f.telefone || '—'}</td>
      <td>${f.email || '—'}</td>
      <td><button class="secundario" onclick="inativarFuncionario(${f.id_funcionario})">Inativar</button></td>
    </tr>
  `).join('');
}

async function inativarFuncionario(id) {
  if (!confirm('Tem certeza que deseja inativar este funcionário? Ele deixará de aparecer nos seletores de "responsável".')) return;
  try {
    await apiFetch(`/api/funcionarios/${id}`, { method: 'DELETE' });
    await carregarFuncionarios();
  } catch (erro) {
    alert(erro.message);
  }
}

document.getElementById('formFuncionario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgFuncionario');

  const corpo = {
    nome: document.getElementById('nome').value,
    cargo: document.getElementById('cargo').value,
    telefone: document.getElementById('telefone').value || null,
    email: document.getElementById('email').value || null,
  };

  try {
    await apiFetch('/api/funcionarios', { method: 'POST', body: JSON.stringify(corpo) });
    document.getElementById('formFuncionario').reset();
    msg.textContent = 'Funcionário cadastrado com sucesso.';
    msg.className = 'msg sucesso';
    await carregarFuncionarios();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

async function carregarSelectFuncionarios() {
  const funcionarios = await apiFetch('/api/funcionarios');
  const select = document.getElementById('funcionarioLogin');
  select.innerHTML = funcionarios.filter(f => f.ativo)
    .map(f => `<option value="${f.id_funcionario}">${f.nome} (${f.cargo})</option>`).join('');
}

async function carregarUsuarios() {
  try {
    const usuarios = await apiFetch('/api/usuarios');
    const tbody = document.getElementById('tabelaUsuarios');

    if (usuarios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum login cadastrado ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td>${u.funcionario}</td>
        <td>${u.cargo}</td>
        <td>${u.login}</td>
        <td>${u.bloqueado
          ? '<span class="badge-baixo">Bloqueado</span>'
          : (u.ativo ? '<span class="badge-ok">Ativo</span>' : '<span class="badge-neutro">Inativo</span>')}</td>
        <td>${u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('pt-BR') : 'Nunca'}</td>
        <td>
          ${u.bloqueado
            ? `<button class="secundario" onclick="alterarUsuario(${u.id_usuario}, {bloqueado:false})">Desbloquear</button>`
            : `<button class="secundario" onclick="alterarUsuario(${u.id_usuario}, {bloqueado:true})">Bloquear</button>`}
        </td>
      </tr>
    `).join('');
  } catch (erro) {
    document.getElementById('tabelaUsuarios').innerHTML =
      `<tr><td colspan="6">${erro.message}</td></tr>`;
  }
}

async function alterarUsuario(id, mudancas) {
  try {
    await apiFetch(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(mudancas) });
    await carregarUsuarios();
  } catch (erro) {
    alert(erro.message);
  }
}

document.getElementById('formNovoUsuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgNovoUsuario');

  const corpo = {
    id_funcionario: Number(document.getElementById('funcionarioLogin').value),
    login: document.getElementById('loginNovo').value,
    senha: document.getElementById('senhaNovo').value,
  };

  try {
    await apiFetch('/api/usuarios', { method: 'POST', body: JSON.stringify(corpo) });
    document.getElementById('formNovoUsuario').reset();
    msg.textContent = 'Login criado com sucesso.';
    msg.className = 'msg sucesso';
    await carregarUsuarios();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

async function carregarStatusAcesso() {
  const status = await apiFetch('/api/auth/status');
  const container = document.getElementById('statusAcesso');

  const ultimoLogin = status.ultimo_login
    ? new Date(status.ultimo_login).toLocaleString('pt-BR')
    : 'Nunca';

  container.innerHTML = `
    <div><strong>Login:</strong> ${status.login}</div>
    <div><strong>Status:</strong> ${status.bloqueado
      ? '<span class="badge-baixo">Bloqueado</span>'
      : '<span class="badge-ok">Ativo</span>'}</div>
    <div><strong>Tentativas erradas recentes:</strong> ${status.tentativas_login}</div>
    <div><strong>Último login:</strong> ${ultimoLogin}</div>
    ${status.tentativas_login > 0
      ? '<button class="secundario" onclick="resetarTentativas()">Zerar tentativas</button>'
      : ''}
  `;
}

async function resetarTentativas() {
  try {
    await apiFetch('/api/auth/resetar-tentativas', { method: 'POST' });
    await carregarStatusAcesso();
  } catch (erro) {
    alert(erro.message);
  }
}

document.getElementById('formSenha').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgSenha');

  const senhaAtual = document.getElementById('senhaAtual').value;
  const senhaNova = document.getElementById('senhaNova').value;

  try {
    await apiFetch('/api/auth/senha', {
      method: 'PUT',
      body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova }),
    });
    document.getElementById('formSenha').reset();
    msg.textContent = 'Senha alterada com sucesso. Use a nova senha no próximo login.';
    msg.className = 'msg sucesso';
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

carregarFuncionarios();
carregarSelectFuncionarios();
carregarUsuarios();
carregarStatusAcesso();
