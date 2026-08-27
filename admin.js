// ================= FIREBASE INIT =================
const firebaseConfig = {
  apiKey: "AIzaSyBKsk1dETk2qMLlCCS77Q44YOwlovdkkhw",
  authDomain: "rei-do-acai-1583c.firebaseapp.com",
  projectId: "rei-do-acai-1583c",
  storageBucket: "rei-do-acai-1583c.firebasestorage.app",
  messagingSenderId: "781250224512",
  appId: "1:781250224512:web:b026ac582122cc8b142165"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const loginView = document.getElementById('login-view');
const adminView = document.getElementById('admin-view');
let meuGrafico = null;
let pedidosNuvem = [];
let cardapioNuvem = [];
let primeiraCargaPedidos = true; 

// ================= OLHEIROS DA NUVEM =================
db.collection("pedidos").onSnapshot((snapshot) => {
    pedidosNuvem = [];
    let temPedidoNovo = false;

    snapshot.forEach((doc) => {
        let pedido = doc.data();
        pedido.firebaseId = doc.id; 
        pedidosNuvem.push(pedido);
    });

    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") temPedidoNovo = true;
    });

    if (!primeiraCargaPedidos && temPedidoNovo) {
        const audio = document.getElementById('som-notificacao');
        if (audio) audio.play().catch(e => console.log("Áudio bloqueado."));
    }

    primeiraCargaPedidos = false;
    pedidosNuvem.sort((a, b) => new Date(b.data) - new Date(a.data));
    if (!adminView.classList.contains('hidden')) carregarTudo();
});

db.collection("cardapio").onSnapshot((snapshot) => {
    cardapioNuvem = [];
    snapshot.forEach((doc) => {
        let item = doc.data();
        item.id = doc.id; 
        cardapioNuvem.push(item);
    });
    if (!adminView.classList.contains('hidden')) carregarTudo();
});

db.collection("config").doc("loja").onSnapshot((doc) => {
    if (doc.exists) {
        const configLoja = doc.data();
        if(document.getElementById('cloud-endereco')) {
            document.getElementById('cloud-endereco').innerText = configLoja.endereco || "Não definido";
            document.getElementById('cloud-raio').innerText = configLoja.raio || "0";
            document.getElementById('cloud-taxa').innerText = configLoja.taxa ? parseFloat(configLoja.taxa).toFixed(2).replace('.', ',') : "0,00";
            document.getElementById('config-limite-gratis').value = configLoja.limiteGratis || 4;
            
            const badge = document.getElementById('nuvem-status');
            if(badge) {
                badge.innerHTML = '🟢 Sincronizado';
                badge.style.background = '#d4edda';
                badge.style.color = '#155724';
            }
        }
    }
});

window.addEventListener('focus', () => { if (!adminView.classList.contains('hidden')) carregarTudo(); });


// ================= LOGIN & NAVEGAÇÃO =================
function fazerLogin() {
    const email = document.getElementById('username').value; // Agora o admin digitará o e-mail aqui
    const pass = document.getElementById('password').value;

    if (!email || !pass) return alert("Preencha e-mail e senha.");

    // O Firebase verifica direto no servidor do Google se a senha bate
    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            loginView.classList.add('hidden'); 
            adminView.classList.remove('hidden'); 
            carregarTudo();
        })
        .catch((error) => {
            alert('Acesso negado: E-mail ou senha incorretos.');
            console.error(error);
        });
}

function sair() { 
    firebase.auth().signOut().then(() => {
        adminView.classList.add('hidden'); 
        loginView.classList.remove('hidden'); 
    });
}

function navegarAba(secao, elementoClicado) {
    document.querySelectorAll('#menu-lateral li').forEach(li => li.classList.remove('active'));
    elementoClicado.classList.add('active');
    document.getElementById('titulo-secao').innerText = elementoClicado.innerText;
    document.querySelectorAll('.admin-section').forEach(sec => { sec.classList.remove('active'); sec.classList.add('hidden'); });
    const secaoAlvo = document.getElementById('sec-' + secao);
    secaoAlvo.classList.add('active'); secaoAlvo.classList.remove('hidden'); carregarTudo();
}

// ================= RENDERIZAR PAINEL =================
function carregarTudo() {
    const pedidosAtivos = pedidosNuvem.filter(p => p.status !== 'Entregue');
    const pedidosEntregues = pedidosNuvem.filter(p => p.status === 'Entregue');
    const hoje = new Date();
    let lucroHj = 0, lucroSem = 0, lucroMs = 0;

    pedidosEntregues.forEach(p => {
        const dataPed = p.data ? new Date(p.data) : hoje;
        const total = parseFloat(p.total) || 0;
        if (dataPed.toDateString() === hoje.toDateString()) lucroHj += total;
        if (Math.ceil(Math.abs(hoje - dataPed) / (1000 * 60 * 60 * 24)) <= 7) lucroSem += total;
        if (dataPed.getMonth() === hoje.getMonth() && dataPed.getFullYear() === hoje.getFullYear()) lucroMs += total;
    });

    if(document.getElementById('lucro-hoje')) document.getElementById('lucro-hoje').innerText = `R$ ${lucroHj.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('lucro-semana')) document.getElementById('lucro-semana').innerText = `R$ ${lucroSem.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('lucro-mes')) document.getElementById('lucro-mes').innerText = `R$ ${lucroMs.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('dash-pedidos')) document.getElementById('dash-pedidos').innerText = pedidosAtivos.length;
    if(document.getElementById('dash-vendas')) document.getElementById('dash-vendas').innerText = `R$ ${lucroHj.toFixed(2).replace('.', ',')}`;

    atualizarGrafico(pedidosEntregues);

    const dashEspera = document.getElementById('tabela-dash-espera');
    if(dashEspera) {
        dashEspera.innerHTML = '';
        pedidosAtivos.slice(0, 5).forEach(p => { dashEspera.innerHTML += `<tr><td>#${p.id}</td><td>${gerarStatusBar(p.status)}</td></tr>`; });
    }

    const tbEspera = document.getElementById('tabela-espera');
    if(tbEspera) {
        tbEspera.innerHTML = '';
        pedidosAtivos.forEach(p => {
            let htmlDetalhes = p.itens && p.itens.length > 0 ? `<ul class="detalhes-pedido">${p.itens.map(i => `<li><b>${i.nome}</b> <i>${i.detalhes}</i></li>`).join('')}</ul>` : p.itensResumo;
            let pagamentoBadge = p.pagamento ? `<br><span style="color:#28a745; font-weight:bold;">${p.pagamento}</span>` : "";
            let tipoPedidoBadge = p.tipoEntrega === 'entrega' 
                ? `<span style="background:var(--purple-light); color:white; padding:3px 6px; border-radius:4px; font-size:11px;">🛵 Delivery</span><br><small style="color:#555;">${p.enderecoCliente}<br>Whats: ${p.telefoneCliente}</small>${pagamentoBadge}` 
                : `<span style="background:#ff9800; color:white; padding:3px 6px; border-radius:4px; font-size:11px;">🏪 Retirada (${p.mesa})</span>${pagamentoBadge}`;

            tbEspera.innerHTML += `
                <tr>
                    <td><strong>#${p.id}</strong><br><small style="color:#888;">${p.data ? new Date(p.data).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</small></td>
                    <td>${tipoPedidoBadge}</td>
                    <td>${htmlDetalhes}</td>
                    <td>${gerarStatusBar(p.status)}</td>
                    <td><button class="btn" style="padding: 8px;" onclick="avancarStatus('${p.firebaseId}')">Avançar ➔</button></td>
                </tr>
            `;
        });
    }

    const tbHist = document.getElementById('tabela-historico');
    if(tbHist) {
        tbHist.innerHTML = '';
        pedidosEntregues.forEach(p => {
            tbHist.innerHTML += `<tr><td>#${p.id}</td><td>${p.data ? new Date(p.data).toLocaleDateString() : 'Hoje'}</td><td>${p.itensResumo}</td><td style="color:#388e3c; font-weight:bold;">R$ ${p.total.toFixed(2)}</td><td>✅ Entregue</td></tr>`;
        });
    }

    const tbCardapio = document.getElementById('tabela-cardapio');
    if(tbCardapio) {
        tbCardapio.innerHTML = '';
        cardapioNuvem.forEach(c => {
            tbCardapio.innerHTML += `
                <tr>
                    <td><label class="switch"><input type="checkbox" ${c.disponivel ? 'checked' : ''} onchange="toggleDisponibilidade('${c.id}', this.checked)"><span class="slider"></span></label></td>
                    <td style="font-weight: 500;">${c.imagem ? `<img src="${c.imagem}" style="width:35px; height:35px; object-fit:contain; background:#ede7f6; border-radius:4px; vertical-align:middle; margin-right:8px;">` : ''}${c.nome}</td>
                    <td>${c.categoria}</td>
                    <td style="color: var(--green-primary); font-weight: bold;">R$ ${c.preco.toFixed(2)}</td>
                    <td>
                        <button onclick="editarProduto('${c.id}')" style="background:#ff9800; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right: 5px;">✏️ Editar</button>
                        <button onclick="deletarProduto('${c.id}')" style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        });
    }
}

async function prepararSalvamento() {
    const ruaInput = document.getElementById('config-rua').value.trim();
    const raioInput = document.getElementById('config-raio').value;
    const taxaInput = document.getElementById('config-taxa').value;
    const limiteInput = document.getElementById('config-limite-gratis').value;

    if (!ruaInput && !raioInput && !taxaInput && !limiteInput) {
        return alert("Preencha ao menos uma das opções para atualizar as configurações.");
    }

    try {
        const docAtual = await db.collection("config").doc("loja").get();
        const dadosAntigos = docAtual.exists ? docAtual.data() : { endereco: "Av. Barão do Rio Branco, 1000", raio: 5, taxa: 5, limiteGratis: 4 };

        const enderecoFinal = ruaInput !== "" ? ruaInput : dadosAntigos.endereco;
        const raioFinal = raioInput !== "" ? parseFloat(raioInput) : dadosAntigos.raio;
        const taxaFinal = taxaInput !== "" ? parseFloat(taxaInput) : dadosAntigos.taxa;
        const limiteFinal = limiteInput !== "" ? parseInt(limiteInput) : (dadosAntigos.limiteGratis || 4);

        await db.collection("config").doc("loja").set({ 
            endereco: enderecoFinal, raio: raioFinal, taxa: taxaFinal, limiteGratis: limiteFinal 
        });
        
        alert("✅ Configurações atualizadas na nuvem com sucesso!");
        ['config-rua', 'config-raio', 'config-taxa', 'config-limite-gratis'].forEach(id => document.getElementById(id).value = '');
    } catch (e) {
        console.error(e);
        alert("❌ Erro ao salvar na nuvem.");
    }
}

// ================= CRUD CARDÁPIO E PEDIDOS =================
function gerarStatusBar(status) {
    let seg1 = 'bg-vazio', seg2 = 'bg-vazio', seg3 = 'bg-vazio'; let textClass = 'preparo';
    if (status === 'Em Preparo') { seg1 = 'bg-preparo'; }
    if (status === 'Saiu para Entrega') { seg1 = 'bg-preparo'; seg2 = 'bg-saiu'; textClass = 'saiu'; }
    if (status === 'Entregue') { seg1 = 'bg-preparo'; seg2 = 'bg-saiu'; seg3 = 'bg-entregue'; textClass = 'entregue'; }
    return `<div class="status-text ${textClass}">${status}</div><div class="status-bar-container"><div class="status-segment ${seg1}"></div><div class="status-segment ${seg2}"></div><div class="status-segment ${seg3}"></div></div>`;
}

function avancarStatus(firebaseId) {
    let pedido = pedidosNuvem.find(p => p.firebaseId === firebaseId);
    if (!pedido) return;
    let novoStatus = ""; let mensagemZap = "";
    
    if (pedido.status === 'Em Preparo') {
        novoStatus = 'Saiu para Entrega';
        mensagemZap = pedido.tipoEntrega === 'entrega' ? `Olá! O pedido #${pedido.id} saiu para entrega e está a caminho!` : `Olá! O pedido #${pedido.id} está pronto e pode ser retirado!`;
    } else if (pedido.status === 'Saiu para Entrega') { novoStatus = 'Entregue'; }

    if (novoStatus !== "") {
        db.collection("pedidos").doc(firebaseId).update({ status: novoStatus }).then(() => {
            if (mensagemZap !== "" && pedido.telefoneCliente && pedido.telefoneCliente.length >= 10) {
                window.open(`https://wa.me/55${pedido.telefoneCliente}?text=${encodeURIComponent(mensagemZap)}`, '_blank');
            }
        }).catch(e => console.error(e));
    }
}

function adicionarProduto() {
    const nome = document.getElementById('novo-nome').value; const cat = document.getElementById('nova-cat').value;
    const preco = parseFloat(document.getElementById('novo-preco').value); const inputImg = document.getElementById('nova-img');
    const caldasRaw = document.getElementById('novas-caldas').value; const compsGratisRaw = document.getElementById('novos-comps-gratis').value;
    const compsRaw = document.getElementById('novos-comps').value;

    if (!nome || isNaN(preco)) return alert('Preencha o nome e o preço.');

    let caldasArray = caldasRaw.trim() !== '' ? caldasRaw.split(',').map(c => c.trim()).filter(c => c !== '') : [];
    let gratisArray = compsGratisRaw.trim() !== '' ? compsGratisRaw.split(',').map(c => c.trim()).filter(c => c !== '') : [];
    let compsArray = [];
    if(compsRaw.trim() !== '') {
        compsRaw.split(',').forEach(par => { let p = par.split(':'); if(p.length === 2) compsArray.push({ nome: p[0].trim(), preco: parseFloat(p[1].trim()) || 0 }); });
    }

    const salvar = (imgBase64) => {
        db.collection("cardapio").add({ nome: nome, categoria: cat, preco: preco, imagem: imgBase64, caldas: caldasArray, complementosGratis: gratisArray, complementos: compsArray, disponivel: true })
        .then(() => { ['novo-nome', 'novo-preco', 'nova-img', 'novas-caldas', 'novos-comps-gratis', 'novos-comps'].forEach(id => document.getElementById(id).value = ''); alert('✅ Salvo na nuvem!'); })
        .catch(e => console.error(e));
    };

    if (inputImg.files && inputImg.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas'); const scaleSize = 400 / img.width;
                canvas.width = 400; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                salvar(canvas.toDataURL('image/jpeg', 0.7));
            }
            img.src = e.target.result;
        };
        reader.readAsDataURL(inputImg.files[0]);
    } else { salvar(""); }
}

function editarProduto(id) {
    let produto = cardapioNuvem.find(c => c.id === id);
    if (!produto) return;

    let novoNome = prompt("1/5 - Editar nome do produto:", produto.nome); if (novoNome === null || novoNome.trim() === "") return;
    let novoPreco = prompt("2/5 - Editar preço base (use ponto ex: 15.50):", produto.preco); if (novoPreco === null || isNaN(parseFloat(novoPreco))) return;

    let stringCaldasAtual = produto.caldas ? produto.caldas.join(', ') : "";
    let novasCaldasRaw = prompt("3/5 - Editar Caldas (separe por vírgula):", stringCaldasAtual); if (novasCaldasRaw === null) return;
    let caldasArray = novasCaldasRaw.trim() !== '' ? novasCaldasRaw.split(',').map(c => c.trim()).filter(c => c !== '') : [];

    let stringGratisAtual = produto.complementosGratis ? produto.complementosGratis.join(', ') : "";
    let novosGratisRaw = prompt("4/5 - Editar Complementos Grátis (separe por vírgula):", stringGratisAtual); if (novosGratisRaw === null) return;
    let gratisArray = novosGratisRaw.trim() !== '' ? novosGratisRaw.split(',').map(c => c.trim()).filter(c => c !== '') : [];

    let stringCompsAtual = produto.complementos ? produto.complementos.map(c => `${c.nome}:${c.preco}`).join(', ') : "";
    let novosCompsRaw = prompt("5/5 - Editar Complementos Extras (Nome:Preco, Nome:Preco):", stringCompsAtual); if (novosCompsRaw === null) return;
    
    let compsArray = [];
    if(novosCompsRaw.trim() !== '') {
        novosCompsRaw.split(',').forEach(par => { let p = par.split(':'); if(p.length === 2) compsArray.push({ nome: p[0].trim(), preco: parseFloat(p[1].trim()) || 0 }); });
    }

    db.collection("cardapio").doc(id).update({ nome: novoNome, preco: parseFloat(novoPreco), caldas: caldasArray, complementosGratis: gratisArray, complementos: compsArray })
    .then(() => { alert("✅ Produto atualizado!"); }).catch(e => console.error(e));
}

function deletarProduto(id) { if(confirm("Excluir definitivamente da nuvem?")) db.collection("cardapio").doc(id).delete(); }

function toggleDisponibilidade(id, disponivel) { db.collection("cardapio").doc(id).update({ disponivel: disponivel }); }

function atualizarGrafico(pedidosEntregues) {
    const ctx = document.getElementById('lucrosChart'); if (!ctx) return;
    const ultimos = pedidosEntregues.slice(-10);
    if (meuGrafico) meuGrafico.destroy();
    meuGrafico = new Chart(ctx, { type: 'line', data: { labels: ultimos.length ? ultimos.map(p => `#${p.id}`) : ['Sem Vendas'], datasets: [{ label: 'Valor (R$)', data: ultimos.length ? ultimos.map(p => p.total) : [0], borderColor: '#4a148c', backgroundColor: 'rgba(124, 67, 189, 0.2)', fill: true, tension: 0.3 }] } });
}

// ================= BOTÕES DO DASHBOARD =================

// 1. Lógica do botão Atualizar (Força a busca de dados novos na nuvem)
const btnAtualizar = document.getElementById('btn-atualizar') || document.querySelector('.btn-atualizar');
if (btnAtualizar) {
    btnAtualizar.addEventListener('click', () => {
        location.reload(); 
    });
}

// 2. Novo Reset Total (Limpa APENAS a fila de pedidos, preservando o cardápio e configs)
function resetarSistema() { 
    if(confirm("ÚLTIMO AVISO: Tem certeza absoluta que deseja APAGAR TODOS OS PEDIDOS? Isso não pode ser desfeito.")) {
        db.collection("pedidos").get().then((querySnapshot) => {
            const batch = db.batch();
            querySnapshot.forEach((doc) => { batch.delete(doc.ref); });
            return batch.commit();
        }).then(() => {
            alert("✅ Todos os pedidos foram apagados com sucesso!");
            location.reload();
        }).catch((erro) => {
            alert("❌ Erro ao tentar limpar o banco.");
        });
    }
}


