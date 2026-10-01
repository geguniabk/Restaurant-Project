document.addEventListener('DOMContentLoaded', () => {
    // ნაწილი 2: პროდუქტების წამოღება (index.html)
    // -----------------------------------------------------------------
    const dishesGrid = document.getElementById('dishes-container');

    const renderPopularDishes = (dishes) => {
        if (!dishesGrid) return;
        if (dishes.length === 0) {
            dishesGrid.innerHTML = '<p class="error-message">პროდუქტები ვერ მოიძებნა.</p>';
            return;
        }
        dishesGrid.innerHTML = dishes.map(dish => `
            <div class="dish-card">
                <img src="${dish.image || 'images/chef.png'}" alt="${dish.name || 'Dish'}" class="dish-img">
                <div class="dish-info">
                    <h3>${dish.name || 'კერძი'}</h3>
                    <p class="desc">${dish.description || 'ინფორმაცია არ არის.'}</p>
                    <div class="details">
                        <span class="rating"><i class="fas fa-star"></i> ${dish.rate ? dish.rate.toFixed(1) : '0.0'}</span>
                        <span class="price">$${dish.price ? dish.price.toFixed(2) : '0.00'}</span>
                    </div>
                    <button class="btn-signup w-100 add-to-cart-btn" data-id="${dish.id}">Add to Cart</button>
                </div>
            </div>
        `).join('');
    };

    const fetchDishes = async () => {
        if (!dishesGrid) return;
        try {
            const res = await fetch(`${API_URL}/products?Take=50`, {
                method: 'GET',
                headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' }
            });
            if (!res.ok) throw new Error('პროდუქტების წამოღება ვერ მოხერხდა');
            const responseData = await res.json();

            let dishesArray = responseData.products || responseData.data?.products || responseData || [];
            if (!Array.isArray(dishesArray)) dishesArray = [];

            const popularDishes = dishesArray.sort((a, b) => (b.rate || 0) - (a.rate || 0)).slice(0, 6);
            renderPopularDishes(popularDishes);
        } catch (err) {
            dishesGrid.innerHTML = `<p class="error-message">შეცდომა: ${err.message}</p>`;
        }
    };
    fetchDishes();

    // -----------------------------------------------------------------
});
