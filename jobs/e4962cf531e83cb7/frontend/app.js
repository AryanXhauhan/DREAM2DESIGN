document.getElementById('signinForm').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const email = this.querySelector('input[type="email"]').value;
  const password = this.querySelector('input[type="password"]').value;
  
  if(email && password) {
    // Add your authentication logic here
    alert('Sign in successful!');
    this.reset();
  } else {
    alert('Please fill in all fields');
  }
});

// Add hover effect for button
const button = document.querySelector('button');
button.addEventListener('mouseover', () => {
  button.style.transform = 'translateY(-2px)';
});
button.addEventListener('mouseout', () => {
  button.style.transform = 'translateY(0)';
});