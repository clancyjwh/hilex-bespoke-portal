// Supabase Configuration
const SUPABASE_URL = 'https://amhmyuxzktxofskwrirl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaG15dXh6a3R4b2Zza3dyaXJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDIxMjQsImV4cCI6MjA4ODM3ODEyNH0.YoG2vPY12nOi_qgXNdNlu5KV3ABZU_S0LCm-bBWaUUI';

// use 'supabaseClient' to avoid shadowing the global 'supabase' object from the CDN
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Handle user login and role-based redirection
 */
async function handleLogin(email, password) {
    const errorDisplay = document.getElementById('error-message');
    const submitBtn = document.querySelector('#login-form button');

    try {
        submitBtn.innerText = 'Authenticating...';
        submitBtn.disabled = true;

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // If session is null, it means email verification is required and hasn't been completed
        if (!data.session) {
            throw new Error('Please verify your email address before logging in.');
        }

        // Fetch user profile to check role
        let { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            console.error('Profile Fetch Error:', profileError);
            throw new Error('Database Error: Profile setup is incomplete. Admin needs to run the reset_auth.sql script.');
        }

        // Redirect based on role
        if (profile.role === 'admin') {
            window.location.href = 'dashboard/admin/index.html';
        } else {
            window.location.href = 'dashboard/user/index.html';
        }

    } catch (err) {
        console.error('Login Error:', err.message);
        errorDisplay.innerText = err.message;
        errorDisplay.style.display = 'block';
        submitBtn.innerText = 'Portal Access';
        submitBtn.disabled = false;
    }
}

/**
 * Handle user signup
 */
async function handleSignup(email, password, fullName) {
    const errorDisplay = document.getElementById('error-message');
    const submitBtn = document.querySelector('#signup-form button');

    try {
        submitBtn.innerText = 'Creating Account...';
        submitBtn.disabled = true;

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            throw new Error('This email is already registered.');
        }

        alert('Account created! Please check your email for verification or login if auto-verified.');
        toggleAuthMode();

    } catch (err) {
        console.error('Signup Error:', err.message);
        errorDisplay.innerText = err.message;
        errorDisplay.style.display = 'block';
    } finally {
        submitBtn.innerText = 'Create Account';
        submitBtn.disabled = false;
    }
}


/**
 * Logout utility
 */
window.handleLogout = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '/index.html';
};

// Event Listeners
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    await handleLogin(email, password);
});

document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const fullName = document.getElementById('signup-name').value;
    await handleSignup(email, password, fullName);
});


function toggleAuthMode() {
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const errorDisplay = document.getElementById('error-message');

    errorDisplay.style.display = 'none';

    if (loginSection.style.display === 'none') {
        loginSection.style.display = 'block';
        signupSection.style.display = 'none';
    } else {
        loginSection.style.display = 'none';
        signupSection.style.display = 'block';
    }
}

window.toggleAuthMode = toggleAuthMode;
