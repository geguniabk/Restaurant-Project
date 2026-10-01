document.addEventListener('DOMContentLoaded', () => {
    // ნაწილი 2.5: Menu გვერდი — ფილტრები, ძებნა, პაგინაცია (Prev/Next)
    // -----------------------------------------------------------------
    const menuGrid = document.getElementById('menu-dishes-container');

    if (menuGrid) {
        const productsCountLabel = document.getElementById('products-count');
        const searchInput = document.getElementById('search-input');
        const categoryCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
        const clearFiltersBtn = document.getElementById('clear-filters');
        const nextPageBtn = document.getElementById('next-page');
        const prevPageBtn = document.getElementById('prev-page');

        const vegetarianToggle = document.getElementById('filter-vegetarian');
        const spicinessSlider = document.getElementById('filter-spiciness');
        const spicinessLabel = document.getElementById('spiciness-label');
        const clearSpicinessBtn = document.getElementById('clear-spiciness');
        const ratingSlider = document.getElementById('filter-rating');
        const ratingLabel = document.getElementById('rating-label');
        const minPriceSlider = document.getElementById('filter-minprice');
        const minPriceLabel = document.getElementById('minprice-label');
        const maxPriceSlider = document.getElementById('filter-maxprice');
        const maxPriceLabel = document.getElementById('maxprice-label');

        const TAKE = 12;
        let currentPage = 1;
        let hasMore = false;
        let categoryMap = {};
        let searchDebounce = null;
        let spicinessTouched = false;
        let filterDebounce = null;

        const updatePaginationButtons = () => {
            if (nextPageBtn) nextPageBtn.disabled = !hasMore;
            if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
        };

        const renderMenuDishes = (dishes) => {
            if (!dishes || dishes.length === 0) {
                menuGrid.innerHTML = '<p class="error-message">კერძები ვერ მოიძებნა.</p>';
                if (productsCountLabel) productsCountLabel.textContent = 'Showing 0 products';
                return;
            }
            menuGrid.innerHTML = dishes.map(dish => `
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
            if (productsCountLabel) productsCountLabel.textContent = `Showing ${dishes.length} products`;
        };

        const loadCategories = async () => {
            try {
                const res = await fetch(`${API_URL}/categories`, {
                    method: 'GET',
                    headers: { 'X-API-KEY': API_KEY }
                });
                if (!res.ok) return;
                const data = await res.json();
                const payload = data.data || data;
                const list = payload.categories || (Array.isArray(payload) ? payload : []);
                list.forEach(cat => {
                    if (cat && cat.name != null && cat.id != null) categoryMap[cat.name] = cat.id;
                });
            } catch (err) {
                console.error('Error loading categories:', err);
            }
        };

        const getSelectedCategoryId = () => {
            const checked = Array.from(categoryCheckboxes).find(c => c.checked);
            if (!checked) return null;
            return categoryMap[checked.value] ?? null;
        };

        const fetchMenuProducts = async () => {
            const params = new URLSearchParams();
            params.set('Take', TAKE);
            params.set('Page', currentPage);

            const query = searchInput ? searchInput.value.trim() : '';
            if (query) params.set('Query', query);

            const categoryId = getSelectedCategoryId();
            if (categoryId != null) params.set('CategoryId', categoryId);

            if (vegetarianToggle && vegetarianToggle.checked) params.set('Vegetarian', 'true');
            if (spicinessTouched && spicinessSlider) params.set('Spiciness', spicinessSlider.value);

            const minPriceVal = minPriceSlider ? Number(minPriceSlider.value) : 0;
            const maxPriceVal = maxPriceSlider ? Number(maxPriceSlider.value) : 500;
            if (minPriceVal > 0) params.set('MinPrice', minPriceVal);
            if (maxPriceVal < 500) params.set('MaxPrice', maxPriceVal);

            try {
                const res = await fetch(`${API_URL}/products/filter?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'X-API-KEY': API_KEY }
                });
                if (!res.ok) throw new Error('პროდუქტების წამოღება ვერ მოხერხდა');

                const responseData = await res.json();
                const payload = responseData.data || responseData;
                let dishesArray = payload.products || [];
                hasMore = !!payload.hasMore;

                // Rating ფილტრი API-ს დოკუმენტაციაში არ არის, ამიტომ კლიენტის მხარეს ვასუფთავებთ
                const minRating = ratingSlider ? Number(ratingSlider.value) : 0;
                if (minRating > 0) {
                    dishesArray = dishesArray.filter(d => (d.rate || 0) >= minRating);
                }

                renderMenuDishes(dishesArray);
                updatePaginationButtons();
            } catch (err) {
                menuGrid.innerHTML = `<p class="error-message">შეცდომა: ${err.message}</p>`;
            }
        };

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => {
                    currentPage = 1;
                    fetchMenuProducts();
                }, 400);
            });
        }

        categoryCheckboxes.forEach(box => {
            box.addEventListener('change', () => {
                if (box.checked) {
                    categoryCheckboxes.forEach(other => {
                        if (other !== box) other.checked = false;
                    });
                }
                currentPage = 1;
                fetchMenuProducts();
            });
        });

        const refetchDebounced = () => {
            clearTimeout(filterDebounce);
            filterDebounce = setTimeout(() => {
                currentPage = 1;
                fetchMenuProducts();
            }, 300);
        };

        if (vegetarianToggle) {
            vegetarianToggle.addEventListener('change', () => {
                currentPage = 1;
                fetchMenuProducts();
            });
        }

        if (spicinessSlider) {
            spicinessSlider.addEventListener('input', () => {
                spicinessTouched = true;
                if (spicinessLabel) spicinessLabel.textContent = `Level: ${spicinessSlider.value}`;
                refetchDebounced();
            });
        }

        if (clearSpicinessBtn) {
            clearSpicinessBtn.addEventListener('click', () => {
                spicinessTouched = false;
                if (spicinessSlider) spicinessSlider.value = 0;
                if (spicinessLabel) spicinessLabel.textContent = 'Level: not selected';
                currentPage = 1;
                fetchMenuProducts();
            });
        }

        if (ratingSlider) {
            ratingSlider.addEventListener('input', () => {
                if (ratingLabel) ratingLabel.textContent = `${Number(ratingSlider.value).toFixed(1)}+`;
                refetchDebounced();
            });
        }

        if (minPriceSlider) {
            minPriceSlider.addEventListener('input', () => {
                if (minPriceLabel) minPriceLabel.textContent = `$${minPriceSlider.value}`;
                refetchDebounced();
            });
        }

        if (maxPriceSlider) {
            maxPriceSlider.addEventListener('input', () => {
                const val = Number(maxPriceSlider.value);
                if (maxPriceLabel) maxPriceLabel.textContent = val >= 500 ? '$500+' : `$${val}`;
                refetchDebounced();
            });
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                categoryCheckboxes.forEach(box => { box.checked = false; });
                if (vegetarianToggle) vegetarianToggle.checked = false;
                spicinessTouched = false;
                if (spicinessSlider) spicinessSlider.value = 0;
                if (spicinessLabel) spicinessLabel.textContent = 'Level: not selected';
                if (ratingSlider) ratingSlider.value = 0;
                if (ratingLabel) ratingLabel.textContent = '0.0+';
                if (minPriceSlider) minPriceSlider.value = 0;
                if (minPriceLabel) minPriceLabel.textContent = '$0';
                if (maxPriceSlider) maxPriceSlider.value = 500;
                if (maxPriceLabel) maxPriceLabel.textContent = '$500+';
                currentPage = 1;
                fetchMenuProducts();
            });
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (!hasMore) return;
                currentPage += 1;
                fetchMenuProducts();
                window.scrollTo({ top: menuGrid.offsetTop - 100, behavior: 'smooth' });
            });
        }

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (currentPage <= 1) return;
                currentPage -= 1;
                fetchMenuProducts();
                window.scrollTo({ top: menuGrid.offsetTop - 100, behavior: 'smooth' });
            });
        }

        loadCategories().then(() => {
            updatePaginationButtons();
            fetchMenuProducts();
        });
    }

    // -----------------------------------------------------------------
});
