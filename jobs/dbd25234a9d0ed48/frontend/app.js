document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    // Add your authentication logic here
    console.log('Username:', username);
    console.log('Password:', password);
    
    alert('Login successful!');
    // window.location.href = '/dashboard';
});