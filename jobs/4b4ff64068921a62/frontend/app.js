document.getElementById('signinForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password) {
        // Add your authentication logic here
        console.log('Signing in with:', { email, password });
        alert('Sign in successful! Redirecting...');
        // window.location.href = '/dashboard';
    } else {
        alert('Please fill in all fields');
    }
});

// Clear error on input
['email', 'password'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        document.getElementById('error').textContent = '';
    });
});