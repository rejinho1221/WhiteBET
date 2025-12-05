document.addEventListener('DOMContentLoaded', function() {
    // Carregar próximas lutas SEM verificação de autenticação
    carregarProximasLutas();
    
    // Atualizar odds a cada 15 segundos
    setInterval(carregarProximasLutas, 15000);
});

async function carregarProximasLutas() {
    const container = document.getElementById('fights-container');
    const loading = document.getElementById('loading-fights');
    
    try {
        // Consulta pública - não requer autenticação
        const { data, error } = await supabaseClient
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
            .eq('status', 'scheduled')
            .gte('fight_date', new Date().toISOString())
            .order('fight_date', { ascending: true });

        if (error) throw error;
        
        loading.style.display = 'none';
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p>Nenhuma luta agendada no momento.</p>
                    <p>Volte em breve para conferir as próximas lutas!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.map(luta => {
            const dataFormatada = new Date(luta.fight_date).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const nomeLutador1 = luta.lutador1 ? 
                `${luta.lutador1.nome} ${luta.lutador1.apelido ? `(${luta.lutador1.apelido})` : ''}` : 
                `Lutador ${luta.fighter1_id}`;
            
            const nomeLutador2 = luta.lutador2 ? 
                `${luta.lutador2.nome} ${luta.lutador2.apelido ? `(${luta.lutador2.apelido})` : ''}` : 
                `Lutador ${luta.fighter2_id}`;
            
            // Determinar a classe do status e cor de fundo do header
            let statusClass = 'status-scheduled';
            let statusText = 'Agendada';
            let headerBg = 'linear-gradient(135deg, var(--primary-color) 0%, #a50000 100%)';
            
            if (luta.status === 'completed') {
                statusClass = 'status-completed';
                statusText = 'Finalizada';
                headerBg = 'linear-gradient(135deg, var(--info-color) 0%, #5a4eaa 100%)';
            } else if (luta.status === 'cancelled') {
                statusClass = 'status-cancelled';
                statusText = 'Cancelada';
                headerBg = 'linear-gradient(135deg, var(--danger-color) 0%, #b32d2d 100%)';
            }
            
            return `
                <div class="fight-card">
                    <div class="fight-header" style="background: ${headerBg}">
                        
                        <div class="fight-date">
                            <i class="fas fa-calendar"></i>
                            <span>${dataFormatada}</span>
                        </div>
                        <div class="fight-location">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${luta.location}</span>
                        </div>
                    </div>
                    <div class="fighters-vs">
                        <div class="fighter">
                            <div class="fighter-info">
                                <div class="fighter-name">${nomeLutador1}</div>
                                <div class="fighter-odds">Odd: ${luta.fighter1_odds.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="vs">VS</div>
                        <div class="fighter">
                            <div class="fighter-info">
                                <div class="fighter-name">${nomeLutador2}</div>
                                <div class="fighter-odds">Odd: ${luta.fighter2_odds.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="total-apostado">Total Apostado: R$ ${luta.total_apostado.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar lutas:', error);
        loading.style.display = 'none';
        container.innerHTML = `
            <div class="error-message">
                <p>Erro ao carregar as próximas lutas. Tente novamente mais tarde.</p>
            </div>
        `;
    }
}