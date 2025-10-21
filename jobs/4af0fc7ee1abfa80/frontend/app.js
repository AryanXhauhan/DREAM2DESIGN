document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Basic validation
    if(email && password) {
        alert('Login successful!');
        // Add your login logic here
    } else {
        alert('Please fill in all fields');
    }
});

// Signup link click handler
document.querySelector('.signup-link a').addEventListener('click', function(e) {
    e.preventDefault();
    alert('Redirect to signup page');
});