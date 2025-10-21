document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if(password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }
    
    // Add your signup logic here
    alert('Signup successful!');
});

// Real-time password match checker
const passwordInputs = document.querySelectorAll('input[type="password"]');
passwordInputs.forEach(input => {
    input.addEventListener('input', () => {
        const pass = document.getElementById('password').value;
        const confirmPass = document.getElementById('confirmPassword').value;
        if(pass && confirmPass && pass !== confirmPass) {
            input.setCustomValidity('Passwords do not match');
        } else {
            input.setCustomValidity('');
        }
    });
});