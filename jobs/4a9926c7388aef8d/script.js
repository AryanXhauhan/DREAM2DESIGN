document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const password = document.querySelector('input[type="password"]');
    const confirmPassword = document.querySelectorAll('input[type="password"]')[1];
    
    if(password.value !== confirmPassword.value) {
        alert('Passwords do not match!');
        return;
    }
    
    // Add your form submission logic here
    alert('Form submitted successfully!');
});