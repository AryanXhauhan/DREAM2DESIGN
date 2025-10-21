document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorMessage = document.getElementById('errorMessage');

    errorMessage.style.display = 'none';

    if (!name || !email || !password || !confirmPassword) {
        errorMessage.textContent = 'All fields are required!';
        errorMessage.style.display = 'block';
        return;
    }

    if (password !== confirmPassword) {
        errorMessage.textContent = 'Passwords do not match!';
        errorMessage.style.display = 'block';
        return;
    }

    // Simulate successful signup
    errorMessage.style.color = '#28a745';
    errorMessage.textContent = 'Signup successful! Redirecting...';
    errorMessage.style.display = 'block';
    
    setTimeout(() => {
        window.location.href = '#';
    }, 2000);
});