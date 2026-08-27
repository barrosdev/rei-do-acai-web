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

// ================= ESTADO GLOBAL =================
const API_BASE_URL = "https://rei-do-acai-api.onrender.com/api";
let cardapioNuvem = [];
let configLoja = { endereco: "Aguardando...", raio: 0, taxa: 0, limiteGratis: 4 };
let carrinho = [];
let produtoSendoPersonalizado = null;
let indexEditando = null; 
let entregaPermitida = true;
let valorFreteAplicado = 0;
let clienteLat = null;
let clienteLon = null;
let debounceBusca = null;

// ================= MERCADO PAGO =================
const mp = new MercadoPago('TEST-56a1688a-5fb5-41c8-b914-776f573830ee', { locale: 'pt-BR' });
const bricksBuilder = mp.bricks();
let cardPaymentBrickController = null;

// ================= OLHEIROS DA NUVEM =================
db.collection("cardapio").onSnapshot((snapshot) => {
    cardapioNuvem = [];
    snapshot.forEach((doc) => {
        let item = doc.data(); item.id = doc.id; cardapioNuvem.push(item);
    });
    renderizarProdutos('Copo'); 
});

db.collection("config").doc("loja").onSnapshot((doc) => {
    if (doc.exists) configLoja = doc.data();
});

document.addEventListener("DOMContentLoaded", () => { renderizarProdutos('Copo'); });

// ================= MODAL & NAVEGAÇÃO =================
function mostrarAlerta(titulo, mensagem, tipo = 'aviso') {
    const overlay = document.getElementById('modal-alerta');
    const icon = document.getElementById('modal-icon');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-message').innerText = mensagem;
    if (tipo === 'sucesso') { icon.innerHTML = '<i class="fas fa-check-circle"></i>'; icon.className = 'modal-icon icon-sucesso'; } 
    else if (tipo === 'erro') { icon.innerHTML = '<i class="fas fa-times-circle"></i>'; icon.className = 'modal-icon icon-erro'; } 
    else { icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; icon.className = 'modal-icon icon-aviso'; }
    overlay.classList.remove('modal-oculto');
}

function fecharAlerta() { document.getElementById('modal-alerta').classList.add('modal-oculto'); }

function mostrarSecao(idSecao) {
    if(idSecao === 'inicio') indexEditando = null; 
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(idSecao).classList.remove('hidden');
    if (idSecao === 'carrinho') atualizarCarrinhoView();
}

function filtrarCategoria(categoria, elementoClicado) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    elementoClicado.classList.add('active');
    renderizarProdutos(categoria);
}

// ================= CATÁLOGO & PERSONALIZAÇÃO =================
function renderizarProdutos(categoria) {
    const grid = document.getElementById('product-list'); if(!grid) return;
    grid.innerHTML = '';
    const filtrados = cardapioNuvem.filter(p => p.categoria === categoria && p.disponivel === true);
    if(filtrados.length === 0) { grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">Nenhum produto disponível.</p>'; return; }
    
    filtrados.forEach(prod => {
        const imgHTML = prod.imagem ? `<img src="${prod.imagem}" alt="Produto" class="prod-img">` : `<div class="img-placeholder">${prod.categoria}</div>`;
        const div = document.createElement('div'); div.className = 'product-card';
        div.innerHTML = `${imgHTML}<h4>${prod.nome}</h4><p class="price">R$ ${prod.preco.toFixed(2).replace('.', ',')}</p><button class="btn-action" onclick="iniciarPersonalizacao('${prod.id}')">Adicionar</button>`;
        grid.appendChild(div);
    });
}

function limitarGratis(checkbox) {
    let marcados = document.querySelectorAll('.comp-gratis:checked');
    let limite = configLoja.limiteGratis || 4; 
    if (marcados.length > limite) {
        checkbox.checked = false;
        mostrarAlerta("Limite Atingido", `Você só pode escolher até ${limite} complementos grátis.`, "aviso");
    }
}

function iniciarPersonalizacao(idProduto) {
    produtoSendoPersonalizado = cardapioNuvem.find(p => p.id === idProduto);
    if (!produtoSendoPersonalizado) return;

    const imgContainer = document.getElementById('custom-img-container');
    if (produtoSendoPersonalizado.imagem) {
        imgContainer.innerHTML = `<img src="${produtoSendoPersonalizado.imagem}" style="width: 100%; height: 220px; object-fit: contain; background-color: #fbf8ff; border-radius: 12px;">`;
    } else {
        imgContainer.innerHTML = `<div style="width: 100%; height: 150px; background: #fbf8ff; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--purple-dark); font-weight: bold; font-size: 20px;">${produtoSendoPersonalizado.categoria}</div>`;
    }

    document.getElementById('custom-title').innerText = produtoSendoPersonalizado.nome;
    document.getElementById('custom-price').innerText = `R$ ${produtoSendoPersonalizado.preco.toFixed(2).replace('.', ',')}`;
    const divOpcoes = document.getElementById('opcoes-dinamicas'); 
    divOpcoes.innerHTML = ''; 
    
    if(document.getElementById('obs-produto')) document.getElementById('obs-produto').value = '';

    if(produtoSendoPersonalizado.caldas && produtoSendoPersonalizado.caldas.length > 0) {
        let htmlCaldas = `<div class="options-group"><h3 style="font-size:15px; margin-bottom:10px;">Calda Principal</h3>`;
        produtoSendoPersonalizado.caldas.forEach((c, index) => { htmlCaldas += `<label style="display:block; margin-bottom:8px;"><input type="radio" name="calda" value="${c}" ${index === 0 ? 'checked' : ''}> ${c}</label>`; });
        divOpcoes.innerHTML += htmlCaldas + `</div>`;
    }

    if(produtoSendoPersonalizado.complementosGratis && produtoSendoPersonalizado.complementosGratis.length > 0) {
        let limite = configLoja.limiteGratis || 4;
        let htmlGratis = `<div class="options-group"><h3 style="font-size:15px; margin-bottom:10px;">Complementos Grátis (Até ${limite})</h3>`;
        produtoSendoPersonalizado.complementosGratis.forEach((comp) => {
            htmlGratis += `<label style="display:block; margin-bottom:8px;"><input type="checkbox" class="comp-gratis" value="${comp}" onchange="limitarGratis(this)"> ${comp}</label>`;
        });
        divOpcoes.innerHTML += htmlGratis + `</div>`;
    }

    if(produtoSendoPersonalizado.complementos && produtoSendoPersonalizado.complementos.length > 0) {
        let htmlComps = `<div class="options-group" style="margin-top:15px;"><h3 style="font-size:15px; margin-bottom:10px;">Adicionais Extras</h3>`;
        produtoSendoPersonalizado.complementos.forEach((comp) => { htmlComps += `<label style="display:block; margin-bottom:8px;"><input type="checkbox" class="acompanhamento" value="${comp.nome}" data-preco="${comp.preco}"> ${comp.nome} (+R$ ${comp.preco.toFixed(2)})</label>`; });
        divOpcoes.innerHTML += htmlComps + `</div>`;
    }
    
    const btnAcao = document.getElementById('btn-adicionar-produto');
    btnAcao.innerHTML = indexEditando !== null ? "Atualizar Produto ➔" : "Adicionar ao Carrinho ➔";
    mostrarSecao('personalizar');
}

function adicionarAoCarrinho() {
    let precoFinal = produtoSendoPersonalizado.preco; let descricoes = [];
    
    const calda = document.querySelector('input[name="calda"]:checked'); if(calda) descricoes.push(`Calda: ${calda.value}`);
    document.querySelectorAll('.comp-gratis:checked').forEach(cb => { descricoes.push(cb.value); });
    document.querySelectorAll('.acompanhamento:checked').forEach(cb => { descricoes.push(cb.value); precoFinal += parseFloat(cb.dataset.preco); });

    const obsElement = document.getElementById('obs-produto');
    const obs = obsElement ? obsElement.value.trim() : "";
    if (obs !== "") {
        descricoes.push(`<br><b style="color:#d32f2f;">Obs:</b> <i>${obs}</i>`);
    }

    const novoItem = { 
        idProduto: produtoSendoPersonalizado.id, 
        nome: produtoSendoPersonalizado.nome, 
        detalhes: descricoes.length > 0 ? descricoes.join(' • ') : 'Sem adicionais', 
        preco: precoFinal 
    };

    if (indexEditando !== null) { carrinho[indexEditando] = novoItem; indexEditando = null; } 
    else { carrinho.push(novoItem); }
    
    document.getElementById('cart-count').innerText = carrinho.length;
    if(document.querySelector('input[name="metodo_pagamento"][value="entrega"]')) {
        document.querySelector('input[name="metodo_pagamento"][value="entrega"]').checked = true; togglePagamentoUI();
    }
    mostrarSecao('carrinho');
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    document.getElementById('cart-count').innerText = carrinho.length;
    if (carrinho.length === 0) {
        valorFreteAplicado = 0; entregaPermitida = true;
        if(document.getElementById('msg-frete')) document.getElementById('msg-frete').innerHTML = "";
        document.querySelector('input[name="tipo_entrega"][value="balcao"]').checked = true; toggleEntrega();
    }
    atualizarCarrinhoView();
}

function editarDoCarrinho(index) {
    const item = carrinho[index]; indexEditando = index;
    iniciarPersonalizacao(item.idProduto);
}

// ================= LÓGICA DE DELIVERY E ROTA =================
function toggleEntrega() {
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    const boxEntrega = document.getElementById('box-entrega'); const secaoPagamento = document.getElementById('secao-pagamento');
    if(tipo === 'entrega') {
        boxEntrega.classList.remove('hidden'); secaoPagamento.classList.add('hidden'); entregaPermitida = false; valorFreteAplicado = 0;
    } else {
        boxEntrega.classList.add('hidden'); secaoPagamento.classList.remove('hidden'); entregaPermitida = true; valorFreteAplicado = 0;
        document.getElementById('msg-frete').innerHTML = ""; clienteLat = null; clienteLon = null;
    }
    atualizarCarrinhoView();
}

function sugerirEnderecos() {
    clearTimeout(debounceBusca);
    const input = document.getElementById('endereco-cliente').value; const lista = document.getElementById('autocomplete-list');
    clienteLat = null; clienteLon = null; document.getElementById('msg-frete').innerHTML = ""; document.getElementById('secao-pagamento').classList.add('hidden');
    entregaPermitida = false; valorFreteAplicado = 0; atualizarCarrinhoView();

    const inputLimpo = input.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (inputLimpo.length < 3) { lista.innerHTML = ''; return; }
    debounceBusca = setTimeout(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/enderecos?q=${encodeURIComponent(inputLimpo)}`);
            const resultadosJF = await res.json(); lista.innerHTML = '';
            if (!resultadosJF || resultadosJF.length === 0) return;
            const ruasUnicas = new Set();
            resultadosJF.forEach(item => {
                const nomeExibicao = `${item.properties.name}, ${item.properties.district || item.properties.suburb || "JF"}`;
                if(!ruasUnicas.has(nomeExibicao)) {
                    ruasUnicas.add(nomeExibicao);
                    const div = document.createElement('div'); div.innerHTML = `📍 ${nomeExibicao}`;
                    div.onclick = function() {
                        document.getElementById('endereco-cliente').value = nomeExibicao;
                        clienteLat = item.geometry.coordinates[1]; clienteLon = item.geometry.coordinates[0]; lista.innerHTML = ''; 
                    };
                    lista.appendChild(div);
                }
            });
        } catch(e) {}
    }, 500); 
}

async function calcularFreteReal() {
    const msgBox = document.getElementById('msg-frete'); 
    const secaoPagamento = document.getElementById('secao-pagamento');
    if (!clienteLat || !clienteLon) { return mostrarAlerta("Endereço Inválido", "Selecione seu endereço na lista suspensa.", "aviso"); }

    msgBox.innerHTML = "<span style='color: #777;'><i class='fas fa-spinner fa-spin'></i> Traçando rota segura...</span>";
    secaoPagamento.classList.add('hidden'); entregaPermitida = false; 

    try {
        const res = await fetch(`${API_BASE_URL}/frete`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                clienteLat, 
                clienteLon, 
                lojaEndereco: configLoja.endereco, 
                lojaRaio: configLoja.raio, 
                lojaTaxa: configLoja.taxa 
            })
        });
        const resposta = await res.json();
        if (resposta.sucesso) {
            entregaPermitida = true; valorFreteAplicado = parseFloat(resposta.taxaAplicada);
            msgBox.innerHTML = `<span style="color: #4caf50;">✓ Rota validada: ${resposta.distancia}km da loja.<br>Entrega liberada! (Taxa: R$ ${valorFreteAplicado.toFixed(2).replace('.',',')})</span>`;
            secaoPagamento.classList.remove('hidden'); 
        } else {
            entregaPermitida = false; valorFreteAplicado = 0;
            msgBox.innerHTML = `<span style="color: #f44336;">❌ ${resposta.msg}</span>`;
        }
        atualizarCarrinhoView();
    } catch (erro) { msgBox.innerHTML = `<span style="color: #f44336;">❌ Servidor indisponível no momento.</span>`; }
}

function atualizarCarrinhoView() {
    const lista = document.getElementById('cart-items'); const conteinerAcoes = document.getElementById('checkout-actions'); 
    lista.innerHTML = ''; let subtotal = 0;

    if (carrinho.length === 0) {
        lista.innerHTML = '<div style="text-align:center; padding: 20px; color: #aaa;"><i class="fas fa-shopping-basket" style="font-size: 30px; margin-bottom: 10px;"></i><br>Seu carrinho está vazio.</div>';
        conteinerAcoes.classList.add('hidden'); return;
    }
    
    conteinerAcoes.classList.remove('hidden');
    carrinho.forEach((item, index) => {
        subtotal += item.preco;
        lista.innerHTML += `
            <div class="cart-item-modern">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.nome}</div>
                    <div class="cart-item-desc">${item.detalhes}</div>
                </div>
                <div class="cart-item-actions">
                    <div class="cart-item-price">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
                    <div class="action-btns">
                        <button onclick="editarDoCarrinho(${index})" class="btn-icon btn-edit"><i class="fas fa-pen"></i></button>
                        <button onclick="removerDoCarrinho(${index})" class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
    
    let totalGeral = subtotal;
    if(valorFreteAplicado > 0 && entregaPermitida) {
        lista.innerHTML += `
            <div class="tax-item-modern">
                <div><i class="fas fa-motorcycle"></i> Taxa de Entrega</div>
                <div style="font-weight:bold;">R$ ${valorFreteAplicado.toFixed(2).replace('.', ',')}</div>
            </div>`;
        totalGeral += valorFreteAplicado;
    }
    document.getElementById('cart-total').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

// ================= LÓGICA DO TROCO =================
function toggleTroco() {
    const subPgto = document.querySelector('input[name="sub_pagamento_entrega"]:checked').value;
    const boxTroco = document.getElementById('box-troco');
    if(subPgto === 'Dinheiro') { boxTroco.classList.remove('hidden'); } 
    else { boxTroco.classList.add('hidden'); document.getElementById('valor-troco').value = ""; }
}

// ================= MERCADO PAGO E PIX =================
async function montarBrickCartao() {
    if (window.cardPaymentBrickController) window.cardPaymentBrickController.unmount();
    const totalPagamento = carrinho.reduce((acc, item) => acc + item.preco, 0) + valorFreteAplicado;
    const settings = {
        initialization: { amount: totalPagamento },
        customization: { visual: { style: { theme: 'default', customVariables: { baseColor: '#512da8' } } }, paymentMethods: { maxInstallments: 1 } },
        callbacks: {
            onReady: () => { console.log("Formulário de cartão pronto!"); },
            onSubmit: (formData) => {
                return new Promise(async (resolve, reject) => {
                    const payload = {
                        transaction_amount: totalPagamento, token: formData.token, description: `Pedido Rei do Açaí - ${carrinho.length} itens`,
                        installments: formData.installments, payment_method_id: formData.payment_method_id, issuer_id: formData.issuer_id,
                        payer: { email: formData.payer ? formData.payer.email : "comprador@email.com", first_name: "Cliente", last_name: "Cartão", identification: formData.payer && formData.payer.identification ? formData.payer.identification : { type: "CPF", number: "" } }
                    };
                    try {
                        const res = await fetch(`${API_BASE_URL}/pagamento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        const resposta = await res.json();
                        if (resposta.sucesso && (resposta.status === 'approved' || resposta.status === 'in_process')) {
                            mostrarAlerta("Pagamento Aprovado!", "Uhuuul! Seu pedido foi confirmado.", "sucesso");
                            salvarPedidoNoBanco("💳 Cartão Online (Aprovado)"); resolve(); 
                        } else { mostrarAlerta("Pagamento Recusado", "Seu cartão foi recusado pelo banco.", "erro"); reject(); }
                    } catch (e) { mostrarAlerta("Erro de Conexão", "Falha de conexão com o banco.", "erro"); reject(); }
                });
            },
            onError: (error) => { console.error("Erro no Brick:", error); }
        }
    };
    window.cardPaymentBrickController = await bricksBuilder.create("cardPayment", "cardPaymentBrick_container", settings);
}

function togglePagamentoUI() {
    const metodo = document.querySelector('input[name="metodo_pagamento"]:checked').value;
    const formPix = document.getElementById('form-pix-container'); const formCartao = document.getElementById('form-cartao-container'); 
    const formNaEntrega = document.getElementById('form-na-entrega-container'); const btnFinalizar = document.getElementById('btn-finalizar-pedido');
    
    if (metodo === 'online') { 
        formPix.classList.add('hidden'); formCartao.classList.remove('hidden'); formNaEntrega.classList.add('hidden'); btnFinalizar.classList.add('hidden'); montarBrickCartao(); 
    } else if (metodo === 'pix') { 
        formPix.classList.remove('hidden'); formCartao.classList.add('hidden'); formNaEntrega.classList.add('hidden'); btnFinalizar.classList.remove('hidden'); 
    } else { 
        formPix.classList.add('hidden'); formCartao.classList.add('hidden'); formNaEntrega.classList.remove('hidden'); btnFinalizar.classList.remove('hidden'); 
    }
}

function finalizarPedido() {
    if (carrinho.length === 0) { return mostrarAlerta("Carrinho Vazio", "Adicione produtos ao carrinho!", "aviso"); }
    const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked').value;
    if (tipoEntrega === 'entrega' && !entregaPermitida) { return mostrarAlerta("Rota Pendente", "Calcule a rota de entrega primeiro.", "aviso"); }

    const metodoPgto = document.querySelector('input[name="metodo_pagamento"]:checked').value;
    const btn = document.getElementById('btn-finalizar-pedido');
    
    if (metodoPgto === 'pix') {
        const email = document.getElementById('pix-email').value; const nome = document.getElementById('pix-nome').value; const cpf = document.getElementById('pix-cpf').value;
        if (!email || !nome || !cpf) { return mostrarAlerta("Dados Incompletos", "Preencha E-mail, Nome e CPF para o PIX.", "aviso"); }
        if(btn) { btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Gerando PIX..."; btn.disabled = true; }
        processarPagamentoPix(email, nome, cpf);
    } else if (metodoPgto === 'entrega') {
        const subPgto = document.querySelector('input[name="sub_pagamento_entrega"]:checked').value;
        let msgPagamento = "💵 Na Entrega";
        
        if (subPgto === 'Debito') msgPagamento = "💳 Na Entrega (Débito)";
        if (subPgto === 'Credito') msgPagamento = "💳 Na Entrega (Crédito)";
        if (subPgto === 'Dinheiro') {
            const troco = document.getElementById('valor-troco').value.trim();
            msgPagamento = troco !== "" ? `💵 Dinheiro (Troco para R$ ${troco})` : `💵 Dinheiro (Sem troco)`;
        }

        mostrarAlerta("Pedido Confirmado!", "Seu pedido está sendo preparado e será pago na entrega.", "sucesso");
        salvarPedidoNoBanco(msgPagamento);
    }
}

async function processarPagamentoPix(emailCliente, nomeCliente, cpfCliente) {
    const totalPagamento = carrinho.reduce((acc, item) => acc + item.preco, 0) + valorFreteAplicado;
    const partesNome = nomeCliente.trim().split(" "); const primeiroNome = partesNome[0]; const sobrenome = partesNome.length > 1 ? partesNome.slice(1).join(" ") : "Cliente"; 
    const payload = {
        transaction_amount: totalPagamento, description: `Pedido Rei do Açaí - ${carrinho.length} itens`, payment_method_id: 'pix',
        payer: { email: emailCliente, first_name: primeiroNome, last_name: sobrenome, identification: { type: "CPF", number: cpfCliente.replace(/\D/g, '') } }
    };
    try {
        const res = await fetch(`${API_BASE_URL}/pagamento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const resposta = await res.json();
        if (resposta.qr_code) { iniciarTelaPix(resposta.qr_code); } 
        else { mostrarAlerta("Erro no PIX", "Banco recusou os dados.", "erro"); resetarBotaoFinalizar(); }
    } catch (e) { mostrarAlerta("Erro de Conexão", "Falha de comunicação. Tente novamente.", "erro"); resetarBotaoFinalizar(); }
}

let pixCronometro;
function iniciarTelaPix(codigoPix) {
    document.getElementById('carrinho').classList.add('hidden'); document.getElementById('tela-pix').classList.remove('hidden');
    document.getElementById('input-pix').value = codigoPix;
    let tempoRestante = 600; const visor = document.getElementById('pix-timer'); clearInterval(pixCronometro);
    pixCronometro = setInterval(() => {
        tempoRestante--;
        visor.innerText = `${Math.floor(tempoRestante / 60).toString().padStart(2, '0')}:${(tempoRestante % 60).toString().padStart(2, '0')}`;
        if (tempoRestante <= 0) {
            clearInterval(pixCronometro); visor.innerText = "EXPIRADO"; document.getElementById('input-pix').value = "Tempo expirado.";
            mostrarAlerta("Tempo Esgotado", "O tempo do PIX expirou.", "erro");
        }
    }, 1000);
}

function copiarPix() {
    const inputPix = document.getElementById('input-pix'); inputPix.select(); inputPix.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(inputPix.value).then(() => mostrarAlerta("Copiado!", "Abra seu banco e use 'PIX Copia e Cola'.", "sucesso")).catch(err => mostrarAlerta("Ops!", "Erro ao copiar.", "erro"));
}

function aprovarPixTeste() {
    clearInterval(pixCronometro);
    mostrarAlerta("Pagamento Confirmado!", "PIX recebido com sucesso!", "sucesso");
    salvarPedidoNoBanco("💠 PIX (Aprovado)"); 
}

function salvarPedidoNoBanco(statusPagamento) {
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    const rua = document.getElementById('endereco-cliente') ? document.getElementById('endereco-cliente').value : "";
    const numero = document.getElementById('numero-cliente') ? document.getElementById('numero-cliente').value : "";
    const zapInput = document.getElementById('whatsapp-cliente');
    const telefoneFinal = (zapInput && zapInput.value.trim() !== "") ? zapInput.value.trim() : "Não informado";

    const total = carrinho.reduce((acc, item) => acc + item.preco, 0) + valorFreteAplicado;
    const enderecoCompleto = tipo === 'entrega' ? `${rua}, N°/Comp: ${numero}` : "Retirada no Local";
    
    const novoPedido = {
        id: Math.floor(Math.random() * 9000) + 1000, mesa: tipo === 'balcao' ? "Balcão" : "Delivery",
        enderecoCliente: enderecoCompleto, telefoneCliente: telefoneFinal, tipoEntrega: tipo,
        itensResumo: carrinho.map(i => i.nome).join(' + '), itens: carrinho, total: total, status: "Em Preparo", pagamento: statusPagamento, data: new Date().toISOString()
    };

    db.collection("pedidos").add(novoPedido).then(() => {
        carrinho = []; valorFreteAplicado = 0; entregaPermitida = true; resetarBotaoFinalizar();
        if(document.getElementById('endereco-cliente')) document.getElementById('endereco-cliente').value = "";
        if(document.getElementById('numero-cliente')) document.getElementById('numero-cliente').value = "";
        if(document.getElementById('whatsapp-cliente')) document.getElementById('whatsapp-cliente').value = "";
        if(document.getElementById('valor-troco')) document.getElementById('valor-troco').value = "";
        if(document.getElementById('msg-frete')) document.getElementById('msg-frete').innerHTML = "";
        if(document.querySelector('input[name="tipo_entrega"][value="balcao"]')) { document.querySelector('input[name="tipo_entrega"][value="balcao"]').checked = true; toggleEntrega(); }
        if(document.querySelector('input[name="metodo_pagamento"][value="entrega"]')) { document.querySelector('input[name="metodo_pagamento"][value="entrega"]').checked = true; togglePagamentoUI(); }
        
        document.getElementById('cart-count').innerText = '0';
        document.getElementById('tela-pix').classList.add('hidden');
        mostrarSecao('inicio'); 
    }).catch(err => {
        console.error(err); mostrarAlerta("Erro de Conexão", "Não foi possível enviar o pedido.", "erro"); resetarBotaoFinalizar();
    });
}

function resetarBotaoFinalizar() {
    const btn = document.getElementById('btn-finalizar-pedido');
    if(btn) { btn.innerHTML = "Confirmar Pedido ➔"; btn.disabled = false; }
}