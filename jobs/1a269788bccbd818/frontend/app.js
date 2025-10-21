console.log('SI Website Initialized!');

document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Navigation link clicked!');
    });
});