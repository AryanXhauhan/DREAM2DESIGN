document.addEventListener('DOMContentLoaded', () => {
    // Tab functionality
    const tabs = document.querySelectorAll('.tabs button');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Search form submission
    document.querySelector('.search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        console.log('Search initiated:', data);
        // Add actual search functionality here
    });
});