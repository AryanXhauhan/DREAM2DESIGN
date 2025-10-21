let cartItems = 0;

function addToCart() {
    cartItems++;
    document.querySelector('.cart-counter').textContent = cartItems;
    // In real implementation, add product to cart array
}

// Basic cart functionality
document.querySelector('.cart-counter').addEventListener('click', () => {
    alert(`Cart Items: ${cartItems}\nTotal: ₹${cartItems * 1999}`);
});