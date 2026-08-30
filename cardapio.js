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

const mp = new MercadoPago('TEST-56a1688a-5fb5-41c8-b914-776f573830ee', { locale: 'pt-BR' });
const bricksBuilder = mp.bricks();
let cardPaymentBrickController = null;

db.collection("cardapio").onSnapshot((snapshot) => {
    cardapioNuvem = [];
    snapshot.forEach((doc) => { let item = doc.data(); item.id = doc.id; cardapioNuvem.push(item); });
    renderizarProdutos('Copo'); 
});

db.collection("config").doc("loja").onSnapshot((doc) => {
    if (doc.exists) configLoja = doc.data(); 
});

document.addEventListener("DOMContentLoaded", () => { renderizarProdutos('Copo'); });

function mostrarAlerta(titulo, mensagem, tipo = 'aviso') {
    const overlay = document.getElementById('modal-alerta');
    const icon = document.getElementById('modal-icon');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-message').innerText = mensagem;
    
    if (tipo === 'sucesso') { icon.innerHTML = '<i class="fas fa-check-circle"></i>'; icon.style.color = '#4caf50'; } 
    else if (tipo === 'erro') { icon.innerHTML = '<i class="fas fa-times-circle"></i>'; icon.style.color = '#f44336'; } 
    else { icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; icon.style.color = '#ff9800'; }
    
    overlay.classList.remove('modal-oculto'); 
}

function fecharAlerta() { document.getElementById('modal-alerta').classList.add('modal-oculto'); }

function mostrarSecao(idSecao) {
    if(idSecao === 'inicio') indexEditando = null; 
    document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active');
        sec.classList.add('hidden');
    });
    const alvo = document.getElementById(idSecao);
    alvo.classList.remove('hidden');
    alvo.classList.add('active');
    
    if (idSecao === 'carrinho') atualizarCarrinhoView(); 
}

function filtrarCategoria(categoria, elementoClicado) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    elementoClicado.classList.add('active'); renderizarProdutos(categoria); 
}

// ========= LÓGICA DE HISTÓRICO CORRIGIDA E BLINDADA =========
function salvarNoHistorico(firebaseDocId) {
    let historico = JSON.parse(localStorage.getItem('historicoPedidos')) || [];
    // Limpa lixo de testes antigos
    historico = historico.filter(id => typeof id === 'string' && id.length > 10);
    
    if (!historico.includes(firebaseDocId)) {
        historico.unshift(firebaseDocId); 
        if (historico.length > 10) historico.pop(); 
        localStorage.setItem('historicoPedidos', JSON.stringify(historico));
    }
}

function exibirTelaSucesso(numeroComanda) {
    carrinho = []; valorFreteAplicado = 0; entregaPermitida = true; resetarBotaoFinalizar();
    if(document.getElementById('endereco-cliente')) document.getElementById('endereco-cliente').value = "";
    if(document.getElementById('numero-cliente')) document.getElementById('numero-cliente').value = "";
    if(document.getElementById('valor-troco')) document.getElementById('valor-troco').value = "";
    if(document.getElementById('msg-frete')) document.getElementById('msg-frete').innerHTML = "";
    if(document.querySelector('input[name="tipo_entrega"][value="balcao"]')) { document.querySelector('input[name="tipo_entrega"][value="balcao"]').checked = true; toggleEntrega(); }
    if(document.querySelector('input[name="metodo_pagamento"][value="entrega"]')) { document.querySelector('input[name="metodo_pagamento"][value="entrega"]').checked = true; togglePagamentoUI(); }
    document.getElementById('cart-count').innerText = '0'; document.getElementById('tela-pix').classList.add('hidden'); 

    document.getElementById('sucesso-id-pedido').innerText = `#${numeroComanda}`;
    mostrarSecao('sucesso');
}

async function carregarMeusPedidos() {
    const container = document.getElementById('lista-meus-pedidos');
    let historico = JSON.parse(localStorage.getItem('historicoPedidos')) || [];
    historico = historico.filter(id => typeof id === 'string' && id.length > 10);

    if (historico.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: #888; background: white; border-radius: 12px;"><i class="fas fa-ghost" style="font-size:40px; margin-bottom:15px; color: #ccc;"></i><br>Você ainda não fez nenhum pedido neste aparelho.</div>';
        return;
    }

    container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--purple-dark);"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Buscando atualizações na cozinha...</div>';

    try {
        let pedidosEncontrados = [];
        // Busca direta pelo ID real no Firebase (Extremamente rápido e imune a erros)
        for (let docId of historico) {
            const docSnap = await db.collection("pedidos").doc(docId).get();
            if (docSnap.exists) {
                let p = docSnap.data();
                p.firebaseId = docSnap.id;
                pedidosEncontrados.push(p);
            }
        }

        if (pedidosEncontrados.length > 0) {
            container.innerHTML = '';
            pedidosEncontrados.forEach(pedido => {
                let corStatus = "#856404"; let bgStatus = "#fff3cd"; 
                if (pedido.status === "Saiu para Entrega") { corStatus = "#004085"; bgStatus = "#cce5ff"; } 
                if (pedido.status === "Finalizado" || pedido.status === "Entregue") { corStatus = "#155724"; bgStatus = "#d4edda"; } 
                if (pedido.status === "Cancelado") { corStatus = "#721c24"; bgStatus = "#f8d7da"; } 

                const dataFormatada = new Date(pedido.data).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                let btnCancelarHTML = "";
                if (pedido.status === "Em Preparo" || (pedido.status && pedido.status.includes("Aguardando"))) {
                    btnCancelarHTML = `
                        <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                            <button onclick="cancelarDoHistorico('${pedido.firebaseId}')" style="width: 100%; padding: 10px; border: 1px solid #dc3545; color: #dc3545; background: white; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i class="fas fa-times-circle"></i> Cancelar Pedido
                            </button>
                        </div>
                    `;
                }

                container.innerHTML += `
                    <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 12px; border-left: 5px solid ${corStatus}; border: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #eee; padding-bottom: 12px;">
                            <strong style="font-size: 18px; color: #333;">Pedido #${pedido.id}</strong>
                            <span style="font-size: 13px; color: #888;">${dataFormatada}</span>
                        </div>
                        <div style="color: #666; font-size: 14px; line-height: 1.6;">
                            <span style="display: block; margin-bottom: 5px;">${pedido.itensResumo}</span>
                            <strong style="color: #333;">Total: R$ ${pedido.total.toFixed(2).replace('.', ',')}</strong> <br>
                            <span style="font-size: 13px;">Pagamento: ${pedido.pagamento}</span>
                        </div>
                        <div style="margin-top: 5px;">
                            <span style="background: ${bgStatus}; color: ${corStatus}; padding: 8px 15px; border-radius: 30px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
                                <i class="fas fa-clock"></i> ${pedido.status || 'Em Preparo'}
                            </span>
                        </div>
                        ${btnCancelarHTML}
                    </div>
                `;
            });
        } else { container.innerHTML = '<div style="text-align:center; padding: 40px; color: #888;">Não encontramos o histórico.</div>'; }
    } catch (e) { container.innerHTML = '<div style="text-align:center; padding: 40px; color: #f44336;">Erro de conexão com o servidor de dados.</div>'; }
}

function cancelarDoHistorico(firebaseDocId) {
    mostrarConfirmCliente("Cancelar Pedido", `Tem certeza que deseja cancelar este pedido?`, async (confirmado) => {
        if (!confirmado) return; 
        mostrarAlerta("Cancelando...", "Avisando a cozinha, aguarde...", "aviso");

        try {
            const docSnap = await db.collection("pedidos").doc(firebaseDocId).get();
            if (docSnap.exists) {
                let dados = docSnap.data();
                if (dados.status === "Em Preparo" || (dados.status && dados.status.includes("Aguardando"))) {
                    await db.collection("pedidos").doc(firebaseDocId).update({ status: "Cancelado", pagamento: "❌ Cancelado (Pelo Cliente)" });
                    fecharAlerta();
                    mostrarAlerta("Cancelado!", "O pedido foi cancelado com sucesso.", "sucesso");
                    carregarMeusPedidos(); 
                } else {
                    fecharAlerta();
                    mostrarAlerta("Aviso", "Não foi possível cancelar. A cozinha já despachou o pedido.", "aviso");
                }
            } else {
                fecharAlerta();
                mostrarAlerta("Erro", "Pedido não encontrado no banco.", "erro");
            }
        } catch (e) {
            fecharAlerta();
            mostrarAlerta("Erro de Conexão", "Falha ao tentar cancelar. Verifique sua internet.", "erro");
        }
    });
}
// =============================================================

function mostrarConfirmCliente(titulo, msg, callback) {
    const overlay = document.createElement('div');
    overlay.id = "modal-confirm-cliente";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(3px);";
    
    const box = document.createElement('div');
    box.style.cssText = "background:white; padding:25px; border-radius:16px; width:90%; max-width:350px; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s ease-out;";
    
    box.innerHTML = `
        <style>
            @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        </style>
        <i class="fas fa-exclamation-triangle" style="font-size: 45px; color: #dc3545; margin-bottom: 15px;"></i>
        <h3 style="color: #333; margin-bottom: 10px; font-size: 20px;">${titulo}</h3>
        <p style="color: #666; margin-bottom: 25px; font-size: 15px; line-height: 1.5;">${msg}</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="btn-voltar-modal" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: #e2e8f0; color: #4a5568; font-weight: bold; cursor: pointer; font-size: 14px; transition: 0.2s;">Não, Voltar</button>
            <button id="btn-sim-modal" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: #dc3545; color: white; font-weight: bold; cursor: pointer; font-size: 14px; transition: 0.2s;">Sim, Cancelar</button>
        </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    document.getElementById('btn-voltar-modal').onclick = () => { document.body.removeChild(overlay); callback(false); };
    document.getElementById('btn-sim-modal').onclick = () => { document.body.removeChild(overlay); callback(true); };
}


function renderizarProdutos(categoria) {
    const grid = document.getElementById('product-list'); if(!grid) return;
    grid.innerHTML = '';
    const filtrados = cardapioNuvem.filter(p => p.categoria === categoria && p.disponivel === true);
    if(filtrados.length === 0) { grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">Nenhum produto disponível.</p>'; return; }
    
    filtrados.forEach(prod => {
        const imgHTML = prod.imagem 
            ? `<img src="${prod.imagem}" alt="Produto" style="width: 100%; height: 200px; object-fit: cover; display: block;">` 
            : `<div style="width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; background: #eee; font-weight: bold; color: #888;">${prod.categoria}</div>`;
        
        const div = document.createElement('div'); 
        div.className = 'product-card';
        div.style.padding = '0';
        div.style.overflow = 'hidden';

        div.innerHTML = `
            ${imgHTML}
            <div style="padding: 15px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: var(--purple-dark); font-size: 18px;">${prod.nome}</h4>
                <p style="margin: 0 0 15px 0; color: var(--green-primary); font-weight: bold; font-size: 18px;">R$ ${prod.preco.toFixed(2).replace('.', ',')}</p>
                <button class="btn-action" style="width: 100%; padding: 12px; font-size: 16px;" onclick="iniciarPersonalizacao('${prod.id}')">Adicionar</button>
            </div>
        `;
        grid.appendChild(div);
    }); 
}

function limitarGratis(checkbox) {
    let marcados = document.querySelectorAll('.comp-gratis:checked'); let limite = configLoja.limiteGratis || 4; 
    if (marcados.length > limite) { checkbox.checked = false; mostrarAlerta("Limite Atingido", `Você pode escolher até ${limite} complementos grátis.`, "aviso"); } 
}

function iniciarPersonalizacao(idProduto) {
    produtoSendoPersonalizado = cardapioNuvem.find(p => p.id === idProduto);
    if (!produtoSendoPersonalizado) return;
    const imgContainer = document.getElementById('custom-img-container');
    if (produtoSendoPersonalizado.imagem) { imgContainer.innerHTML = `<img src="${produtoSendoPersonalizado.imagem}" style="width: 100%; height: 220px; object-fit: contain; background-color: #fbf8ff; border-radius: 12px;">`; } 
    else { imgContainer.innerHTML = `<div style="width: 100%; height: 150px; background: #fbf8ff; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--purple-dark); font-weight: bold; font-size: 20px;">${produtoSendoPersonalizado.categoria}</div>`; }
    
    document.getElementById('custom-title').innerText = produtoSendoPersonalizado.nome;
    document.getElementById('custom-price').innerText = `R$ ${produtoSendoPersonalizado.preco.toFixed(2).replace('.', ',')}`;
    const divOpcoes = document.getElementById('opcoes-dinamicas'); divOpcoes.innerHTML = ''; 
    if(document.getElementById('obs-produto')) document.getElementById('obs-produto').value = '';
    
    if(produtoSendoPersonalizado.caldas && produtoSendoPersonalizado.caldas.length > 0) {
        let htmlCaldas = `<div style="margin-bottom: 15px;"><h3 style="font-size:15px; margin-bottom:10px; color: var(--purple-dark);">Calda Principal</h3>`;
        produtoSendoPersonalizado.caldas.forEach((c, index) => { htmlCaldas += `<label style="display:block; margin-bottom:8px; color: #555;"><input type="radio" name="calda" value="${c}" ${index === 0 ? 'checked' : ''}> ${c}</label>`; });
        divOpcoes.innerHTML += htmlCaldas + `</div>`;
    }
    
    if(produtoSendoPersonalizado.complementosGratis && produtoSendoPersonalizado.complementosGratis.length > 0) {
        let limite = configLoja.limiteGratis || 4;
        let htmlGratis = `<div style="margin-bottom: 15px;"><h3 style="font-size:15px; margin-bottom:10px; color: var(--purple-dark);">Complementos Grátis (Até ${limite})</h3>`;
        produtoSendoPersonalizado.complementosGratis.forEach((comp) => { 
            const esgotado = comp.toUpperCase().includes("(FALTA)");
            const statusInput = esgotado ? 'disabled' : '';
            const estiloTexto = esgotado ? 'color: #aaa; text-decoration: line-through;' : 'color: #555;';
            htmlGratis += `<label style="display:block; margin-bottom:8px; ${estiloTexto}"><input type="checkbox" class="comp-gratis" value="${comp}" onchange="limitarGratis(this)" ${statusInput}> ${comp}</label>`; 
        });
        divOpcoes.innerHTML += htmlGratis + `</div>`;
    }
    
    if(produtoSendoPersonalizado.complementos && produtoSendoPersonalizado.complementos.length > 0) {
        let htmlComps = `<div style="margin-top:15px;"><h3 style="font-size:15px; margin-bottom:10px; color: var(--purple-dark);">Adicionais Extras</h3>`;
        produtoSendoPersonalizado.complementos.forEach((comp) => { 
            const esgotado = comp.nome.toUpperCase().includes("(FALTA)");
            const statusInput = esgotado ? 'disabled' : '';
            const estiloTexto = esgotado ? 'color: #aaa; text-decoration: line-through;' : 'color: #555;';
            htmlComps += `<label style="display:block; margin-bottom:8px; ${estiloTexto}"><input type="checkbox" class="acompanhamento" value="${comp.nome}" data-preco="${comp.preco}" ${statusInput}> ${comp.nome} (+R$ ${comp.preco.toFixed(2)})</label>`; 
        });
        divOpcoes.innerHTML += htmlComps + `</div>`;
    }
    
    const btnAcao = document.getElementById('btn-adicionar-produto');
    btnAcao.innerHTML = indexEditando !== null ? "Atualizar Produto 📝" : "Adicionar ao Carrinho ➔"; 
    mostrarSecao('personalizar'); 
}

function adicionarAoCarrinho() {
    let precoFinal = produtoSendoPersonalizado.preco; let descricoes = [];
    const calda = document.querySelector('input[name="calda"]:checked'); if(calda) descricoes.push(`Calda: ${calda.value}`);
    document.querySelectorAll('.comp-gratis:checked').forEach(cb => { descricoes.push(cb.value); });
    document.querySelectorAll('.acompanhamento:checked').forEach(cb => { descricoes.push(cb.value); precoFinal += parseFloat(cb.dataset.preco); });
    
    const obsElement = document.getElementById('obs-produto'); const obs = obsElement ? obsElement.value.trim() : "";
    if (obs !== "") descricoes.push(`<br><b style="color:#d32f2f;">Obs:</b> <i>${obs}</i>`);
    
    const novoItem = { idProduto: produtoSendoPersonalizado.id, nome: produtoSendoPersonalizado.nome, detalhes: descricoes.length > 0 ? descricoes.join(' • ') : 'Sem adicionais', preco: precoFinal };
    if (indexEditando !== null) { carrinho[indexEditando] = novoItem; indexEditando = null; } else { carrinho.push(novoItem); }
    
    document.getElementById('cart-count').innerText = carrinho.length;
    if(document.querySelector('input[name="metodo_pagamento"][value="entrega"]')) { document.querySelector('input[name="metodo_pagamento"][value="entrega"]').checked = true; togglePagamentoUI(); }
    mostrarSecao('carrinho'); 
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1); document.getElementById('cart-count').innerText = carrinho.length;
    if (carrinho.length === 0) {
        valorFreteAplicado = 0; entregaPermitida = true;
        if(document.getElementById('msg-frete')) document.getElementById('msg-frete').innerHTML = "";
        document.querySelector('input[name="tipo_entrega"][value="balcao"]').checked = true; toggleEntrega();
    }
    atualizarCarrinhoView(); 
}

function editarDoCarrinho(index) {
    const item = carrinho[index]; indexEditando = index; iniciarPersonalizacao(item.idProduto); 
}

function toggleEntrega() {
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    const boxEntrega = document.getElementById('box-entrega'); 
    
    if(tipo === 'entrega') { boxEntrega.classList.remove('hidden'); entregaPermitida = false; valorFreteAplicado = 0; } 
    else { boxEntrega.classList.add('hidden'); entregaPermitida = true; valorFreteAplicado = 0; document.getElementById('msg-frete').innerHTML = ""; clienteLat = null; clienteLon = null; }
    atualizarCarrinhoView(); 
}

function sugerirEnderecos() {
    clearTimeout(debounceBusca);
    const input = document.getElementById('endereco-cliente').value; const lista = document.getElementById('autocomplete-list');
    clienteLat = null; clienteLon = null; document.getElementById('msg-frete').innerHTML = "";
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
                    div.style.padding = "10px"; div.style.cursor = "pointer"; div.style.borderBottom = "1px solid #eee";
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
    if (!clienteLat || !clienteLon) { return mostrarAlerta("Endereço Inválido", "Selecione seu endereço na lista suspensa.", "aviso"); }
    msgBox.innerHTML = "<span style='color: #888;'><i class='fas fa-spinner fa-spin'></i> Traçando rota...</span>";
    entregaPermitida = false; 
    
    try {
        const res = await fetch(`${API_BASE_URL}/frete`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ clienteLat, clienteLon, lojaEndereco: configLoja.endereco, lojaRaio: configLoja.raio, lojaTaxa: configLoja.taxa })
        });
        const resposta = await res.json();
        if (resposta.sucesso) {
            entregaPermitida = true; valorFreteAplicado = parseFloat(resposta.taxaAplicada);
            msgBox.innerHTML = `<span style="color: #4caf50;">✅ Rota validada! (Taxa: R$ ${valorFreteAplicado.toFixed(2).replace('.',',')})</span>`;
        } else {
            entregaPermitida = false; valorFreteAplicado = 0; msgBox.innerHTML = `<span style="color: #f44336;">🚫 ${resposta.msg}</span>`;
        }
        atualizarCarrinhoView();
    } catch (erro) { msgBox.innerHTML = `<span style="color: #f44336;">🚫 Servidor indisponível.</span>`; } 
}

function atualizarCarrinhoView() {
    const lista = document.getElementById('cart-items'); 
    lista.innerHTML = ''; let subtotal = 0;
    
    if (carrinho.length === 0) {
        lista.innerHTML = '<div style="text-align:center; padding: 20px; color: #aaa;">Seu carrinho está vazio.</div>';
        document.getElementById('cart-total').innerText = "R$ 0,00";
        return;
    }
    
    carrinho.forEach((item, index) => {
        subtotal += item.preco;
        lista.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 10px 0;">
                <div>
                    <strong style="display: block; color: #333; font-size: 15px;">${item.nome}</strong>
                    <span style="font-size: 12px; color: #888;">${item.detalhes}</span>
                </div>
                <div style="text-align: right;">
                    <strong style="color: var(--purple-dark); display: block;">R$ ${item.preco.toFixed(2).replace('.', ',')}</strong>
                    <div style="margin-top: 5px;">
                        <button type="button" onclick="editarDoCarrinho(${index})" style="background:none; border:none; color: var(--purple-dark); cursor:pointer; margin-right: 10px;"><i class="fas fa-pen"></i></button>
                        <button type="button" onclick="removerDoCarrinho(${index})" style="background:none; border:none; color: #f44336; cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
    
    let totalGeral = subtotal;
    if(valorFreteAplicado > 0 && entregaPermitida) {
        lista.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0;">
                <strong style="color: #333; font-size: 15px;"><i class="fas fa-motorcycle"></i> Taxa de Entrega</strong>
                <strong style="color: var(--purple-dark);">R$ ${valorFreteAplicado.toFixed(2).replace('.', ',')}</strong>
            </div>`;
        totalGeral += valorFreteAplicado;
    }
    document.getElementById('cart-total').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`; 
}

function toggleTroco() {
    const subPgto = document.querySelector('input[name="sub_pagamento_entrega"]:checked').value;
    const boxTroco = document.getElementById('box-troco');
    if(subPgto === 'Dinheiro') { boxTroco.classList.remove('hidden'); } else { boxTroco.classList.add('hidden'); document.getElementById('valor-troco').value = ""; } 
}

function montarDadosPedido() {
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    const rua = document.getElementById('endereco-cliente') ? document.getElementById('endereco-cliente').value : "";
    const numero = document.getElementById('numero-cliente') ? document.getElementById('numero-cliente').value : "";
    const zapInput = document.getElementById('whatsapp-cliente'); const telefoneFinal = (zapInput && zapInput.value.trim() !== "") ? zapInput.value.trim() : "Não informado";
    const total = carrinho.reduce((acc, item) => acc + item.preco, 0) + valorFreteAplicado;
    const enderecoCompleto = tipo === 'entrega' ? `${rua}, N°/Comp: ${numero}` : "Retirada no Local";

    return { id: Math.floor(Math.random() * 9000) + 1000, mesa: tipo === 'balcao' ? "Balcão" : "Delivery", enderecoCliente: enderecoCompleto, telefoneCliente: telefoneFinal, tipoEntrega: tipo, itensResumo: carrinho.map(i => i.nome).join(' + '), itens: carrinho, total: total };
}

async function salvarPedidoNoBanco(statusPagamento) {
    const dadosPedido = montarDadosPedido();
    dadosPedido.pagamento = statusPagamento;
    dadosPedido.data = new Date().toISOString();
    dadosPedido.status = "Em Preparo";

    try {
        const docRef = await db.collection("pedidos").add(dadosPedido);
        salvarNoHistorico(docRef.id);
        exibirTelaSucesso(dadosPedido.id);
    } catch (err) {
        mostrarAlerta("Erro de Conexão", "Falha ao salvar no banco. Verifique sua internet.", "erro");
        resetarBotaoFinalizar();
    }
}

function resetarBotaoFinalizar() {
    const btn = document.getElementById('btn-finalizar-pedido');
    if(btn) { 
        btn.innerHTML = "Confirmar Pedido ➔"; 
        btn.disabled = false; 
        btn.style.opacity = "1"; 
        btn.style.cursor = "pointer";
    } 
}

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
                        transaction_amount: totalPagamento, token: formData.token, description: `Pedido Rei do Açaí`,
                        installments: formData.installments, payment_method_id: formData.payment_method_id, issuer_id: formData.issuer_id,
                        payer: { email: formData.payer ? formData.payer.email : "comprador@email.com", identification: formData.payer && formData.payer.identification ? formData.payer.identification : { type: "CPF", number: "" } }
                    };
                    try {
                        const res = await fetch(`${API_BASE_URL}/pagamento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        const resposta = await res.json();
                        if (resposta.sucesso) {
                            
                            const dadosPedido = montarDadosPedido();
                            dadosPedido.pagamento = "💳 Cartão (Aprovado)";
                            dadosPedido.data = new Date().toISOString();
                            dadosPedido.status = "Em Preparo";
                            
                            const docRef = await db.collection("pedidos").add(dadosPedido);
                            salvarNoHistorico(docRef.id);
                            exibirTelaSucesso(dadosPedido.id); 
                            resolve(); 
                        } else { 
                            mostrarAlerta("Pagamento Recusado", resposta.msg, "erro"); reject(); 
                        }
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
    const formPix = document.getElementById('form-pix-container'); const formCartao = document.getElementById('form-cartao-container'); const formNaEntrega = document.getElementById('form-na-entrega-container'); const btnFinalizar = document.getElementById('btn-finalizar-pedido');
    
    if (metodo === 'online') { formPix.classList.add('hidden'); formCartao.classList.remove('hidden'); formNaEntrega.classList.add('hidden'); btnFinalizar.classList.add('hidden'); montarBrickCartao(); 
    } else if (metodo === 'pix') { formPix.classList.remove('hidden'); formCartao.classList.add('hidden'); formNaEntrega.classList.add('hidden'); btnFinalizar.classList.remove('hidden'); 
    } else { formPix.classList.add('hidden'); formCartao.classList.add('hidden'); formNaEntrega.classList.remove('hidden'); btnFinalizar.classList.remove('hidden'); } 
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
        
        if(btn) { 
            btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Gerando PIX..."; 
            btn.disabled = true; 
            btn.style.opacity = "0.7";
            btn.style.cursor = "not-allowed";
        }
        processarPagamentoPix(email, nome, cpf);

    } else if (metodoPgto === 'entrega') {
        const subPgto = document.querySelector('input[name="sub_pagamento_entrega"]:checked').value;
        let msgPagamento = "💰 Na Entrega";
        if (subPgto === 'Debito') msgPagamento = "💳 Na Entrega (Débito)";
        if (subPgto === 'Credito') msgPagamento = "💳 Na Entrega (Crédito)";
        if (subPgto === 'Dinheiro') {
            const troco = document.getElementById('valor-troco').value.trim();
            msgPagamento = troco !== "" ? `💵 Dinheiro (Troco para R$ ${troco})` : `💵 Dinheiro (Sem troco)`;
        }
        
        if(btn) { 
            btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Enviando Pedido..."; 
            btn.disabled = true; 
            btn.style.opacity = "0.7";
            btn.style.cursor = "not-allowed";
        }
        salvarPedidoNoBanco(msgPagamento);
    } 
}

async function processarPagamentoPix(emailCliente, nomeCliente, cpfCliente) {
    const totalPagamento = carrinho.reduce((acc, item) => acc + item.preco, 0) + valorFreteAplicado;
    const payload = {
        transaction_amount: totalPagamento, description: `Pedido Rei do Açaí`, payment_method_id: 'pix',
        payer: { email: emailCliente, first_name: nomeCliente, identification: { type: "CPF", number: cpfCliente.replace(/\D/g, '') } }
    };
    try {
        const res = await fetch(`${API_BASE_URL}/pagamento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const resposta = await res.json();
        if (resposta.sucesso && resposta.qr_code_base64) { 
            
            const dadosPedido = montarDadosPedido();
            dadosPedido.pagamento = "💠 PIX (Aguardando Pagamento)";
            dadosPedido.data = new Date().toISOString();
            dadosPedido.status = "Em Preparo";
            
            const docRef = await db.collection("pedidos").add(dadosPedido);
            localStorage.setItem('firebaseDocId', docRef.id);
            localStorage.setItem('numeroPedidoPix', dadosPedido.id);

            iniciarTelaPix(resposta.qr_code, resposta.id); 
        } 
        else { mostrarAlerta("Erro no PIX", resposta.msg || "Banco recusou os dados.", "erro"); resetarBotaoFinalizar(); }
    } catch (e) { mostrarAlerta("Erro de Conexão", "Falha de comunicação. Tente novamente.", "erro"); resetarBotaoFinalizar(); } 
}

let pixCronometro; let pixPolling; 

function iniciarTelaPix(codigoPix, paymentId) {
    document.getElementById('carrinho').classList.add('hidden'); 
    document.getElementById('tela-pix').classList.remove('hidden');
    document.getElementById('input-pix').value = codigoPix;
    let tempoRestante = 600; const visor = document.getElementById('pix-timer'); 
    clearInterval(pixCronometro); clearInterval(pixPolling); 

    pixCronometro = setInterval(() => {
        tempoRestante--; 
        visor.innerText = `${Math.floor(tempoRestante / 60).toString().padStart(2, '0')}:${(tempoRestante % 60).toString().padStart(2, '0')}`;
        
        if (tempoRestante <= 0) { 
            clearInterval(pixCronometro); clearInterval(pixPolling); 
            visor.innerText = "EXPIRADO"; 
            document.getElementById('input-pix').value = "Tempo expirado."; 
            mostrarAlerta("Tempo Esgotado", "O tempo do PIX expirou. O pedido será cancelado.", "erro"); 
            
            setTimeout(() => { cancelarPedidoPix(); }, 3000);
        }
    }, 1000); 

    pixPolling = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/status-pix/${paymentId}`);
            const dados = await res.json();
            if (dados.aprovado) {
                clearInterval(pixCronometro); clearInterval(pixPolling);
                
                const docId = localStorage.getItem('firebaseDocId');
                const numPed = localStorage.getItem('numeroPedidoPix');

                if(docId) {
                    await db.collection("pedidos").doc(docId).update({ pagamento: "💠 PIX (Aprovado)" });
                    salvarNoHistorico(docId);
                }

                exibirTelaSucesso(numPed || "0000"); 
            }
        } catch (e) {}
    }, 5000);
}

function copiarPix() {
    const inputPix = document.getElementById('input-pix'); inputPix.select(); inputPix.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(inputPix.value).then(() => mostrarAlerta("Copiado!", "Abra seu banco e use 'PIX Copia e Cola'.", "sucesso")).catch(err => mostrarAlerta("Ops!", "Erro ao copiar.", "erro")); 
}

async function cancelarPedidoPix() {
    const docId = localStorage.getItem('firebaseDocId');
    if (!docId) { window.location.reload(); return; }

    const btnCancelar = document.querySelector('button[onclick="cancelarPedidoPix()"]');
    if (btnCancelar) {
        btnCancelar.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Cancelando...";
        btnCancelar.disabled = true;
    }

    try {
        await db.collection("pedidos").doc(docId).update({ status: "Cancelado", pagamento: "❌ Cancelado (PIX Expirado ou Abandonado)" });
    } catch (e) { console.error("Erro ao tentar cancelar o pedido:", e); }
    
    window.location.reload();
}