document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.auth-form').forEach(form => {
                form.classList.remove('active');
            });
            
            document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
        });
    });

    // Login form
    const loginForm = document.getElementById('login');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('token', data.access_token);
                window.location.href = '/static/chat.html';
            } else {
                showMessage('Invalid username or password', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Login failed. Please try again.', 'error');
        }
    });

    // Signup form
    const signupForm = document.getElementById('signup');
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        try {
            const response = await fetch('/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password, role: 'user' })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('Account created successfully! Please login.', 'success');
                // Switch to login tab
                document.querySelector('.tab-btn[data-tab="login"]').click();
            } else {
                showMessage(data.detail || 'Signup failed', 'error');
            }
        } catch (error) {
            console.error('Signup error:', error);
            showMessage('Signup failed. Please try again.', 'error');
        }
    });

    function showMessage(text, type) {
        const messageEl = document.getElementById('auth-message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
    }
});