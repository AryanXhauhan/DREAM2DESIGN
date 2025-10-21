document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Searching for flights...');
});

// Add active class to trip type buttons
document.querySelectorAll('.trip-type button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelector('.trip-type button.active').classList.remove('active');
        button.classList.add('active');
    });
});

// Add hover effect to cards
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseover', () => {
        card.style.transform = 'translateY(-5px)';
    });
    card.addEventListener('mouseout', () => {
        card.style.transform = 'none';
    });
});