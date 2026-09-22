const API_URL = 'https://restaurantapi.stepacademy.ge/api';
const API_KEY = '9e942351-a728-416c-bdab-6667f66cf03a';

document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------
    // ნაწილი 1: პროდუქტების წამოღება და რეიტინგით დალაგება
    // -----------------------------------------------------------------
    const dishesGrid = document.getElementById('dishes-container');

    const fetchDishes = async () => {
        try {
            const res = await fetch(`${API_URL}/products?Take=50`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                throw new Error('პროდუქტების წამოღება ვერ მოხერხდა');
            }

            const responseData = await res.json();

            let dishesArray = [];
            if (responseData.products && Array.isArray(responseData.products)) {
                dishesArray = responseData.products;
            } else if (responseData.data && Array.isArray(responseData.data.products)) {
                dishesArray = responseData.data.products;
            } else if (Array.isArray(responseData)) {
                dishesArray = responseData;
            }

            const popularDishes = dishesArray
                .sort((a, b) => (b.rate || 0) - (a.rate || 0))
                .slice(0, 6); 
            
            renderPopularDishes(popularDishes);
        } catch (err) {
            console.error('Error in dishes fetching:', err);
            if (dishesGrid) {
                dishesGrid.innerHTML = `<p class="error-message">შეცდომა პროდუქტების ჩატვირთვისას: ${err.message}</p>`;
            }
        }
    };

    const renderPopularDishes = (dishes) => {
        if (!dishesGrid) return;

        dishesGrid.innerHTML = '';

        if (dishes.length === 0) {
            dishesGrid.innerHTML = '<p class="error-message">პროდუქტები ვერ მოიძებნა.</p>';
            return;
        }

        dishes.forEach(dish => {
            const dishCard = `
                <div class="dish-card">
                    <img src="${dish.image || 'images/chef.png'}" alt="${dish.name || 'Dish'}" class="dish-img">
                    <div class="dish-info">
                        <h3>${dish.name || 'კერძი'}</h3>
                        <p class="desc">${dish.description || 'ინფორმაცია არ არის.'}</p>
                        <div class="details">
                            <span class="rating"><i class="fas fa-star"></i> ${dish.rate ? dish.rate.toFixed(1) : '0.0'}</span>
                            <span class="price">$${dish.price ? dish.price.toFixed(2) : '0.00'}</span>
                        </div>
                        <button class="btn-signup w-100">Add to Cart</button>
                    </div>
                </div>
            `;
            dishesGrid.innerHTML += dishCard;
        });
    };

    fetchDishes();

    // -----------------------------------------------------------------
    // ნაწილი 2: ავტორიზაცია (მოდალი, Login და Sign Up)
    // -----------------------------------------------------------------
    const modal = document.getElementById('auth-modal');
    const loginLink = document.querySelector('.login-link');
    const signupBtn = document.querySelector('.btn-signup');
    const closeBtn = document.getElementById('close-modal');
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authMessage = document.getElementById('auth-message');

    const openModal = (isLogin) => {
        if (!modal) return;
        modal.classList.add('active');
        if (authMessage) authMessage.textContent = '';
        if (isLogin) {
            if (tabLogin) tabLogin.click();
        } else {
            if (tabRegister) tabRegister.click();
        }
    };

    if (loginLink) loginLink.addEventListener('click', (e) => { e.preventDefault(); openModal(true); });
    if (signupBtn) signupBtn.addEventListener('click', () => openModal(false));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    if (tabLogin) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            if (tabRegister) tabRegister.classList.remove('active');
            if (loginForm) loginForm.classList.add('active');
            if (registerForm) registerForm.classList.remove('active');
            if (authMessage) authMessage.textContent = '';
        });
    }

    if (tabRegister) {
        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('active');
            if (tabLogin) tabLogin.classList.remove('active');
            if (registerForm) registerForm.classList.add('active');
            if (loginForm) loginForm.classList.remove('active');
            if (authMessage) authMessage.textContent = '';
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                firstName: document.getElementById('reg-firstname').value,
                lastName: document.getElementById('reg-lastname').value,
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value
            };

            try {
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-API-KEY': API_KEY 
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    authMessage.className = 'message success';
                    authMessage.textContent = 'რეგისტრაცია წარმატებულია! ახლა გაიარეთ ავტორიზაცია.';
                    registerForm.reset();
                    setTimeout(() => { if (tabLogin) tabLogin.click(); }, 2000); 
                } else {
                    const errData = await res.json();
                    throw new Error(errData.title || errData.message || 'შეცდომა რეგისტრაციისას');
                }
            } catch (err) {
                authMessage.className = 'message error';
                authMessage.textContent = err.message;
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value
            };

            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-API-KEY': API_KEY 
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('accessToken', data.accessToken);
                    if (data.refreshToken) {
                        localStorage.setItem('refreshToken', data.refreshToken);
                    }
                    
                    authMessage.className = 'message success';
                    authMessage.textContent = 'წარმატებული შესვლა!';
                    
                    setTimeout(() => { 
                        if (modal) modal.classList.remove('active'); 
                    }, 1000);
                } else {
                    throw new Error('არასწორი Email ან პაროლი');
                }
            } catch (err) {
                authMessage.className = 'message error';
                authMessage.textContent = err.message;
            }
        });
    }
});
