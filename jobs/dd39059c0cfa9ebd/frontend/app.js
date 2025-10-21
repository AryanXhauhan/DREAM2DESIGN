document.addEventListener('DOMContentLoaded', () => {
    const greeting = document.getElementById('greeting');
    const changeTextBtn = document.getElementById('change-text');
    const resetTextBtn = document.getElementById('reset-text');
    
    const messages = [
        'Hello World',
        'Hola Mundo',
        'Bonjour le Monde',
        'Hallo Welt',
        'Ciao Mondo',
        'こんにちは世界',
        '안녕하세요 세계'
    ];
    
    let currentIndex = 0;
    
    changeTextBtn.addEventListener('click', () => {
        try {
            currentIndex = (currentIndex + 1) % messages.length;
            greeting.textContent = messages[currentIndex];
        } catch (error) {
            console.error('Error changing text:', error);
            greeting.textContent = 'Error occurred';
        }
    });
    
    resetTextBtn.addEventListener('click', () => {
        try {
            currentIndex = 0;
            greeting.textContent = messages[currentIndex];
        } catch (error) {
            console.error('Error resetting text:', error);
            greeting.textContent = 'Error occurred';
        }
    });
});