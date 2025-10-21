document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tabs button');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    document.getElementById('searchForm').addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Search functionality coming soon!');
    });
});
