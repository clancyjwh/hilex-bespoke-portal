// Supabase Configuration
const SUPABASE_URL = 'https://amhmyuxzktxofskwrirl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaG15dXh6a3R4b2Zza3dyaXJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDIxMjQsImV4cCI6MjA4ODM3ODEyNH0.YoG2vPY12nOi_qgXNdNlu5KV3ABZU_S0LCm-bBWaUUI';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Handle user login and role-based redirection
 */
async function handleLogin(email, password) {
    const errorDisplay = document.getElementById('error-message');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Fetch user profile to check role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

        // Redirect based on role
        if (profile.role === 'admin') {
            window.location.href = '/dashboard/admin/index.html';
        } else {
            window.location.href = '/dashboard/user/index.html';
        }

    } catch (err) {
        console.error('Login Error:', err.message);
        errorDisplay.innerText = err.message;
        errorDisplay.style.display = 'block';
    }
}

// Event Listeners
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    await handleLogin(email, password);
});
