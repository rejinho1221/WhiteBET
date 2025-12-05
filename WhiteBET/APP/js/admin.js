// Estado da aplicação
const estado = {
    lutadores: [],
    lutas: [],
    secaoAtiva: 'dashboard'
};

// Função para carregar o dashboard
async function carregarDashboard() {
    try {
        // Verificar se o usuário ainda está autenticado
        const admin = checkAdminAuth();
        if (!admin || !admin.isLoggedIn) {
            console.log('Usuário não autenticado. Redirecionando para login...');
            window.location.href = 'login.html';
            return;
        }
        
        // Verificar e renovar sessão
        const sessaoValida = await verificarSessao();
        if (!sessaoValida) {
            return; // Já redirecionou para login
        }
        
        // Carregar lutas
        const { data: lutas, error: errorLutas } = await supabaseClient
            .from('fights')
            .select(`
                id,
                fight_date,
                location,
                status,
                fighter1_id,
                fighter2_id,
                fighter1_odds,
                fighter2_odds,
                total_apostado,
                lutador1:lutadores!fighter1_id(nome, apelido),
                lutador2:lutadores!fighter2_id(nome, apelido)
            `)
            .order('fight_date', { ascending: false });
            
        if (errorLutas) {
            // Se for erro de autenticação, redirecionar para login
            if (errorLutas.status === 401 || errorLutas.code === 'PGRST303') {
                console.log('Sessão expirada. Redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }
            throw errorLutas;
        }
        estado.lutas = lutas;
        
        // Carregar lutadores
        const { data: lutadores, error: errorLutadores } = await supabaseClient
            .from('lutadores')
            .select('*');
            
        if (errorLutadores) {
            if (errorLutadores.status === 401 || errorLutadores.code === 'PGRST303') {
                console.log('Sessão expirada. Redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }
            throw errorLutadores;
        }
        estado.lutadores = lutadores;
        
        // Calcular estatísticas
        const totalLutas = lutas.length;
        const totalLutadores = lutadores.length;
        const proximasLutas = lutas.filter(l => 
            l.status === 'scheduled' && new Date(l.fight_date) >= new Date()
        ).length;
        const valorTotalApostado = lutas.reduce((sum, luta) => sum + (luta.total_apostado || 0), 0);
        
        // Atualizar cards de estatísticas
        document.getElementById('total-fighters').textContent = totalLutadores;
        document.getElementById('total-fights').textContent = totalLutas;
        document.getElementById('upcoming-fights').textContent = proximasLutas;
        document.getElementById('total-bets').textContent = `R$ ${valorTotalApostado.toFixed(2)}`;
        
        // Atualizar atividades recentes
        atualizarAtividadesRecentes(lutas);
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            'Erro ao carregar dados do dashboard', 'error');
    }
}

// Função para carregar lutadores
async function carregarLutadores() {
    const tbody = document.getElementById('fighters-table-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="loading-data">
                <div class="spinner"></div>
                Carregando lutadores...
            </td>
        </tr>
    `;
    
    try {
        // Verificar se o usuário ainda está autenticado
        const admin = checkAdminAuth();
        if (!admin || !admin.isLoggedIn) {
            console.log('Usuário não autenticado. Redirecionando para login...');
            window.location.href = 'login.html';
            return;
        }
        
        // Verificar e renovar sessão
        const sessaoValida = await verificarSessao();
        if (!sessaoValida) {
            return; // Já redirecionou para login
        }
        
        const { data, error } = await supabaseClient
            .from('lutadores')
            .select('*')
            .order('nome', { ascending: true });
            
        if (error) {
            // Se for erro de autenticação, redirecionar para login
            if (error.status === 401 || error.code === 'PGRST303') {
                console.log('Sessão expirada. Redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }
            throw error;
        }
        estado.lutadores = data;
        
        renderizarTabelaLutadores(data);
        
        // Atualizar estatísticas do dashboard
        if (document.getElementById('total-fighters')) {
            document.getElementById('total-fighters').textContent = data.length;
        }
        
    } catch (error) {
        console.error('Erro ao carregar lutadores:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="error-data">
                    Erro ao carregar lutadores. Tente novamente mais tarde.
                </td>
            </tr>
        `;
    }
}

// Função para renderizar tabela de lutadores
function renderizarTabelaLutadores(lutadores) {
    const tbody = document.getElementById('fighters-table-body');
    
    if (lutadores.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">
                    Nenhum lutador cadastrado ainda.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = lutadores.map(lutador => {
        const dataNascimento = lutador.data_nascimento ? 
            new Date(lutador.data_nascimento).toLocaleDateString('pt-BR') : 
            '-';
        
        return `
            <tr>
                <td>${lutador.id}</td>
                <td>${lutador.nome}</td>
                <td>${lutador.apelido || '-'}</td>
                <td>${dataNascimento}</td>
                <td>${lutador.equipe || '-'}</td>
                <td class="actions">
                    <button class="action-btn edit-btn" data-id="${lutador.id}" data-type="fighter" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-id="${lutador.id}" data-type="fighter" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Adicionar eventos aos botões
    document.querySelectorAll('.edit-btn[data-type="fighter"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            editarLutador(id);
        });
    });
    
    document.querySelectorAll('.delete-btn[data-type="fighter"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            if (confirm('Tem certeza que deseja excluir este lutador?')) {
                excluirLutador(id);
            }
        });
    });
}

// Função para salvar lutador
async function salvarLutador() {
    const id = document.getElementById('fighter-id').value;
    const nome = document.getElementById('fighter-name').value;
    const apelido = document.getElementById('fighter-nickname').value;
    const dataNascimento = document.getElementById('fighter-birthdate').value;
    const equipe = document.getElementById('fighter-team').value;
    
    if (!nome) {
        mostrarMensagem(document.getElementById('fighter-modal'), 
            'Por favor, preencha o nome do lutador', 'error');
        return;
    }
    
    const lutador = { 
        nome,
        apelido: apelido || null,
        data_nascimento: dataNascimento || null,
        equipe: equipe || null
    };
    
    try {
        let resultado;
        if (id) {
            resultado = await supabaseClient
                .from('lutadores')
                .update(lutador)
                .eq('id', id);
        } else {
            resultado = await supabaseClient
                .from('lutadores')
                .insert([lutador]);
        }
        
        if (resultado.error) throw resultado.error;
        
        document.getElementById('fighter-modal').style.display = 'none';
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            id ? 'Lutador atualizado com sucesso!' : 'Lutador cadastrado com sucesso!', 'success');
        carregarLutadores();
        carregarLutadoresParaModal(); // Atualizar selects de lutadores
    } catch (error) {
        console.error('Erro ao salvar lutador:', error);
        mostrarMensagem(document.getElementById('fighter-modal'), 
            'Erro ao salvar lutador. Tente novamente.', 'error');
    }
}

// Função para editar lutador
function editarLutador(id) {
    const lutador = estado.lutadores.find(l => l.id == id);
    if (!lutador) return;
    
    document.getElementById('fighter-modal-title').textContent = 'Editar Lutador';
    document.getElementById('fighter-id').value = lutador.id;
    document.getElementById('fighter-name').value = lutador.nome;
    document.getElementById('fighter-nickname').value = lutador.apelido || '';
    document.getElementById('fighter-birthdate').value = lutador.data_nascimento || '';
    document.getElementById('fighter-team').value = lutador.equipe || '';
    
    document.getElementById('fighter-modal').style.display = 'flex';
}

// Função para excluir lutador
async function excluirLutador(id) {
    try {
        // Verificar se o lutador está em alguma luta
        const { data: lutas, error: errorLutas } = await supabaseClient
            .from('fights')
            .select('id')
            .or(`fighter1_id.eq.${id},fighter2_id.eq.${id}`);
            
        if (errorLutas) {
            if (errorLutas.status === 401 || errorLutas.code === 'PGRST303') {
                console.log('Sessão expirada. Redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }
            throw errorLutas;
        }
        
        if (lutas && lutas.length > 0) {
            mostrarMensagem(document.querySelector('.admin-section.active'), 
                'Não é possível excluir este lutador pois ele está em lutas agendadas.', 'error');
            return;
        }
        
        const { error } = await supabaseClient
            .from('lutadores')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            'Lutador excluído com sucesso!', 'success');
        carregarLutadores();
        carregarLutadoresParaModal(); // Atualizar selects de lutadores
    } catch (error) {
        console.error('Erro ao excluir lutador:', error);
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            'Erro ao excluir lutador. Tente novamente.', 'error');
    }
}

// Função para carregar lutadores para o modal de lutas
async function carregarLutadoresParaModal() {
    // Verificar se os elementos existem
    const fighter1Select = document.getElementById('fighter1-select');
    const fighter2Select = document.getElementById('fighter2-select');
    
    if (!fighter1Select || !fighter2Select) {
        console.error('Selects de lutadores não encontrados');
        return;
    }
    
    // Limpar selects
    fighter1Select.innerHTML = '<option value="">Selecione um lutador</option>';
    fighter2Select.innerHTML = '<option value="">Selecione um lutador</option>';
    
    // Preencher selects
    estado.lutadores.forEach(lutador => {
        const option1 = document.createElement('option');
        option1.value = lutador.id;
        option1.textContent = `${lutador.nome} ${lutador.apelido ? `(${lutador.apelido})` : ''}`;
        fighter1Select.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = lutador.id;
        option2.textContent = `${lutador.nome} ${lutador.apelido ? `(${lutador.apelido})` : ''}`;
        fighter2Select.appendChild(option2);
    });
}

// Função para carregar lutas
async function carregarLutas() {
    const tbody = document.getElementById('fights-table-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-data">
                <div class="spinner"></div>
                Carregando lutas...
            </td>
        </tr>
    `;
    
    try {
        // Verificar se o usuário ainda está autenticado
        const admin = checkAdminAuth();
        if (!admin || !admin.isLoggedIn) {
            console.log('Usuário não autenticado. Redirecionando para login...');
            window.location.href = 'login.html';
            return;
        }
        
        // Verificar e renovar sessão
        const sessaoValida = await verificarSessao();
        if (!sessaoValida) {
            return; // Já redirecionou para login
        }
        
        const { data: lutas, error: errorLutas } = await supabaseClient
            .from('fights')
            .select(`
                id,
                fight_date,
                location,
                status,
                fighter1_id,
                fighter2_id,
                fighter1_odds,
                fighter2_odds,
                total_apostado,
                lutador1:lutadores!fighter1_id(nome, apelido),
                lutador2:lutadores!fighter2_id(nome, apelido)
            `)
            .order('fight_date', { ascending: false });
            
        if (errorLutas) {
            if (errorLutas.status === 401 || errorLutas.code === 'PGRST303') {
                console.log('Sessão expirada. Redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }
            throw errorLutas;
        }
        estado.lutas = lutas;
        
        renderizarTabelaLutas(lutas);
    } catch (error) {
        console.error('Erro ao carregar lutas:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="error-data">
                    Erro ao carregar lutas. Tente novamente mais tarde.
                </td>
            </tr>
        `;
    }
}

// Funções de renderização e manipulação de dados
function renderizarTabelaLutas(lutas) {
    const tbody = document.getElementById('fights-table-body');
    
    if (lutas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data">
                    Nenhuma luta cadastrada ainda.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = lutas.map(luta => {
        const dataFormatada = new Date(luta.fight_date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusClass = `status-${luta.status}`;
        const statusText = {
            'scheduled': 'Agendada',
            'completed': 'Finalizada',
            'cancelled': 'Cancelada'
        };
        
        const nomeLutador1 = luta.lutador1 ? 
            `${luta.lutador1.nome} ${luta.lutador1.apelido ? `(${luta.lutador1.apelido})` : ''}` : 
            `Lutador ${luta.fighter1_id}`;
        
        const nomeLutador2 = luta.lutador2 ? 
            `${luta.lutador2.nome} ${luta.lutador2.apelido ? `(${luta.lutador2.apelido})` : ''}` : 
            `Lutador ${luta.fighter2_id}`;
        
        return `
            <tr>
                <td>${dataFormatada}</td>
                <td>${luta.location}</td>
                <td>
                    <div class="fighters-names">
                        <div>${nomeLutador1}</div>
                        <div>${nomeLutador2}</div>
                    </div>
                </td>
                <td class="odds-values">
                    <div class="odd-item">R$ ${luta.total_apostado.toFixed(2)}</div>
                </td>
                <td class="odds-values">
                    <div class="odd-item">${luta.fighter1_odds.toFixed(2)}</div>
                    <div class="odd-item">${luta.fighter2_odds.toFixed(2)}</div>
                </td>
                <td><span class="status ${statusClass}">${statusText[luta.status]}</span></td>
                <td class="actions">
                    <button class="action-btn edit-btn" data-id="${luta.id}" data-type="fight" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-id="${luta.id}" data-type="fight" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Adicionar eventos aos botões
    document.querySelectorAll('.edit-btn[data-type="fight"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            editarLuta(id);
        });
    });
    
    document.querySelectorAll('.delete-btn[data-type="fight"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            if (confirm('Tem certeza que deseja excluir esta luta?')) {
                excluirLuta(id);
            }
        });
    });
}

// Função para salvar luta
async function salvarLuta() {
    // Verificar se os elementos existem
    const fightIdInput = document.getElementById('fight-id');
    const fighter1Select = document.getElementById('fighter1-select');
    const fighter2Select = document.getElementById('fighter2-select');
    const fightDateInput = document.getElementById('fight-date');
    const fightLocationInput = document.getElementById('fight-location');
    const betAmount1Input = document.getElementById('bet-amount-1');
    const betAmount2Input = document.getElementById('bet-amount-2');
    const marginInput = document.getElementById('margin');
    const statusInput = document.getElementById('status');
    
    // Se algum elemento não existir, sair da função
    if (!fightIdInput || !fighter1Select || !fighter2Select || !fightDateInput || !fightLocationInput || 
        !betAmount1Input || !betAmount2Input || !marginInput || !statusInput) {
        mostrarMensagem(document.getElementById('fight-modal'), 
            'Erro: Um ou mais campos do formulário não foram encontrados', 'error');
        return;
    }
    
    const id = fightIdInput.value;
    const fighter1Id = parseInt(fighter1Select.value);
    const fighter2Id = parseInt(fighter2Select.value);
    const fightDate = fightDateInput.value;
    const location = fightLocationInput.value;
    const valor1 = parseFloat(betAmount1Input.value);
    const valor2 = parseFloat(betAmount2Input.value);
    const margem = parseFloat(marginInput.value);
    const status = statusInput.value;
    
    // Calcular odds
    const totalApostado = valor1 + valor2;
    const odd1 = totalApostado > 0 ? (totalApostado / valor1) : 0;
    const odd2 = totalApostado > 0 ? (totalApostado / valor2) : 0;
    
    // Aplicar margem da casa
    const odd1Ajustada = odd1 * (1 - margem / 100);
    const odd2Ajustada = odd2 * (1 - margem / 100);
    
    if (!fighter1Id || !fighter2Id || !fightDate || !location || isNaN(valor1) || isNaN(valor2)) {
        mostrarMensagem(document.getElementById('fight-modal'), 
            'Por favor, preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    if (odd1Ajustada <= 1 || odd2Ajustada <= 1) {
        mostrarMensagem(document.getElementById('fight-modal'), 
            'Odds devem ser maiores que 1.00', 'error');
        return;
    }
    
    if (fighter1Id === fighter2Id) {
        mostrarMensagem(document.getElementById('fight-modal'), 
            'Um lutador não pode lutar contra si mesmo', 'error');
        return;
    }
    
    const luta = { 
        fighter1_id: fighter1Id,
        fighter2_id: fighter2Id,
        fight_date: fightDate,
        location,
        status: status,
        fighter1_odds: odd1Ajustada,
        fighter2_odds: odd2Ajustada,
        total_apostado: totalApostado
    };
    
    try {
        let resultado;
        if (id) {
            resultado = await supabaseClient
                .from('fights')
                .update(luta)
                .eq('id', id);
        } else {
            resultado = await supabaseClient
                .from('fights')
                .insert([luta]);
        }
        
        if (resultado.error) throw resultado.error;
        
        document.getElementById('fight-modal').style.display = 'none';
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            id ? 'Luta atualizada com sucesso!' : 'Luta agendada com sucesso!', 'success');
        carregarLutas();
    } catch (error) {
        console.error('Erro ao salvar luta:', error);
        mostrarMensagem(document.getElementById('fight-modal'), 
            'Erro ao salvar luta. Tente novamente.', 'error');
    }
}

// Função para cancelar luta
async function cancelarLuta(id) {
    try {
        const { error } = await supabaseClient
            .from('fights')
            .update({ status: 'cancelled' })
            .eq('id', id);
            
        if (error) throw error;
        
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            'Luta cancelada com sucesso!', 'success');
        carregarDashboard();
        carregarLutas();
    } catch (error) {
        console.error('Erro ao cancelar luta:', error);
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            'Erro ao cancelar luta. Tente novamente.', 'error');
    }
}

// Função para excluir luta
async function excluirLuta(id) {
    try {
        const { error } = await supabaseClient
            .from('fights')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            'Luta excluída com sucesso!', 'success');
        carregarDashboard();
        carregarLutas();
    } catch (error) {
        console.error('Erro ao excluir luta:', error);
        mostrarMensagem(document.querySelector('.admin-section.active'), 
            'Erro ao excluir luta. Tente novamente.', 'error');
    }
}

// Função para editar luta
async function editarLuta(id) {
    const luta = estado.lutas.find(l => l.id == id);
    if (!luta) return;
    
    // Verificar se os elementos existem
    const fightIdInput = document.getElementById('fight-id');
    const fighter1Select = document.getElementById('fighter1-select');
    const fighter2Select = document.getElementById('fighter2-select');
    const fightDateInput = document.getElementById('fight-date');
    const fightLocationInput = document.getElementById('fight-location');
    const betAmount1Input = document.getElementById('bet-amount-1');
    const betAmount2Input = document.getElementById('bet-amount-2');
    const marginInput = document.getElementById('margin');
    const statusInput = document.getElementById('status');
    
    // Se algum elemento não existir, sair da função
    if (!fightIdInput || !fighter1Select || !fighter2Select || !fightDateInput || !fightLocationInput || 
        !betAmount1Input || !betAmount2Input || !marginInput || !statusInput) {
        console.error('Um ou mais campos do formulário não foram encontrados');
        return;
    }
    
    // Preencher os valores
    fightIdInput.value = luta.id;
    fighter1Select.value = luta.fighter1_id;
    fighter2Select.value = luta.fighter2_id;
    
    // Formatar data para datetime-local
    const fightDate = new Date(luta.fight_date);
    const formattedDate = fightDate.toISOString().slice(0, 16);
    fightDateInput.value = formattedDate;
    
    fightLocationInput.value = luta.location;
    
    // Calcular valores apostados baseados nas odds
    const totalApostado = luta.total_apostado || 0;
    const odd1 = luta.fighter1_odds || 0;
    const odd2 = luta.fighter2_odds || 0;
    
    // Valor apostado em cada lutador (aproximado)
    const valor1 = totalApostado * (odd2 / (odd1 + odd2));
    const valor2 = totalApostado * (odd1 / (odd1 + odd2));
    
    betAmount1Input.value = valor1.toFixed(2);
    betAmount2Input.value = valor2.toFixed(2);
    marginInput.value = 0; // Margem em 0%
    statusInput.value = luta.status; // Definir o status
    
    // Calcular e preencher as odds
    calcularOdds();
    
    // Carregar lutadores para o modal
    await carregarLutadoresParaModal();
    
    document.getElementById('fight-modal').style.display = 'flex';
}

// Funções auxiliares
function atualizarAtividadesRecentes(lutas) {
    const container = document.getElementById('activity-list');
    const ultimasLutas = lutas.slice(0, 5);
    
    container.innerHTML = ultimasLutas.map(luta => {
        const data = new Date(luta.fight_date);
        const hoje = new Date();
        let tempo;
        
        if (data.toDateString() === hoje.toDateString()) {
            tempo = 'Hoje';
        } else if (data.getTime() > hoje.getTime() - 86400000) {
            tempo = 'Ontem';
        } else {
            tempo = data.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short'
            });
        }
        
        const statusIcon = {
            'scheduled': 'fa-calendar-plus',
            'completed': 'fa-check-circle',
            'cancelled': 'fa-times-circle'
        };
        
        const statusColor = {
            'scheduled': 'bg-info',
            'completed': 'bg-success',
            'cancelled': 'bg-danger'
        };
        
        const nomeLutador1 = luta.lutador1 ? 
            luta.lutador1.nome : `Lutador ${luta.fighter1_id}`;
        
        const nomeLutador2 = luta.lutador2 ? 
            luta.lutador2.nome : `Lutador ${luta.fighter2_id}`;
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${statusColor[luta.status]}">
                    <i class="fas ${statusIcon[luta.status]}"></i>
                </div>
                <div class="activity-content">
                    <p>Luta ${luta.status === 'completed' ? 'finalizada' : 'agendada'}: ${nomeLutador1} vs ${nomeLutador2}</p>
                    <small>${tempo} • ${luta.location} • Status: ${luta.status}</small>
                </div>
            </div>
        `;
    }).join('');
}

function mostrarMensagem(elemento, mensagem, tipo) {
    if (typeof elemento === 'string') {
        elemento = document.querySelector(elemento);
    }
    
    if (!elemento) return;
    
    const mensagemEl = document.createElement('div');
    mensagemEl.className = `form-message message-${tipo}`;
    mensagemEl.innerHTML = mensagem;
    
    if (elemento.querySelector('.form-message')) {
        elemento.querySelector('.form-message').remove();
    }
    
    elemento.prepend(mensagemEl);
    
    // Remover mensagem após 5 segundos
    setTimeout(() => {
        if (mensagemEl.parentNode === elemento) {
            mensagemEl.remove();
        }
    }, 5000);
}

// Função para calcular odds automaticamente
function calcularOdds() {
    // Verificar se os elementos existem
    const betAmount1Input = document.getElementById('bet-amount-1');
    const betAmount2Input = document.getElementById('bet-amount-2');
    const marginInput = document.getElementById('margin');
    const totalBetInput = document.getElementById('total-bet');
    const odds1Input = document.getElementById('odds-1');
    const odds2Input = document.getElementById('odds-2');
    
    // Se algum elemento não existir, sair da função
    if (!betAmount1Input || !betAmount2Input || !marginInput || !totalBetInput || !odds1Input || !odds2Input) {
        console.error('Um ou mais campos do formulário não foram encontrados');
        return;
    }
    
    const valor1 = parseFloat(betAmount1Input.value) || 0;
    const valor2 = parseFloat(betAmount2Input.value) || 0;
    const margem = parseFloat(marginInput.value) || 0; // Margem padrão 0%
    
    const totalApostado = valor1 + valor2;
    totalBetInput.value = totalApostado.toFixed(2);
    
    if (totalApostado > 0) {
        // Calcular odds reais
        const odd1 = (totalApostado / valor1) || 0;
        const odd2 = (totalApostado / valor2) || 0;
        
        // Aplicar margem da casa (reduzir odds para garantir lucro)
        const odd1Ajustada = odd1 * (1 - margem / 100);
        const odd2Ajustada = odd2 * (1 - margem / 100);
        
        odds1Input.value = valor1 > 0 ? odd1Ajustada.toFixed(2) : '0.00';
        odds2Input.value = valor2 > 0 ? odd2Ajustada.toFixed(2) : '0.00';
    } else {
        odds1Input.value = '0.00';
        odds2Input.value = '0.00';
    }
}

// Configuração de navegação
document.addEventListener('DOMContentLoaded', function() {
    // Eventos de navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const secao = this.getAttribute('data-section');
            mudarSecao(secao);
        });
    });
    
    // Eventos do menu mobile
    document.getElementById('menu-toggle').addEventListener('click', function() {
        document.querySelector('.admin-sidebar').classList.toggle('active');
        document.querySelector('.admin-main').classList.toggle('shifted');
    });
    
    // Eventos dos botões de nova luta
    document.getElementById('new-fight-btn').addEventListener('click', async function() {
        document.getElementById('fight-modal-title').textContent = 'Nova Luta';
        document.getElementById('fight-form').reset();
        document.getElementById('fight-id').value = '';
        document.getElementById('status').value = 'scheduled'; // Definir status padrão
        document.getElementById('fight-modal').style.display = 'flex';
        await carregarLutadoresParaModal();
    });
    
    // Eventos dos botões de novo lutador
    document.getElementById('new-fighter-btn').addEventListener('click', function() {
        document.getElementById('fighter-modal-title').textContent = 'Novo Lutador';
        document.getElementById('fighter-form').reset();
        document.getElementById('fighter-id').value = '';
        document.getElementById('fighter-modal').style.display = 'flex';
    });
    
    // Eventos de fechar modais
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Eventos de cancelar nos formulários
    document.getElementById('cancel-fight-btn').addEventListener('click', function() {
        document.getElementById('fight-modal').style.display = 'none';
    });
    
    document.getElementById('cancel-fighter-btn').addEventListener('click', function() {
        document.getElementById('fighter-modal').style.display = 'none';
    });
    
    // Eventos de submissão dos formulários
    document.getElementById('fight-form').addEventListener('submit', function(e) {
        e.preventDefault();
        salvarLuta();
    });
    
    document.getElementById('fighter-form').addEventListener('submit', function(e) {
        e.preventDefault();
        salvarLutador();
    });
    
    // Configurar eventos para calcular odds automaticamente
    document.getElementById('bet-amount-1').addEventListener('input', calcularOdds);
    document.getElementById('bet-amount-2').addEventListener('input', calcularOdds);
    document.getElementById('margin').addEventListener('input', calcularOdds);
    
    // Inicializar com o dashboard
    carregarDashboard();
});

// Função para mudar de seção
function mudarSecao(secao) {
    // Atualizar navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-section') === secao);
    });
    
    // Atualizar seções
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.toggle('active', section.id === `${secao}-section`);
    });
    
    // Atualizar título da página
    const titulos = {
        'dashboard': 'Dashboard',
        'fighters': 'Gerenciar Lutadores',
        'fights': 'Gerenciar Lutas'
    };
    
    document.getElementById('page-title').textContent = titulos[secao] || 'Administração';
    estado.secaoAtiva = secao;
    
    // Carregar dados específicos da seção
    if (secao === 'dashboard') {
        carregarDashboard();
    } else if (secao === 'fighters') {
        carregarLutadores();
    } else if (secao === 'fights') {
        carregarLutas();
    }
}