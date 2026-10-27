// VisionAssist Guardian Portal - Authentication Module


document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  checkAuthSession();
});

function initAuthUI() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const authMsg = document.getElementById('auth-message');

      if (!email || !password) {
        if (authMsg) { authMsg.textContent = 'Please enter email and password.'; authMsg.style.color = 'var(--critical-600)'; }
        return;
      }

      if (authMsg) { authMsg.textContent = 'Signing in...'; authMsg.style.color = 'var(--primary-600)'; }

      try {
        const client = getSupabase();
        if (!client) {
          if (authMsg) { authMsg.textContent = 'Error: Unable to connect to server. Please refresh the page.'; authMsg.style.color = 'var(--critical-600)'; }
          return;
        }

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          if (authMsg) { authMsg.textContent = `Sign in failed: ${error.message}`; authMsg.style.color = 'var(--critical-600)'; }
        } else {
          const userName = data.user.user_metadata?.name || data.user.email.split('@')[0];
          localStorage.setItem('vg_guardian_user', JSON.stringify({ name: userName, email: data.user.email, id: data.user.id }));
          if (authMsg) { authMsg.textContent = 'Success! Redirecting to dashboard...'; authMsg.style.color = 'var(--success-600)'; }
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
        }
      } catch (err) {
        if (authMsg) { authMsg.textContent = `Connection error: ${err.message}`; authMsg.style.color = 'var(--critical-600)'; }
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const authMsg = document.getElementById('auth-message');

      if (!name || !email || !password) {
        if (authMsg) { authMsg.textContent = 'Please fill in all fields.'; authMsg.style.color = 'var(--critical-600)'; }
        return;
      }

      if (password.length < 6) {
        if (authMsg) { authMsg.textContent = 'Password must be at least 6 characters.'; authMsg.style.color = 'var(--critical-600)'; }
        return;
      }

      if (authMsg) { authMsg.textContent = 'Creating your guardian account...'; authMsg.style.color = 'var(--primary-600)'; }

      try {
        const client = getSupabase();
        if (!client) {
          if (authMsg) { authMsg.textContent = 'Error: Unable to connect to server. Please refresh the page.'; authMsg.style.color = 'var(--critical-600)'; }
          return;
        }

        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { name } }
        });

        if (error) {
          if (authMsg) { authMsg.textContent = `Registration failed: ${error.message}`; authMsg.style.color = 'var(--critical-600)'; }
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
          if (authMsg) { authMsg.textContent = 'An account with this email already exists. Please sign in instead.'; authMsg.style.color = 'var(--warning-600)'; }
        } else {
          // Attempt to insert profile record from client-side fallback
          if (data.session) {
            await client.from('guardians').insert([
              { auth_user_id: data.user.id, name: name, email: email }
            ]);
          }
          localStorage.setItem('vg_guardian_user', JSON.stringify({ name, email: data.user.email, id: data.user.id }));
          if (authMsg) { authMsg.textContent = '✅ Account created successfully! Redirecting...'; authMsg.style.color = 'var(--success-600)'; }
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
        }
      } catch (err) {
        if (authMsg) { authMsg.textContent = `Connection error: ${err.message}`; authMsg.style.color = 'var(--critical-600)'; }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const client = getSupabase();
        if (client) {
          await client.auth.signOut();
        }
      } catch (e) {
        console.warn('Sign out error:', e);
      }
      localStorage.removeItem('vg_guardian_user');
      window.location.href = 'login.html';
    });
  }
}

function checkAuthSession() {
  const currentPage = window.location.pathname.split('/').pop();
  const publicPages = ['index.html', 'login.html', ''];
  const user = localStorage.getItem('vg_guardian_user');

  if (!publicPages.includes(currentPage) && !user) {
    window.location.href = 'login.html';
  }

  // Update guardian name in header if logged in
  if (user) {
    try {
      const guardianObj = JSON.parse(user);
      const nameEl = document.getElementById('guardian-name-display');
      if (nameEl) nameEl.textContent = guardianObj.name || 'Guardian';

      const avatarEl = document.querySelector('.avatar-circle');
      if (avatarEl && guardianObj.name) avatarEl.textContent = guardianObj.name.charAt(0).toUpperCase();
    } catch (e) {
      console.warn('Failed to parse user session:', e);
    }
  }
}
