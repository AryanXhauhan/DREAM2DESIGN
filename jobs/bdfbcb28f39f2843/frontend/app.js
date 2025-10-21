document.addEventListener('DOMContentLoaded', () => {
    const hotels = [
        {
            name: 'Luxury Resort',
            price: '$299/night',
            image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'
        },
        {
            name: 'City Hotel',
            price: '$159/night',
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945'
        },
        {
            name: 'Beach Villa',
            price: '$399/night',
            image: 'https://images.unsplash.com/photo-1571896349842-480cafe7be45'
        }
    ];

    const hotelContainer = document.getElementById('hotelContainer');

    hotels.forEach(hotel => {
        const card = document.createElement('div');
        card.className = 'hotel-card';
        card.innerHTML = `
            <img src="${hotel.image}" alt="${hotel.name}">
            <div class="hotel-info">
                <h3>${hotel.name}</h3>
                <p>${hotel.price}</p>
                <button class="book-btn">Book Now</button>
            </div>
        `;
        hotelContainer.appendChild(card);
    });

    document.querySelector('.search-btn').addEventListener('click', () => {
        const from = document.querySelector('input[placeholder="From"]').value;
        const to = document.querySelector('input[placeholder="To"]').value;
        const date = document.querySelector('input[type="date"]').value;
        
        if(from && to && date) {
            alert('Searching flights...');
            // Add API integration here
        }
    });
});