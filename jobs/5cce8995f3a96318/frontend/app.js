document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    
    // Basic email validation
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        // Simulate API call
        console.log('Redirecting to password page...');
    } else {
        alert('Please enter a valid email address');
    }
});