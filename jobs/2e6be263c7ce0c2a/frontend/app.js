document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="text"]').value;
    const password = this.querySelector('input[type="password"]').value;
    
    // Basic validation
    if(email && password) {
        alert('Login successful!');
        this.reset();
    } else {
        alert('Please fill in all fields');
    }
});