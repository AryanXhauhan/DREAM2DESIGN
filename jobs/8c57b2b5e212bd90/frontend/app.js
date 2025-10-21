document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    // Add your authentication logic here
    console.log('Login attempted with:', { username, password });
    
    // Redirect to dashboard (example)
    window.location.href = '/dashboard';
});

console.log('Login form handler initialized');