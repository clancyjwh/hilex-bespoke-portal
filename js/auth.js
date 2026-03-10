// Supabase Configuration — shared Supabase project with REAL-HILEXAPP
const SUPABASE_URL = 'https://avijzlkdukanneylvtrd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2aWp6bGtkdWthbm5leWx2dHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzUxNTUsImV4cCI6MjA3NjkxMTE1NX0.w6C4WuyugBoZdFxp6kxPEUuMVgqIaokkhrTyck7hzTY';

// use 'supabaseClient' to avoid shadowing the global 'supabase' object from the CDN
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

        // Determine bespoke_role: check users table first, fall back to email check
        const userEmail = data.user.email;

        let bespokeRole = 'user'; // default

        const { data: userRow } = await supabaseClient
            .from('users')
            .select('bespoke_role')
            .eq('id', data.user.id)
            .maybeSingle();

        if (userRow && userRow.bespoke_role) {
            bespokeRole = userRow.bespoke_role;
        } else if (userEmail === 'clancyjhodgins@gmail.com') {
            bespokeRole = 'admin';
        }

        // Redirect based on bespoke_role
        if (bespokeRole === 'admin') {
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
        if (!data.user) throw new Error('Signup failed.');

        if (data.user.identities && data.user.identities.length === 0) {
            throw new Error('This email is already registered.');
        }

        // 1. Insert into shared 'users' table to ensure role-based logic works
        const { error: insertError } = await supabaseClient.from('users').insert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            role: 'user', // default for main app
            bespoke_role: 'user' // default for bespoke portal
        });

        if (insertError) {
            console.error('Error creating user record:', insertError);
            // We don't throw here because the auth account WAS created, 
            // but the user might need to contact support if the row insert failed.
        }

        // 2. Clearer state handling for "nothing happened"
        if (data.session) {
            // Auto-logged in (email confirmation off)
            alert('Account created! Redirecting to portal...');
            window.location.href = 'dashboard/user/index.html';
        } else {
            // Confirmation required
            alert('Account created! Please check your email (' + email + ') for a verification link before logging in.');
            toggleAuthMode();
        }

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


// ============================================================
// Single Sign-On (SSO) Interceptor
// Triggered when REAL-HILEXAPP opens this page with token hash:
//   index.html#access_token=TOKEN&refresh_token=RTOKEN
// ============================================================
async function processSSO() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return false;

    // Parse hash params
    const params = {};
    hash.substring(1).split('&').forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) params[key] = decodeURIComponent(value);
    });

    const accessToken = params['access_token'];
    const refreshToken = params['refresh_token'];

    if (!accessToken) return false;

    // Show loading state
    const submitBtn = document.querySelector('#login-form button');
    if (submitBtn) {
        submitBtn.innerText = 'Authenticating via SSO...';
        submitBtn.disabled = true;
    }

    try {
        // Restore session from the tokens passed by REAL-HILEXAPP
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || accessToken
        });

        if (sessionError || !sessionData?.session) {
            console.error('SSO setSession failed:', sessionError);
            if (submitBtn) { submitBtn.innerText = 'Portal Access'; submitBtn.disabled = false; }
            return false;
        }

        const userId = sessionData.session.user.id;

        // Look up bespoke_role from shared users table
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('bespoke_role')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            console.warn('No bespoke_role found for user, defaulting to user dashboard:', userError);
            window.location.href = 'dashboard/user/index.html';
            return true;
        }

        // Clear the hash so tokens don't linger in browser history
        history.replaceState(null, '', window.location.pathname + window.location.search);

        setTimeout(() => {
            if (userData.bespoke_role === 'admin') {
                window.location.href = 'dashboard/admin/index.html';
            } else {
                window.location.href = 'dashboard/user/index.html';
            }
        }, 250);

        return true;

    } catch (err) {
        console.error('SSO error:', err);
        if (submitBtn) { submitBtn.innerText = 'Portal Access'; submitBtn.disabled = false; }
        return false;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processSSO);
} else {
    processSSO();
}

