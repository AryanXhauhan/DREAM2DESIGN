// Mock market data
const cryptoData = [
    { symbol: 'BTC/USD', price: '42,500', change: '+2.4%' },
    { symbol: 'ETH/USD', price: '3,200', change: '-1.2%' },
    { symbol: 'XRP/USD', price: '0.85', change: '+0.8%' }
];

const forexData = [
    { pair: 'EUR/USD', price: '1.1250', change: '+0.3%' },
    { pair: 'GBP/USD', price: '1.3450', change: '-0.5%' },
    { pair: 'USD/JPY', price: '110.25', change: '+0.2%' }
];

function populateTable(data, tableId) {
    const table = document.getElementById(tableId);
    table.innerHTML = data.map(item => 
        `<div class="table-row">
            <span>${item.symbol || item.pair}</span>
            <span>$${item.price}</span>
            <span class="change ${item.change.startsWith('+') ? 'positive' : 'negative'}">${item.change}</span>
        </div>`
    ).join('');
}

// Initialize tables
populateTable(cryptoData, 'crypto-table');
populateTable(forexData, 'forex-table');

// Simulate real-time updates
setInterval(() => {
    cryptoData.forEach(item => {
        item.price = (Math.random() * 1000 + 40000).toFixed(0);
        item.change = Math.random() > 0.5 ? `+${(Math.random()*3).toFixed(1)}%` : `-${(Math.random()*2).toFixed(1)}%`;
    });
    populateTable(cryptoData, 'crypto-table');
}, 3000);

// Event Listeners
document.querySelector('.cta-btn').addEventListener('click', () => {
    alert('Trading interface coming soon!');
});