document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = this.querySelector('input[type="text"]').value;
    const password = this.querySelector('input[type="password"]').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    // Add your login logic here
    console.log('Login attempted with:', { username, password });
    alert('Login functionality to be implemented');
});