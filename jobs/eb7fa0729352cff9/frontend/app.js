document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const searchParams = new URLSearchParams(formData);
    window.location.href = `search.html?${searchParams}`;
});

// Tab switching functionality
document.querySelectorAll('.tabs button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelector('.tabs button.active').classList.remove('active');
        button.classList.add('active');
    });
});