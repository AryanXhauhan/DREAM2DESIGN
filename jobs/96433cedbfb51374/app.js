document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const password = this.querySelector('input[type="password"]');
    const confirmPassword = this.querySelectorAll('input[type="password"]')[1];

    if(password.value !== confirmPassword.value) {
        alert('Passwords do not match!');
        return;
    }

    // Form submission logic here
    alert('Signup successful!');
    this.reset();
});