document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if(email && password) {
        // Add your login logic here
        alert('Login successful!');
    } else {
        alert('Please fill in all fields');
    }
});