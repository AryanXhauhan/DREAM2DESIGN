function executeTrade(type) {
    const pair = 'BTC/USD';
    const price = type === 'buy' ? 63420 : 63350;
    const timestamp = new Date().toLocaleTimeString();
    
    const tradeEntry = document.createElement('div');
    tradeEntry.innerHTML = `${timestamp} - ${type.toUpperCase()} ${pair} @ $${price}`;
    tradeEntry.style.color = type === 'buy' ? '#2ecc71' : '#e74c3c';
    
    document.getElementById('tradeList').prepend(tradeEntry);
}

// Simulate price updates
setInterval(() => {
    const priceElements = document.querySelectorAll('.ticker-item');
    priceElements.forEach(el => {
        const currentPrice = parseFloat(el.innerText.match(/\d+,\d+/)[0].replace(',',''));
        const newPrice = currentPrice + (Math.random() * 200 - 100);
        el.innerHTML = el.innerText.replace(/\$\d+,\d+/, `$${newPrice.toLocaleString('en-US', {maximumFractionDigits: 0})}`);
    });
}, 3000);
