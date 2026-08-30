const API_BASE_URL = "https://rei-do-acai-api.onrender.com/api";

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

let tagsCaldas = [];
let tagsGratis = [];
let tagsPagos = [];

let editTagsCaldas = [];
let editTagsGratis = [];
let editTagsPagos = [];

function mostrarAlertaAdmin(titulo, mensagem, tipo = 'aviso') {
    const iconeContainer = document.getElementById('modal-alerta-icone');
    document.getElementById('modal-alerta-titulo').innerText = titulo;
    document.getElementById('modal-alerta-msg').innerText = mensagem;
    
    if (tipo === 'sucesso') iconeContainer.innerHTML = '<i class="fas fa-check-circle" style="color: var(--green-primary);"></i>';
    else if (tipo === 'erro') iconeContainer.innerHTML = '<i class="fas fa-times-circle" style="color: #dc3545;"></i>';
    else iconeContainer.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #ff9800;"></i>';
    
    document.getElementById('modal-alerta-admin').classList.remove('modal-oculto');
}

function fecharAlertaAdmin() { document.getElementById('modal-alerta-admin').classList.add('modal-oculto'); }

let confirmCallback = null;
function mostrarConfirmAdmin(titulo, msg, callback) {
    document.getElementById('modal-confirm-titulo').innerText = titulo;
    document.getElementById('modal-confirm-msg').innerText = msg;
    confirmCallback = callback;
    document.getElementById('modal-confirm-admin').classList.remove('modal-oculto');
}

function fecharConfirmAdmin(resultado) {
    document.getElementById('modal-confirm-admin').classList.add('modal-oculto');
    if (confirmCallback) { confirmCallback(resultado); confirmCallback = null; }
}

function iniciarOlheiros() {
    // 🚀 LÓGICA DE PERFORMANCE: Puxando apenas os últimos 200 pedidos
    db.collection("pedidos").orderBy("data", "desc").limit(200).onSnapshot((snapshot) => {
        let temPedidoNovo = false;
        let pixAprovadoAgora = false;
        let pedidoCanceladoAgora = false; 

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") temPedidoNovo = true;
            if (change.type === "modified") {
                let novoDado = change.doc.data();
                let pedidoAntigo = pedidosNuvem.find(p => p.firebaseId === change.doc.id);
                
                if (pedidoAntigo && pedidoAntigo.pagamento === "💠 PIX (Aguardando Pagamento)" && novoDado.pagamento === "💠 PIX (Aprovado)") {
                    pixAprovadoAgora = true;
                }
                if (pedidoAntigo && pedidoAntigo.status !== "Cancelado" && novoDado.status === "Cancelado") {
                    pedidoCanceladoAgora = true;
                }
            }
        });

        pedidosNuvem = [];
        snapshot.forEach((doc) => {
            let pedido = doc.data();
            pedido.firebaseId = doc.id; 
            pedidosNuvem.push(pedido);
        });

        if (!primeiraCargaPedidos) {
            if (temPedidoNovo) {
                const audioNovo = document.getElementById('som-notificacao');
                if (audioNovo) audioNovo.play().catch(e => console.warn("Áudio bloqueado."));
            }
            if (pixAprovadoAgora) {
                const audioPix = document.getElementById('som-pix-aprovado');
                if (audioPix) audioPix.play().catch(e => console.warn("Áudio PIX bloqueado."));
            }
            if (pedidoCanceladoAgora) {
                const audioCancel = document.getElementById('som-cancelado');
                if (audioCancel) audioCancel.play().catch(e => console.warn("Áudio Cancelamento bloqueado."));
            }
        }

        primeiraCargaPedidos = false;
        pedidosNuvem.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        if (!adminView.classList.contains('hidden')) carregarTudo();
    }, (error) => console.error("Erro no olheiro:", error));

    db.collection("cardapio").onSnapshot((snapshot) => {
        cardapioNuvem = [];
        snapshot.forEach((doc) => { let item = doc.data(); item.id = doc.id; cardapioNuvem.push(item); });
        if (!adminView.classList.contains('hidden')) carregarTudo();
    });

    db.collection("config").doc("loja").onSnapshot((doc) => {
        if (doc.exists) {
            const configLoja = doc.data();
            if(document.getElementById('config-limite-gratis')) document.getElementById('config-limite-gratis').value = configLoja.limiteGratis || 4;
            if(document.getElementById('cloud-limite')) document.getElementById('cloud-limite').innerText = configLoja.limiteGratis || 4;
        }
    });
}

firebase.auth().onAuthStateChanged((user) => {
    if (user) { loginView.classList.add('hidden'); adminView.classList.remove('hidden'); iniciarOlheiros(); } 
    else { adminView.classList.add('hidden'); loginView.classList.remove('hidden'); }
});

function fazerLogin() {
    const email = document.getElementById('username').value; 
    const pass = document.getElementById('password').value;

    if (!email || !pass) return mostrarAlertaAdmin("Atenção", "Preencha e-mail e senha.", "aviso");

    let btn = document.querySelector('.login-box .btn');
    if(btn) btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Entrando...";

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .catch((error) => {
            mostrarAlertaAdmin("Erro de Acesso", "Acesso negado: E-mail ou senha incorretos.", "erro");
            if(btn) btn.innerHTML = "Entrar no Painel";
        });
}

function sair() { firebase.auth().signOut(); }

function navegarAba(secao, elementoClicado) {
    document.querySelectorAll('#menu-lateral li').forEach(li => li.classList.remove('active'));
    elementoClicado.classList.add('active');
    document.getElementById('titulo-secao').innerText = elementoClicado.innerText;

    document.querySelectorAll('.admin-section').forEach(sec => { sec.classList.remove('active'); sec.classList.add('hidden'); });
    const secaoAlvo = document.getElementById('sec-' + secao);
    secaoAlvo.classList.add('active'); secaoAlvo.classList.remove('hidden'); 
    carregarTudo();
}

function navegarWizard(passoDestino) {
    document.querySelectorAll('.wizard-step').forEach(step => { step.classList.add('hidden'); step.classList.remove('active'); });
    document.querySelectorAll('.step-indicator').forEach(ind => { ind.classList.remove('active'); ind.classList.remove('completed'); });

    document.getElementById(`step-${passoDestino}`).classList.remove('hidden');
    document.getElementById(`step-${passoDestino}`).classList.add('active');

    for(let i = 1; i <= 3; i++) {
        let ind = document.getElementById(`ind-step-${i}`);
        if(i < passoDestino) ind.classList.add('completed');
        if(i === passoDestino) ind.classList.add('active');
    }
}

function previewImagem(event) {
    const input = event.target;
    const preview = document.getElementById('img-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { preview.src = e.target.result; preview.style.display = 'inline-block'; }
        reader.readAsDataURL(input.files[0]);
    } else { preview.src = ""; preview.style.display = 'none'; }
}

function addTag(tipo) {
    let inputEl = document.getElementById(`input-${tipo}`);
    let valor = inputEl.value.trim();
    if (valor !== "") {
        if (tipo === 'calda' && !tagsCaldas.includes(valor)) tagsCaldas.push(valor);
        if (tipo === 'gratis' && !tagsGratis.includes(valor)) tagsGratis.push(valor);
        inputEl.value = "";
        renderTags(tipo);
    }
}

function addTagPago() {
    let inputNome = document.getElementById('input-pago-nome');
    let inputPreco = document.getElementById('input-pago-preco');
    let nome = inputNome.value.trim();
    let preco = parseFloat(inputPreco.value);

    if (nome !== "" && !isNaN(preco)) {
        tagsPagos.push({ nome: nome, preco: preco });
        inputNome.value = ""; inputPreco.value = "";
        renderTags('pagos');
    } else { mostrarAlertaAdmin("Atenção", "Preencha o Nome e o Preço válido do complemento.", "aviso"); }
}

function removeTag(tipo, index) {
    if (tipo === 'calda') tagsCaldas.splice(index, 1);
    if (tipo === 'gratis') tagsGratis.splice(index, 1);
    if (tipo === 'pagos') tagsPagos.splice(index, 1);
    renderTags(tipo);
}

function renderTags(tipo) {
    let container = document.getElementById(`tags-${tipo}`);
    container.innerHTML = "";
    
    let arrayParaRenderizar = [];
    let msgVazio = "";
    if (tipo === 'calda') { arrayParaRenderizar = tagsCaldas; msgVazio = "Nenhuma calda adicionada."; }
    if (tipo === 'gratis') { arrayParaRenderizar = tagsGratis; msgVazio = "Nenhum complemento grátis."; }
    if (tipo === 'pagos') { arrayParaRenderizar = tagsPagos; msgVazio = "Nenhum extra pago."; }

    if (arrayParaRenderizar.length === 0) { container.innerHTML = `<span style="color:#aaa; font-size:12px; margin-top:5px;">${msgVazio}</span>`; return; }

    arrayParaRenderizar.forEach((item, index) => {
        let span = document.createElement("span");
        if (tipo === 'pagos') {
            span.className = "tag-item pagos";
            span.innerHTML = `<span>${item.nome} (+R$ ${item.preco.toFixed(2)})</span> <button type="button" class="tag-close" onclick="removeTag('${tipo}', ${index})"><i class="fas fa-times"></i></button>`;
        } else {
            span.className = "tag-item";
            span.innerHTML = `<span>${item}</span> <button type="button" class="tag-close" onclick="removeTag('${tipo}', ${index})"><i class="fas fa-times"></i></button>`;
        }
        container.appendChild(span);
    });
}

function limparFormularioCardapio() {
    document.getElementById('novo-nome').value = ''; document.getElementById('novo-preco').value = ''; document.getElementById('nova-img').value = '';
    document.getElementById('img-preview').style.display = 'none';
    tagsCaldas = []; tagsGratis = []; tagsPagos = [];
    renderTags('calda'); renderTags('gratis'); renderTags('pagos');
    navegarWizard(1);
}

function adicionarProduto() {
    const nome = document.getElementById('novo-nome').value; 
    const cat = document.getElementById('nova-cat').value;
    const preco = parseFloat(document.getElementById('novo-preco').value); 
    const inputImg = document.getElementById('nova-img');

    if (!nome || isNaN(preco)) { navegarWizard(1); return mostrarAlertaAdmin("Atenção", "Preencha o nome e o preço base.", "aviso"); }

    const salvar = (imgBase64) => {
        db.collection("cardapio").add({ 
            nome: nome, categoria: cat, preco: preco, imagem: imgBase64, 
            caldas: tagsCaldas, complementosGratis: tagsGratis, complementos: tagsPagos, disponivel: true 
        }).then(() => { limparFormularioCardapio(); mostrarAlertaAdmin("Sucesso!", "Produto adicionado!", "sucesso"); }).catch(e => console.error(e));
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
    
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-nome').value = produto.nome;
    document.getElementById('edit-preco').value = produto.preco;

    editTagsCaldas = produto.caldas ? [...produto.caldas] : [];
    editTagsGratis = produto.complementosGratis ? [...produto.complementosGratis] : [];
    editTagsPagos = produto.complementos ? [...produto.complementos] : [];

    renderEditTags('calda'); renderEditTags('gratis'); renderEditTags('pagos');
    document.getElementById('modal-editar-produto').classList.remove('modal-oculto');
}

function fecharModalEditar() { document.getElementById('modal-editar-produto').classList.add('modal-oculto'); }

function addEditTag(tipo) {
    let inputEl = document.getElementById(`input-edit-${tipo}`);
    let valor = inputEl.value.trim();
    if (valor !== "") {
        if (tipo === 'calda' && !editTagsCaldas.includes(valor)) editTagsCaldas.push(valor);
        if (tipo === 'gratis' && !editTagsGratis.includes(valor)) editTagsGratis.push(valor);
        inputEl.value = ""; renderEditTags(tipo);
    }
}

function addEditTagPago() {
    let inputNome = document.getElementById('input-edit-pago-nome');
    let inputPreco = document.getElementById('input-edit-pago-preco');
    let nome = inputNome.value.trim(); let preco = parseFloat(inputPreco.value);

    if (nome !== "" && !isNaN(preco)) {
        editTagsPagos.push({ nome: nome, preco: preco });
        inputNome.value = ""; inputPreco.value = ""; renderEditTags('pagos');
    } else { mostrarAlertaAdmin("Atenção", "Preencha o Nome e o Preço.", "aviso"); }
}

function removeEditTag(tipo, index) {
    if (tipo === 'calda') editTagsCaldas.splice(index, 1);
    if (tipo === 'gratis') editTagsGratis.splice(index, 1);
    if (tipo === 'pagos') editTagsPagos.splice(index, 1);
    renderEditTags(tipo);
}

function renderEditTags(tipo) {
    let container = document.getElementById(`tags-edit-${tipo}`); container.innerHTML = "";
    
    let arrayParaRenderizar = []; let msgVazio = "";
    if (tipo === 'calda') { arrayParaRenderizar = editTagsCaldas; msgVazio = "Nenhuma calda adicionada."; }
    if (tipo === 'gratis') { arrayParaRenderizar = editTagsGratis; msgVazio = "Nenhum complemento grátis."; }
    if (tipo === 'pagos') { arrayParaRenderizar = editTagsPagos; msgVazio = "Nenhum extra pago."; }

    if (arrayParaRenderizar.length === 0) { container.innerHTML = `<span style="color:#aaa; font-size:12px;">${msgVazio}</span>`; return; }

    arrayParaRenderizar.forEach((item, index) => {
        let span = document.createElement("span");
        if (tipo === 'pagos') {
            span.className = "tag-item pagos";
            span.innerHTML = `<span>${item.nome} (+R$ ${item.preco.toFixed(2)})</span> <button type="button" class="tag-close" onclick="removeEditTag('${tipo}', ${index})"><i class="fas fa-times"></i></button>`;
        } else {
            span.className = "tag-item";
            span.innerHTML = `<span>${item}</span> <button type="button" class="tag-close" onclick="removeEditTag('${tipo}', ${index})"><i class="fas fa-times"></i></button>`;
        }
        container.appendChild(span);
    });
}

function salvarEdicaoProduto() {
    const id = document.getElementById('edit-id').value;
    const novoNome = document.getElementById('edit-nome').value.trim();
    const novoPreco = parseFloat(document.getElementById('edit-preco').value);

    if (!novoNome || isNaN(novoPreco)) return mostrarAlertaAdmin("Atenção", "Preencha o nome e o preço base.", "aviso");

    db.collection("cardapio").doc(id).update({ 
        nome: novoNome, preco: novoPreco, caldas: editTagsCaldas, complementosGratis: editTagsGratis, complementos: editTagsPagos 
    }).then(() => { mostrarAlertaAdmin("Sucesso!", "Produto atualizado!", "sucesso"); fecharModalEditar(); }).catch(e => console.error(e));
}

function deletarProduto(id) { 
    mostrarConfirmAdmin("Deletar Produto", "Tem certeza que deseja excluir?", (confirmado) => { if(confirmado) db.collection("cardapio").doc(id).delete(); });
}

function toggleDisponibilidade(id, disponivel) { db.collection("cardapio").doc(id).update({ disponivel: disponivel }); }

function abrirModalDetalhes(firebaseId) {
    let pedido = pedidosNuvem.find(p => p.firebaseId === firebaseId); 
    if (!pedido) return;

    document.getElementById('detalhe-id').innerText = `Pedido #${pedido.id}`;
    let pagamentoBadge = pedido.pagamento ? `<span style="color:#28a745; font-weight:bold;">${pedido.pagamento}</span>` : "";
    document.getElementById('detalhe-cliente').innerHTML = `
        <strong>${pedido.tipoEntrega === 'entrega' ? '🛵 Delivery' : '🏪 Retirada (Balcão)'}</strong><br>
        ${pedido.enderecoCliente}<br>
        ${pedido.telefoneCliente !== 'Não informado' ? `Whats: ${pedido.telefoneCliente}` : ''}<br>
        <div style="margin-top: 5px;">${pagamentoBadge}</div>
    `;

    let itensHtml = pedido.itens.map(i => `
        <div style="margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
            <strong style="font-size: 18px; color: var(--purple-dark); display: block; margin-bottom: 5px;">${i.nome}</strong>
            <span style="font-size: 16px; color: #222; line-height: 1.5;">${i.detalhes}</span>
        </div>
    `).join('');
    document.getElementById('detalhe-itens').innerHTML = itensHtml;
    document.getElementById('modal-detalhes-pedido').classList.remove('modal-oculto');
}

function fecharModalDetalhes() { document.getElementById('modal-detalhes-pedido').classList.add('modal-oculto'); }

function carregarTudo() {
    const secConfig = document.getElementById('sec-configuracoes');
    if (secConfig && !secConfig.classList.contains('hidden')) {
        const statusBadge = document.getElementById('nuvem-status');
        if (statusBadge) { statusBadge.innerHTML = '⏳ Sincronizando...'; statusBadge.style.background = '#fff3cd'; statusBadge.style.color = '#856404'; }

        db.collection("config").doc("loja").get()
            .then(doc => {
                if (doc.exists) {
                    const conf = doc.data();
                    document.getElementById('cloud-endereco').innerText = conf.endereco || "Não definido"; 
                    document.getElementById('cloud-raio').innerText = conf.raio || "0"; 
                    document.getElementById('cloud-taxa').innerText = conf.taxa ? parseFloat(conf.taxa).toFixed(2).replace('.', ',') : "0,00";
                    if (statusBadge) { statusBadge.innerHTML = '🟢 Sincronizado'; statusBadge.style.background = '#d4edda'; statusBadge.style.color = '#155724'; }
                }
            })
            .catch(erro => {
                document.getElementById('cloud-endereco').innerText = "Erro";
                if (statusBadge) { statusBadge.innerHTML = '🔴 Não Sincronizado'; statusBadge.style.background = '#f8d7da'; statusBadge.style.color = '#721c24'; }
            });
    }

    const pedidosAtivos = pedidosNuvem.filter(p => p.status !== 'Entregue' && p.status !== 'Finalizado' && p.arquivado !== true); 
    const pedidosEntregues = pedidosNuvem.filter(p => p.status === 'Entregue' || p.status === 'Finalizado' || p.status === 'Cancelado'); 
    
    const hoje = new Date(); 
    let lucroHj = 0, lucroSem = 0, lucroMs = 0;

    pedidosEntregues.forEach(p => {
        if(p.status === 'Cancelado') return;
        const dataPed = p.data ? new Date(p.data) : hoje; 
        const total = parseFloat(p.total) || 0;
        
        if (dataPed.toDateString() === hoje.toDateString()) lucroHj += total;
        if (Math.ceil(Math.abs(hoje - dataPed) / (1000 * 60 * 60 * 24)) <= 7) lucroSem += total; 
        if (dataPed.getMonth() === hoje.getMonth() && dataPed.getFullYear() === hoje.getFullYear()) lucroMs += total;
    });

    if(document.getElementById('lucro-hoje')) document.getElementById('lucro-hoje').innerText = `R$ ${lucroHj.toFixed(2).replace('.', ',')}`; 
    if(document.getElementById('lucro-semana')) document.getElementById('lucro-semana').innerText = `R$ ${lucroSem.toFixed(2).replace('.', ',')}`; 
    if(document.getElementById('lucro-mes')) document.getElementById('lucro-mes').innerText = `R$ ${lucroMs.toFixed(2).replace('.', ',')}`; 
    
    const ativosDashboard = pedidosAtivos.filter(p => p.status !== 'Cancelado');
    if(document.getElementById('dash-pedidos')) document.getElementById('dash-pedidos').innerText = ativosDashboard.length; 
    if(document.getElementById('dash-vendas')) document.getElementById('dash-vendas').innerText = `R$ ${lucroHj.toFixed(2).replace('.', ',')}`;
    
    atualizarGrafico(pedidosEntregues.filter(p => p.status !== 'Cancelado'));

    const dashEspera = document.getElementById('tabela-dash-espera'); 
    if(dashEspera) { 
        dashEspera.innerHTML = ''; 
        ativosDashboard.slice(0, 5).forEach(p => { dashEspera.innerHTML += `<tr><td>#${p.id}</td><td>${gerarStatusBar(p.status)}</td></tr>`; }); 
    }

    const tbEspera = document.getElementById('tabela-espera');
    if(tbEspera) {
        tbEspera.innerHTML = '';
        pedidosAtivos.forEach(p => {
            let htmlDetalhes = `
                <div style="font-weight: 700; color: #2d3748; font-size: 13px; margin-bottom: 10px;">${p.itensResumo}</div>
                <button style="background: #ffffff; color: var(--purple-dark); border: 1.5px solid var(--purple-dark); padding: 6px 14px; border-radius: 50px; cursor: pointer; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);" onclick="abrirModalDetalhes('${p.firebaseId}')">
                    <i class="fas fa-receipt"></i> Ver Comanda
                </button>
            `;
            let pagamentoBadge = p.pagamento ? `<br><span style="color:#28a745; font-weight:bold;">${p.pagamento}</span>` : "";
            let tipoPedidoBadge = p.tipoEntrega === 'entrega' ? 
                `<span style="background:var(--purple-light); color:white; padding:3px 6px; border-radius:4px; font-size:11px;">🛵 Delivery</span><br><small style="color:#555;">${p.enderecoCliente}<br>Whats: ${p.telefoneCliente}</small>${pagamentoBadge}` : 
                `<span style="background:#ff9800; color:white; padding:3px 6px; border-radius:4px; font-size:11px;">🏪 Retirada (${p.mesa})</span>${pagamentoBadge}`;
            
            let rowStyle = ""; 
            let btnAcao = "";

            if (p.status === "Cancelado") {
                rowStyle = "background-color: #fff5f5;"; 
                btnAcao = `
                    <button type="button" class="btn" style="background-color: #6c757d; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; box-shadow: none;" onclick="arquivarPedidoCancelado('${p.firebaseId}')">
                        <i class="fas fa-check-double"></i> Ciente
                    </button>`;
            } else {
                btnAcao = `
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <button type="button" class="btn" style="flex: 1; padding: 10px 5px; font-size: 13px;" onclick="avancarStatus('${p.firebaseId}')">
                            Avançar ➔
                        </button>
                        <button type="button" style="flex: 1; padding: 10px 5px; font-size: 13px; background-color: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;" onclick="recusarPedido('${p.firebaseId}')">
                            Recusar ✖
                        </button>
                    </div>`;
            }

            tbEspera.innerHTML += `
                <tr style="${rowStyle}">
                    <td><strong>#${p.id}</strong><br><small style="color:#888;">${p.data ? new Date(p.data).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</small></td>
                    <td>${tipoPedidoBadge}</td>
                    <td>${htmlDetalhes}</td>
                    <td>${gerarStatusBar(p.status)}</td>
                    <td>${btnAcao}</td>
                </tr>
            `;
        });
    }

    const tbHist = document.getElementById('tabela-historico'); 
    if(tbHist) { 
        tbHist.innerHTML = ''; 
        pedidosEntregues.forEach(p => { 
            let statusHist = p.status === 'Cancelado' ? `<span style="color:#dc3545;">❌ Cancelado</span>` : `✅ ${p.status}`;
            tbHist.innerHTML += `
                <tr>
                    <td>#${p.id}</td>
                    <td>${p.data ? new Date(p.data).toLocaleDateString() : 'Hoje'}</td>
                    <td>${p.itensResumo}</td>
                    <td style="color:#388e3c; font-weight:bold;">R$ ${p.total.toFixed(2)}</td>
                    <td>${statusHist}</td>
                </tr>
            `; 
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
                        <button type="button" onclick="editarProduto('${c.id}')" style="background:#ff9800; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right: 5px;">✏️ Editar</button>
                        <button type="button" onclick="deletarProduto('${c.id}')" style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        });
    }
}

let debounceBuscaLoja = null;

function sugerirEnderecosLoja() {
    clearTimeout(debounceBuscaLoja); 
    const input = document.getElementById('config-rua').value; 
    const lista = document.getElementById('autocomplete-list-loja');
    const inputLimpo = input.normalize('NFD').replace(/[\u0300-\u036f]/g, ""); 
    
    if (inputLimpo.length < 3) { lista.innerHTML = ''; return; }
    
    debounceBuscaLoja = setTimeout(async () => {
        try {
            const query = encodeURIComponent(inputLimpo + " Juiz de Fora"); 
            const res = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`); 
            const dados = await res.json();
            
            lista.innerHTML = ''; 
            const resultadosJF = dados.features.filter(item => item.properties.city === "Juiz de Fora" && item.properties.name);
            
            if (resultadosJF.length === 0) { lista.innerHTML = '<div style="color:red; text-align:center; padding: 10px;">Endereço não encontrado em JF.</div>'; return; }
            
            const ruasUnicas = new Set();
            resultadosJF.forEach(item => { 
                const rua = item.properties.name; 
                const bairro = item.properties.district || item.properties.suburb || "JF"; 
                const nomeExibicao = `${rua}, ${bairro}`; 
                
                if(!ruasUnicas.has(nomeExibicao)) { 
                    ruasUnicas.add(nomeExibicao); 
                    const div = document.createElement('div'); div.innerHTML = `📍 ${nomeExibicao}`; 
                    div.onclick = function() { document.getElementById('config-rua').value = nomeExibicao; lista.innerHTML = ''; }; 
                    lista.appendChild(div); 
                } 
            });
        } catch(e) {}
    }, 500); 
}

function prepararSalvamento() {
    const ruaInput = document.getElementById('config-rua').value.trim(); 
    const numeroInput = document.getElementById('config-numero') ? document.getElementById('config-numero').value.trim() : ""; 
    const raioInput = document.getElementById('config-raio').value; 
    const taxaInput = document.getElementById('config-taxa').value; 
    const limiteInput = document.getElementById('config-limite-gratis').value;
    
    if (!ruaInput && !numeroInput && !raioInput && !taxaInput && !limiteInput) return mostrarAlertaAdmin("Atenção", "Preencha ao menos uma das opções.", "aviso");
    
    document.getElementById('modal-senha').classList.remove('modal-oculto'); 
    document.getElementById('input-senha-modal').value = ''; document.getElementById('input-senha-modal').focus();
}

function fecharModalSenha() { document.getElementById('modal-senha').classList.add('modal-oculto'); }

async function confirmarSenhaModal() {
    const senha = document.getElementById('input-senha-modal').value; 
    if (!senha) return mostrarAlertaAdmin("Atenção", "Por favor, digite a senha.", "aviso");
    
    const userLogado = firebase.auth().currentUser; 
    if (!userLogado || !userLogado.email) return mostrarAlertaAdmin("Aviso de Segurança", "Sessão expirada. Faça login novamente.", "erro");
    
    const btnConfirmar = document.getElementById('btn-confirmar-senha'); btnConfirmar.innerHTML = "Verificando...";
    
    try { await firebase.auth().signInWithEmailAndPassword(userLogado.email, senha); } 
    catch (erroAuth) { btnConfirmar.innerHTML = "Confirmar"; return mostrarAlertaAdmin("Acesso Negado", "Senha incorreta. Tente novamente.", "erro"); }
    
    btnConfirmar.innerHTML = "Confirmar"; fecharModalSenha();

    const ruaInput = document.getElementById('config-rua').value.trim(); 
    const numeroInput = document.getElementById('config-numero') ? document.getElementById('config-numero').value.trim() : ""; 
    const raioInput = document.getElementById('config-raio').value; 
    const taxaInput = document.getElementById('config-taxa').value; 
    const limiteInput = document.getElementById('config-limite-gratis').value;
    
    let enderecoFormatado = ruaInput; 
    
    if (ruaInput !== "" && numeroInput !== "") enderecoFormatado = `${ruaInput}, ${numeroInput}`;
    else if (ruaInput === "" && numeroInput !== "") return mostrarAlertaAdmin("Atenção", "Para atualizar o número, digite a rua também.", "aviso");

    try {
        const docAtual = await db.collection("config").doc("loja").get(); 
        const dadosAntigos = docAtual.exists ? docAtual.data() : { endereco: "Av. Barão do Rio Branco, 1000", raio: 5, taxa: 5, limiteGratis: 4 };
        
        const enderecoFinal = enderecoFormatado !== "" ? enderecoFormatado : dadosAntigos.endereco; 
        const raioFinal = raioInput !== "" ? parseFloat(raioInput) : dadosAntigos.raio; 
        const taxaFinal = taxaInput !== "" ? parseFloat(taxaInput) : dadosAntigos.taxa; 
        const limiteFinal = limiteInput !== "" ? parseInt(limiteInput) : (dadosAntigos.limiteGratis || 4);
        
        await db.collection("config").doc("loja").set({ endereco: enderecoFinal, raio: raioFinal, taxa: taxaFinal, limiteGratis: limiteFinal });
        
        mostrarAlertaAdmin("Tudo certo!", "Configurações atualizadas e validadas com sucesso!", "sucesso"); 
        ['config-rua', 'config-raio', 'config-taxa', 'config-limite-gratis', 'config-numero'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = ''; }); 
        carregarTudo();
    } catch (e) { mostrarAlertaAdmin("Erro Crítico", "Ocorreu um erro ao salvar os dados na nuvem.", "erro"); }
}

function gerarStatusBar(status) {
    let seg1 = 'bg-vazio', seg2 = 'bg-vazio', seg3 = 'bg-vazio'; let textClass = 'preparo';
    
    if (status === 'Cancelado') return `<div class="status-text" style="color:#dc3545;">Cancelado</div><div class="status-bar-container"><div class="status-segment" style="background-color:#dc3545;"></div><div class="status-segment" style="background-color:#dc3545;"></div><div class="status-segment" style="background-color:#dc3545;"></div></div>`;
    if (status === 'Em Preparo') seg1 = 'bg-preparo'; 
    if (status === 'Saiu para Entrega' || status === 'Pronto para Retirada') { seg1 = 'bg-preparo'; seg2 = 'bg-saiu'; textClass = 'saiu'; }
    if (status === 'Entregue' || status === 'Finalizado') { seg1 = 'bg-preparo'; seg2 = 'bg-saiu'; seg3 = 'bg-entregue'; textClass = 'entregue'; }
    return `<div class="status-text ${textClass}">${status}</div><div class="status-bar-container"><div class="status-segment ${seg1}"></div><div class="status-segment ${seg2}"></div><div class="status-segment ${seg3}"></div></div>`;
}

function avancarStatus(firebaseId) {
    let pedido = pedidosNuvem.find(p => p.firebaseId === firebaseId); 
    if (!pedido) return;
    
    let novoStatus = ""; let mensagemZap = "";
    
    if (pedido.status === 'Em Preparo') { 
        if (pedido.tipoEntrega === 'entrega') { novoStatus = 'Saiu para Entrega'; mensagemZap = `Olá! O pedido #${pedido.id} saiu para entrega e está a caminho!`; } 
        else { novoStatus = 'Pronto para Retirada'; mensagemZap = `Olá! O pedido #${pedido.id} está pronto e já pode ser retirado no balcão!`; }
    } else if (pedido.status === 'Saiu para Entrega' || pedido.status === 'Pronto para Retirada') { 
        if (pedido.tipoEntrega === 'entrega') novoStatus = 'Entregue'; else novoStatus = 'Finalizado';
    }
    
    if (novoStatus !== "") { 
        db.collection("pedidos").doc(firebaseId).update({ status: novoStatus }).then(() => { 
            if (mensagemZap !== "" && pedido.telefoneCliente && pedido.telefoneCliente.length >= 10) window.open(`https://wa.me/55${pedido.telefoneCliente}?text=${encodeURIComponent(mensagemZap)}`, '_blank'); 
        }); 
    }
}

async function arquivarPedidoCancelado(firebaseId) {
    try { await db.collection("pedidos").doc(firebaseId).update({ arquivado: true }); } 
    catch (error) { console.error("Erro ao arquivar:", error); mostrarAlertaAdmin("Erro", "Falha ao remover pedido da fila.", "erro"); }
}

function atualizarGrafico(pedidosEntregues) {
    const ctx = document.getElementById('lucrosChart'); if (!ctx) return;
    const ultimos = pedidosEntregues.slice(-10); 
    if (meuGrafico) meuGrafico.destroy();
    meuGrafico = new Chart(ctx, { 
        type: 'line', 
        data: { labels: ultimos.length ? ultimos.map(p => `#${p.id}`) : ['Sem Vendas'], datasets: [{ label: 'Valor (R$)', data: ultimos.length ? ultimos.map(p => p.total) : [0], borderColor: '#4a148c', backgroundColor: 'rgba(124, 67, 189, 0.2)', fill: true, tension: 0.3 }] } 
    });
}

function recusarPedido(firebaseId) {
    mostrarConfirmAdmin("Recusar Pedido", "Tem certeza que deseja cancelar este pedido? O cliente verá no histórico que ele foi recusado pela loja.", (confirmado) => {
        if (confirmado) {
            db.collection("pedidos").doc(firebaseId).update({ 
                status: "Cancelado",
                pagamento: "❌ Cancelado (Pelo Lojista)"
            }).then(() => {
                mostrarAlertaAdmin("Pedido Recusado", "O pedido foi cancelado e retirado da fila.", "sucesso");
            }).catch((error) => {
                console.error("Erro ao recusar pedido:", error);
                mostrarAlertaAdmin("Erro", "Falha de conexão ao tentar recusar o pedido.", "erro");
            });
        }
    });
}

// 🚀 NOVA FUNÇÃO: Exportar Relatório de Vendas (Contabilidade)
function exportarRelatorioCSV() {
    const pedidosFinalizados = pedidosNuvem.filter(p => p.status === 'Entregue' || p.status === 'Finalizado');
    
    if (pedidosFinalizados.length === 0) {
        return mostrarAlertaAdmin("Aviso", "Não há pedidos finalizados para exportar.", "aviso");
    }

    let csvContent = "Data,Pedido,Cliente,Itens,Pagamento,Total\n";

    pedidosFinalizados.forEach(p => {
        let dataFormatada = p.data ? new Date(p.data).toLocaleDateString('pt-BR') : "N/A";
        let clienteLimpo = p.enderecoCliente ? p.enderecoCliente.replace(/,/g, " -").replace(/\n/g, " ") : "Balcão";
        let itensLimpos = p.itensResumo ? p.itensResumo.replace(/,/g, " +").replace(/\n/g, " ") : "";
        let pagLimpo = p.pagamento ? p.pagamento.replace(/,/g, " -") : "";
        let totalStr = p.total ? p.total.toFixed(2).replace('.', ',') : "0,00";

        csvContent += `${dataFormatada},#${p.id},${clienteLimpo},${itensLimpos},${pagLimpo},R$ ${totalStr}\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_Vendas_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}