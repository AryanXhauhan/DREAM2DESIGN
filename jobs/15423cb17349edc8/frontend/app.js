function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  
  // Basic validation
  if(username && password) {
    alert('Login successful!');
    event.target.reset();
  }
}