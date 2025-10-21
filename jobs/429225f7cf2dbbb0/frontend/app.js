// Tab Switching
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.search-form');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and forms
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding form
        tab.classList.add('active');
        const formId = tab.textContent.toLowerCase() + '-form';
        document.getElementById(formId).classList.add('active');
    });
});

// Form Submission
document.querySelectorAll('.search-form').forEach(form => {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Search functionality coming soon!');
    });
});

// Simple Autocomplete
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Goa', 'Dubai', 'London', 'New York'];
const cityInputs = document.querySelectorAll('input[type="text"]');

cityInputs.forEach(input => {
    input.addEventListener('input', (e) => {
        // Implement autocomplete logic here
    });
});