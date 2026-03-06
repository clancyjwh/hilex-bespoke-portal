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

        // Fetch user profile to check role
        let { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        // Fallback: If profile doesn't exist yet, wait a moment or create a default one
        if (profileError || !profile) {
            console.warn('Profile not found, attempting to create default user profile');
            const { data: newProfile, error: createError } = await supabaseClient
                .from('profiles')
                .insert([{ id: data.user.id, role: 'user' }])
                .select()
                .single();

            if (createError) throw new Error('Could not initialize your profile. Please contact support.');
            profile = newProfile;
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
 * Handle Google OAuth
 */
async function handleGoogleLogin() {
    const errorDisplay = document.getElementById('error-message');
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname // Redirect back here to let auth state listener catch it
            }
        });
        if (error) throw error;
    } catch (err) {
        console.error('Google Auth Error:', err.message);
        errorDisplay.innerText = err.message;
        errorDisplay.style.display = 'block';
    }
}

/**
 * Handle Auth State Change (needed for OAuth redirects like Google)
 */
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
        // Fetch user profile to check role
        let { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        // Redirect based on role if we're on the login page
        if (window.location.pathname.endsWith('index.html') && !window.location.pathname.includes('/dashboard/')) {
            if (profile && profile.role === 'admin') {
                window.location.href = 'dashboard/admin/index.html';
            } else {
                window.location.href = 'dashboard/user/index.html';
            }
        }
    }
});

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

document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
document.getElementById('google-signup-btn')?.addEventListener('click', handleGoogleLogin);

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
