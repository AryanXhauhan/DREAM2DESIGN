document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Basic validation
    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    // Simulate login success
    console.log('Login attempted with:', { email, password });
    alert('Login successful! Redirecting...');
    
    // Redirect simulation
    setTimeout(() => {
        window.location.href = '/dashboard';
    }, 1500);
});