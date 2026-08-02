exigirLogin();
montarSidebar('compras');
montarTopbar('Compras');

let itensCompra = [];
let produtosCache = [];

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function carregarFornecedores() {
  const fornecedores = await apiFetch('/api/fornecedores');
  const select = document.getElementById('fornecedor');
  if (fornecedores.length === 0) {
    select.innerHTML = '<option value="">Nenhum fornecedor cadastrado</option>';
    return;
  }
  select.innerHTML = fornecedores.map(f => `<option value="${f.id_fornecedor}">${f.razao_social}</option>`).join('');
}

async function carregarFuncionarios() {
  const funcionarios = await apiFetch('/api/funcionarios');
  const select = document.getElementById('funcionario');
  select.innerHTML = funcionarios.filter(f => f.ativo).map(f => `<option value="${f.id_funcionario}">${f.nome}</option>`).join('');
}

async function carregarProdutosSelect() {
  produtosCache = await apiFetch('/api/produtos');
  const select = document.getElementById('produtoItem');
  select.innerHTML = '<option value="">Selecione...</option>' +
    produtosCache.map(p => `<option value="${p.id_produto}">${p.referencia} — ${p.descricao}</option>`).join('');
}

document.getElementById('produtoItem').addEventListener('change', async (e) => {
  const idProduto = e.target.value;
  const selectVariacao = document.getElementById('variacaoItem');

  if (!idProduto) {
    selectVariacao.innerHTML = '<option value="">Selecione um produto primeiro</option>';
    return;
  }

  selectVariacao.innerHTML = '<option value="">Carregando...</option>';
  const variacoes = await apiFetch(`/api/produtos/${idProduto}/variacoes`);
  const ativas = variacoes.filter(v => v.ativo);

  if (ativas.length === 0) {
    selectVariacao.innerHTML = '<option value="">Este produto não tem variações cadastradas</option>';
    return;
  }

  selectVariacao.innerHTML = ativas.map(v =>
    `<option value="${v.id_variacao}" data-tamanho="${v.tamanho}" data-cor="${v.cor}">${v.tamanho} — ${v.cor} (estoque atual: ${v.quantidade_atual})</option>`
  ).join('');
});

function renderizarItens() {
  const tbody = document.getElementById('tabelaItensCompra');

  if (itensCompra.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Nenhum item adicionado ainda.</td></tr>';
  } else {
    tbody.innerHTML = itensCompra.map((item, indice) => `
      <tr>
        <td>${item.produto}</td>
        <td>${item.tamanho}</td>
        <td>${item.cor}</td>
        <td>${item.quantidade}</td>
        <td>${formatarMoeda(item.preco_custo)}</td>
        <td>${formatarMoeda(item.quantidade * item.preco_custo)}</td>
        <td><button class="secundario" onclick="removerItem(${indice})">Remover</button></td>
      </tr>
    `).join('');
  }

  const total = itensCompra.reduce((soma, item) => soma + item.quantidade * item.preco_custo, 0);
  document.getElementById('valorTotalCompra').textContent = formatarMoeda(total);
}

function removerItem(indice) {
  itensCompra.splice(indice, 1);
  renderizarItens();
}

document.getElementById('formItem').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = document.getElementById('msgItem');
  msg.className = 'msg';

  const selectProduto = document.getElementById('produtoItem');
  const selectVariacao = document.getElementById('variacaoItem');
  const quantidade = Number(document.getElementById('quantidadeItem').value);
  const precoCusto = Number(document.getElementById('precoCustoItem').value);

  if (!selectVariacao.value) {
    msg.textContent = 'Selecione uma variação (tamanho/cor).';
    msg.className = 'msg erro';
    return;
  }
  if (!quantidade || quantidade <= 0) {
    msg.textContent = 'Informe uma quantidade válida.';
    msg.className = 'msg erro';
    return;
  }
  if (precoCusto === null || isNaN(precoCusto) || precoCusto < 0) {
    msg.textContent = 'Informe um preço de custo válido.';
    msg.className = 'msg erro';
    return;
  }

  const opcaoVariacao = selectVariacao.selectedOptions[0];
  const opcaoProduto = selectProduto.selectedOptions[0];

  itensCompra.push({
    id_variacao: Number(selectVariacao.value),
    produto: opcaoProduto.textContent,
    tamanho: opcaoVariacao.dataset.tamanho,
    cor: opcaoVariacao.dataset.cor,
    quantidade,
    preco_custo: precoCusto,
  });

  renderizarItens();
  document.getElementById('formItem').reset();
  document.getElementById('variacaoItem').innerHTML = '<option value="">Selecione um produto primeiro</option>';
});

document.getElementById('btnFinalizarCompra').addEventListener('click', async () => {
  const msg = document.getElementById('msgCompra');
  msg.className = 'msg';

  const idFornecedor = document.getElementById('fornecedor').value;
  const idFuncionario = document.getElementById('funcionario').value;
  const numeroNota = document.getElementById('numeroNota').value;
  const dataCompra = document.getElementById('dataCompra').value;

  if (!idFornecedor || !idFuncionario) {
    msg.textContent = 'Selecione o fornecedor e quem está registrando a compra.';
    msg.className = 'msg erro';
    return;
  }
  if (!dataCompra) {
    msg.textContent = 'Informe a data da compra.';
    msg.className = 'msg erro';
    return;
  }
  if (itensCompra.length === 0) {
    msg.textContent = 'Adicione pelo menos um item antes de finalizar.';
    msg.className = 'msg erro';
    return;
  }

  const corpo = {
    id_fornecedor: Number(idFornecedor),
    id_funcionario: Number(idFuncionario),
    numero_nota: numeroNota || null,
    data_compra: dataCompra,
    itens: itensCompra.map(item => ({
      id_variacao: item.id_variacao,
      quantidade: item.quantidade,
      preco_custo: item.preco_custo,
    })),
  };

  try {
    await apiFetch('/api/compras', { method: 'POST', body: JSON.stringify(corpo) });
    msg.textContent = 'Compra registrada com sucesso! O estoque já foi atualizado.';
    msg.className = 'msg sucesso';
    itensCompra = [];
    renderizarItens();
    document.getElementById('numeroNota').value = '';
    await carregarCompras();
  } catch (erro) {
    msg.textContent = erro.message;
    msg.className = 'msg erro';
  }
});

async function carregarCompras() {
  const compras = await apiFetch('/api/compras');
  const tbody = document.getElementById('tabelaCompras');

  if (compras.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhuma compra registrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = compras.map(c => `
    <tr>
      <td>${new Date(c.data_compra).toLocaleDateString('pt-BR')}</td>
      <td>${c.fornecedor}</td>
      <td>${c.numero_nota || '—'}</td>
      <td>${c.funcionario}</td>
      <td>${formatarMoeda(Number(c.valor_total))}</td>
    </tr>
  `).join('');
}

(async function iniciar() {
  document.getElementById('dataCompra').value = new Date().toISOString().slice(0, 10);
  await Promise.all([carregarFornecedores(), carregarFuncionarios(), carregarProdutosSelect()]);
  await carregarCompras();
})();
