function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Basic validation
    if(username && password) {
        alert('Login successful!');
        // Add your login logic here
    } else {
        alert('Please fill in all fields');
    }
}