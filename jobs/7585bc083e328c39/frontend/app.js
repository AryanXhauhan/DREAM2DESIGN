document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    console.log('Signup Attempt:', { name, email, password });
    alert('Signup successful!');
    this.reset();
});