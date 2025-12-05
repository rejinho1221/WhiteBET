// Configuração do Supabase
const SUPABASE_URL = 'https://nrhruivxdzzggizaiifz.supabase.co'; // Substitua pela sua URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaHJ1aXZ4ZHp6Z2dpemFpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzODc2MjEsImV4cCI6MjA3OTk2MzYyMX0.Vpsk_Ucb5jRZB4PEX-0CF-7csN9ncKaxrScqLX5qG7c'; // Substitua pela sua chave pública

// Inicializar cliente Supabase
let supabaseClient = null;

function initializeSupabase() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Erro: URL ou chave do Supabase não configurada. Verifique seu supabase.js');
        return null;
    }
    
    try {
        // Certifique-se de que o supabase está carregado
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase não está carregado. Verifique se o script do Supabase está no HTML');
            return null;
        }
        
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase inicializado com sucesso');
        return supabaseClient;
    } catch (error) {
        console.error('Erro ao inicializar Supabase:', error);
        return null;
    }
}

// Inicializar Supabase quando o script for carregado
document.addEventListener('DOMContentLoaded', function() {
    initializeSupabase();
});

// Função para garantir que o Supabase está inicializado
function getSupabaseClient() {
    if (!supabaseClient) {
        console.error('Supabase não está inicializado. Tentando inicializar...');
        initializeSupabase();
    }
    return supabaseClient;
}

// Função para login de administrador
async function loginAdmin(email, password) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            throw new Error('Supabase não está inicializado');
        }
        
        // Tenta autenticar com o Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            throw new Error('Credenciais inválidas');
        }
        
        // Verifica se é um administrador válido
        const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('id, username')
            .eq('email', email)
            .single();
        
        if (adminError || !adminData) {
            await supabase.auth.signOut();
            throw new Error('Acesso não autorizado');
        }
        
        // Salva dados do administrador
        localStorage.setItem('admin', JSON.stringify({
            id: adminData.id,
            username: adminData.username,
            email: email,
            isLoggedIn: true,
            token: data.session.access_token
        }));
        
        return { success: true, user: adminData };
    } catch (error) {
        console.error('Erro no login:', error);
        return { success: false, message: error.message };
    }
}

// Função para verificar se o admin está logado
function checkAdminAuth() {
    const admin = localStorage.getItem('admin');
    return admin ? JSON.parse(admin) : null;
}

// Função para logout do admin
async function logoutAdmin() {
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    }
    localStorage.removeItem('admin');
}

// Função para verificar e renovar sessão
async function verificarSessao() {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    
    try {
        const { data: session, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Erro ao obter sessão:', error);
            return false;
        }
        
        if (!session?.session) {
            // Sessão expirada ou inexistente
            console.log('Sessão expirada. Redirecionando para login...');
            window.location.href = 'login.html';
            return false;
        }
        
        // Atualizar dados do administrador
        const admin = checkAdminAuth();
        if (admin && admin.email) {
            const { data: adminData, error: adminError } = await supabase
                .from('admins')
                .select('id, username')
                .eq('email', admin.email)
                .single();
            
            if (adminError || !adminData) {
                await supabase.auth.signOut();
                window.location.href = 'login.html';
                return false;
            }
            
            // Atualizar dados do administrador
            localStorage.setItem('admin', JSON.stringify({
                id: adminData.id,
                username: adminData.username,
                email: admin.email,
                isLoggedIn: true,
                token: session.session.access_token
            }));
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        return false;
    }
}

// Exportar funções para uso global
window.supabaseClient = supabaseClient;
window.loginAdmin = loginAdmin;
window.checkAdminAuth = checkAdminAuth;
window.logoutAdmin = logoutAdmin;
window.initializeSupabase = initializeSupabase;
window.getSupabaseClient = getSupabaseClient;
window.verificarSessao = verificarSessao;