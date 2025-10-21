document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if(username && password) {
        // Add your login logic here
        alert('Login successful!');
    } else {
        alert('Please fill in all fields');
    }
});

// Input field validation
const inputs = document.querySelectorAll('input');
inputs.forEach(input => {
    input.addEventListener('input', () => {
        input.classList.remove('error');
    });
});