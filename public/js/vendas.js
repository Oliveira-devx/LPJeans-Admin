exigirLogin();
montarSidebar('vendas');
montarTopbar('Vendas');

let idVendaAtual = sessionStorage.getItem('vendaAtual') || null;
let carrinhoAtual = [];
let formasPagamentoCache = [];
let podeDarDesconto = false;

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function verificarPermissaoDesconto() {
  const usuario = pegarUsuarioAtual();
  if (usuario && ['Administrador', 'Proprietaria'].includes(usuario.cargo)) {
    podeDarDesconto = true;
    return;
  }
  try {
    const minhas = await apiFetch('/api/permissoes/minhas');
    podeDarDesconto = minhas.modulos.includes('vendas_desconto');
  } catch {
    podeDarDesconto = false;
  }
}

// ===== Tela inicial: nova venda / retomar venda em aberto =====

async function carregarClientesSelect() {
  const clientes = await apiFetch('/api/clientes');
  const select = document.getElementById('clienteVenda');
  select.innerHTML = '<option value="">Sem cliente identificado</option>' +
    clientes.map(c => `<option value="${c.id_cliente}">${c.nome}</option>`).join('');
}

async function carregarFuncionariosSelect() {
  const funcionarios = await apiFetch('/api/funcionarios');
  const select = document.getElementById('funcionarioVenda');
  select.innerHTML = funcionarios.filter(f => f.ativo)
    .map(f => `<option value="${f.id_funcionario}">${f.nome}</option>`).join('');
}

async function carregarVendasAbertas() {
  const vendas = await apiFetch('/api/vendas?status=ABERTA');
  const tbody = document.getElementById('tabelaVendasAbertas');

  if (vendas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhuma venda em aberto.</td></tr>';
    return;
  }

  tbody.innerHTML = vendas.map(v => `
    <tr>
      <td>${v.cliente || 'Sem cliente'}</td>
      <td>${v.funcionario}</td>
      <td>${new Date(v.data_venda).toLocaleString('pt-BR')}</td>
      <td><button class="secundario" onclick="retomarVenda(${v.id_venda})">Retomar</button></td>
    </tr>
  `).join('');
}

document.getElementById('formNovaVenda').addEventListener('submit', async (e) => {
  e.preventDefault();
  const idCliente = document.getElementById('clienteVenda').value;
  const idFuncionario = document.getElementById('funcionarioVenda').value;

  if (!idFuncionario) {
    alert('Selecione quem está realizando a venda.');
    return;
  }

  try {
    const resultado = await apiFetch('/api/vendas', {
      method: 'POST',
      body: JSON.stringify({ id_cliente: idCliente || null, id_funcionario: Number(idFuncionario) }),
    });
    abrirVenda(resultado.id_venda);
  } catch (erro) {
    alert(erro.message);
  }
});

function retomarVenda(id) {
  abrirVenda(id);
}

function abrirVenda(id) {
  idVendaAtual = id;
  sessionStorage.setItem('vendaAtual', id);
  document.getElementById('painelInicio').style.display = 'none';
  document.getElementById('painelVenda').style.display = 'block';
  document.getElementById('cardPagamento').style.display = 'none';
  carregarCarrinho();
}

function voltarParaInicio() {
  idVendaAtual = null;
  sessionStorage.removeItem('vendaAtual');
  document.getElementById('painelVenda').style.display = 'none';
  document.getElementById('painelInicio').style.display = 'block';
  carregarVendasAbertas();
}

async function cancelarVendaAtual() {
  if (!confirm('Cancelar esta venda? Os itens serão perdidos (o estoque não foi alterado ainda).')) return;
  try {
    await apiFetch(`/api/vendas/${idVendaAtual}/cancelar`, { method: 'PUT' });
  } catch (erro) {
    alert(erro.message + '\n\nVoltando para o início mesmo assim.');
  }
  voltarParaInicio();
}

// ===== Busca de produtos =====

let timerBusca = null;
document.getElementById('buscaProduto').addEventListener('input', (e) => {
  clearTimeout(timerBusca);
  const termo = e.target.value;
  if (termo.trim().length < 2) {
    document.getElementById('resultadoBusca').style.display = 'none';
    return;
  }
  timerBusca = setTimeout(() => buscarProdutos(termo), 250);
});

async function buscarProdutos(termo) {
  const resultados = await apiFetch(`/api/produtos/busca-venda?q=${encodeURIComponent(termo)}`);
  const container = document.getElementById('resultadoBusca');

  if (resultados.length === 0) {
    container.innerHTML = '<div style="padding:12px; font-size:13px; color:var(--texto-suave);">Nenhum produto encontrado.</div>';
    container.style.display = 'block';
    return;
  }

  container.innerHTML = resultados.map(p => `
    <div class="linha-produto">${p.referencia} — ${p.descricao} · ${formatarMoeda(p.preco_venda)}</div>
    ${p.variacoes.length === 0
      ? '<div style="padding:6px 14px; font-size:12.5px; color:var(--texto-suave);">Sem variações cadastradas.</div>'
      : p.variacoes.map(v => `
        <div class="linha-variacao ${v.quantidade_atual <= 0 ? 'sem-estoque' : ''}"
             onclick="${v.quantidade_atual > 0 ? `adicionarAoCarrinho(${v.id_variacao}, ${p.preco_venda})` : ''}">
          <span>${v.tamanho} — ${v.cor}</span>
          <span>${v.quantidade_atual > 0 ? `estoque: ${v.quantidade_atual}` : 'sem estoque'}</span>
        </div>
      `).join('')}
  `).join('');
  container.style.display = 'block';
}

async function adicionarAoCarrinho(idVariacao, precoTabela) {
  try {
    await apiFetch(`/api/vendas/${idVendaAtual}/itens`, {
      method: 'POST',
      body: JSON.stringify({ id_variacao: idVariacao, quantidade: 1, preco_vendido: precoTabela, valor_desconto: 0 }),
    });
    document.getElementById('buscaProduto').value = '';
    document.getElementById('resultadoBusca').style.display = 'none';
    await carregarCarrinho();
  } catch (erro) {
    alert(erro.message);
  }
}

// ===== Carrinho =====

async function carregarCarrinho() {
  const venda = await apiFetch(`/api/vendas/${idVendaAtual}`);
  carrinhoAtual = venda.itens;
  renderizarCarrinho();
}

function renderizarCarrinho() {
  const container = document.getElementById('tabelaCarrinho');

  if (carrinhoAtual.length === 0) {
    container.innerHTML = '<p class="carrinho-vazio">Carrinho vazio — busque um produto acima.</p>';
    atualizarResumo();
    return;
  }

  container.innerHTML = carrinhoAtual.map(item => `
    <div class="item-carrinho">
      <div class="item-carrinho-info">
        <span class="item-carrinho-produto">${item.produto}</span>
        <span class="item-carrinho-variacao">${item.tamanho} · ${item.cor}</span>
      </div>

      <div class="item-carrinho-controles">
        <div class="carrinho-qtd">
          <button onclick="alterarQuantidade(${item.id_item_venda}, -1)" aria-label="Diminuir quantidade">−</button>
          <input type="text" value="${item.quantidade}" readonly>
          <button onclick="alterarQuantidade(${item.id_item_venda}, 1)" aria-label="Aumentar quantidade">+</button>
        </div>

        <div class="item-carrinho-preco">
          <label>Preço unit.</label>
          <input type="number" min="0" step="0.01" value="${item.preco_vendido}"
                 onchange="alterarPreco(${item.id_item_venda}, this.value)">
        </div>
      </div>

      <div class="item-carrinho-rodape">
        <span class="item-carrinho-subtotal">${formatarMoeda(item.subtotal)}</span>
        <button class="botao-remover-item" onclick="removerItem(${item.id_item_venda})" aria-label="Remover item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  atualizarResumo();
}

async function alterarQuantidade(idItem, delta) {
  const item = carrinhoAtual.find(i => Number(i.id_item_venda) === Number(idItem));
  if (!item) return;
  const novaQuantidade = Number(item.quantidade) + delta;
  if (novaQuantidade <= 0) {
    return removerItem(idItem);
  }
  try {
    await apiFetch(`/api/vendas/${idVendaAtual}/itens/${idItem}`, {
      method: 'PUT',
      body: JSON.stringify({ quantidade: novaQuantidade, preco_vendido: item.preco_vendido, valor_desconto: item.valor_desconto }),
    });
    await carregarCarrinho();
  } catch (erro) {
    alert(erro.message);
  }
}

async function alterarPreco(idItem, novoPreco) {
  const item = carrinhoAtual.find(i => Number(i.id_item_venda) === Number(idItem));
  if (!item) return;
  try {
    await apiFetch(`/api/vendas/${idVendaAtual}/itens/${idItem}`, {
      method: 'PUT',
      body: JSON.stringify({ quantidade: item.quantidade, preco_vendido: Number(novoPreco), valor_desconto: item.valor_desconto }),
    });
    await carregarCarrinho();
  } catch (erro) {
    alert(erro.message);
    await carregarCarrinho();
  }
}

async function removerItem(idItem) {
  try {
    await apiFetch(`/api/vendas/${idVendaAtual}/itens/${idItem}`, { method: 'DELETE' });
    await carregarCarrinho();
  } catch (erro) {
    alert(erro.message);
  }
}

function atualizarResumo() {
  const subtotal = carrinhoAtual.reduce((soma, item) => soma + Number(item.subtotal), 0);
  const descontoGeral = Number(document.getElementById('descontoGeral').value) || 0;
  const final = Math.max(subtotal - descontoGeral, 0);

  document.getElementById('resumoSubtotal').textContent = formatarMoeda(subtotal);
  document.getElementById('resumoFinal').textContent = formatarMoeda(final);
}

document.getElementById('descontoGeral').addEventListener('input', () => {
  if (!podeDarDesconto && Number(document.getElementById('descontoGeral').value) > 0) {
    alert('Você não tem permissão para aplicar desconto geral.');
    document.getElementById('descontoGeral').value = 0;
  }
  atualizarResumo();
});

// ===== Pagamento / finalização =====

async function carregarFormasPagamento() {
  formasPagamentoCache = await apiFetch('/api/formas-pagamento');
}

document.getElementById('btnAbrirPagamento').addEventListener('click', () => {
  if (carrinhoAtual.length === 0) {
    alert('Adicione ao menos um item antes de finalizar.');
    return;
  }
  document.getElementById('cardPagamento').style.display = 'block';
  document.getElementById('linhasPagamento').innerHTML = '';
  adicionarLinhaPagamento();
  document.getElementById('cardPagamento').scrollIntoView({ behavior: 'smooth' });
});

function valorFinalAtual() {
  const subtotal = carrinhoAtual.reduce((soma, item) => soma + Number(item.subtotal), 0);
  const descontoGeral = Number(document.getElementById('descontoGeral').value) || 0;
  return Math.max(subtotal - descontoGeral, 0);
}

function adicionarLinhaPagamento() {
  const container = document.getElementById('linhasPagamento');
  const linhaId = `pag-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const restante = calcularRestante();

  const div = document.createElement('div');
  div.className = 'linha-pagamento';
  div.id = linhaId;
  div.innerHTML = `
    <div class="campo"><label>Forma</label>
      <select class="select-forma">
        ${formasPagamentoCache.map(f => `<option value="${f.id_forma_pagamento}">${f.forma}</option>`).join('')}
      </select>
    </div>
    <div class="campo" style="max-width:120px;"><label>Valor</label>
      <input type="number" class="input-valor" min="0" step="0.01" value="${restante > 0 ? restante.toFixed(2) : '0.00'}">
    </div>
    <div class="campo" style="max-width:90px;"><label>Parcelas</label>
      <input type="number" class="input-parcelas" min="1" value="1">
    </div>
    <button class="secundario" onclick="document.getElementById('${linhaId}').remove(); recalcularRestante();">Remover</button>
  `;
  container.appendChild(div);

  div.querySelector('.input-valor').addEventListener('input', recalcularRestante);
  recalcularRestante();
}

function calcularRestante() {
  const linhas = document.querySelectorAll('#linhasPagamento .input-valor');
  const somaPago = Array.from(linhas).reduce((soma, input) => soma + (Number(input.value) || 0), 0);
  return Number((valorFinalAtual() - somaPago).toFixed(2));
}

function recalcularRestante() {
  const restante = calcularRestante();
  const elemento = document.getElementById('restantePagar');
  elemento.textContent = formatarMoeda(restante);
  elemento.style.color = Math.abs(restante) < 0.01 ? 'var(--verde-sucesso)' : 'var(--vermelho)';
}

document.getElementById('btnConfirmarPagamento').addEventListener('click', async () => {
  const msg = document.getElementById('msgFinalizacao');
  msg.className = 'msg';

  const pagamentos = Array.from(document.querySelectorAll('#linhasPagamento > div')).map(div => ({
    id_forma_pagamento: Number(div.querySelector('.select-forma').value),
    valor: Number(div.querySelector('.input-valor').value),
    parcelas: Number(div.querySelector('.input-parcelas').value) || 1,
  }));

  if (pagamentos.length === 0 || pagamentos.some(p => !p.valor || p.valor <= 0)) {
    msg.textContent = 'Informe ao menos uma forma de pagamento com valor válido.';
    msg.className = 'msg erro';
    return;
  }

  const descontoGeral = Number(document.getElementById('descontoGeral').value) || 0;

  try {
    const resultado = await apiFetch(`/api/vendas/${idVendaAtual}/finalizar`, {
      method: 'POST',
      body: JSON.stringify({ desconto_total: descontoGeral, pagamentos }),
    });
    msg.textContent = `Venda finalizada com sucesso! Total: ${formatarMoeda(resultado.valor_final)}`;
    msg.className = 'msg sucesso';
    setTimeout(() => {
      voltarParaInicio();
    }, 1200);
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

// ===== Inicialização =====

(async function iniciar() {
  await verificarPermissaoDesconto();
  await Promise.all([carregarClientesSelect(), carregarFuncionariosSelect(), carregarFormasPagamento()]);

  if (idVendaAtual) {
    document.getElementById('painelInicio').style.display = 'none';
    document.getElementById('painelVenda').style.display = 'block';
    try {
      await carregarCarrinho();
    } catch {
      voltarParaInicio();
    }
  } else {
    await carregarVendasAbertas();
  }
})();