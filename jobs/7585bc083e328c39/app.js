// Tab Switching
const tabs = document.querySelectorAll('.tabs button');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

// Form Submission
document.querySelector('.search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    // Add search functionality here
    alert('Search functionality coming soon!');
});