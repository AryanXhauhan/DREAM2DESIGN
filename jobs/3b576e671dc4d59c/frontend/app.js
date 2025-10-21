// Add these functions to existing app.js
function showSignupModal() {
    document.getElementById('signupModal').classList.remove('hidden');
}

function hideSignupModal() {
    document.getElementById('signupModal').classList.add('hidden');
}

function handleSignup(e) {
    e.preventDefault();
    // Add your signup logic here
    alert('Signup successful!');
    hideSignupModal();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('signupModal');
    if (event.target === modal) {
        hideSignupModal();
    }
}

// Existing code remains below