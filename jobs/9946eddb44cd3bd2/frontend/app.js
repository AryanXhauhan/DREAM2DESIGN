// Handle form submission
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get form values
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Simple validation
    if(username.trim() === '' || password.trim() === '') {
        alert('Please fill in all fields');
        return;
    }
    
    // In a real application, you would send this data to a server
    console.log('Login attempt with:', { username, password });
    
    // Show success message
    alert(`Login successful! Welcome back, ${username}`);
    
    // Reset form
    this.reset();
});

// Add focus effects to inputs
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });
});