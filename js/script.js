const API_URL = 'https://restaurantapi.stepacademy.ge/api';
const API_KEY = '3588ec56-4ea7-48c3-aa61-78c8270f8766';

function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
        );
        return JSON.parse(jsonPayload);
    } catch (err) {
        return null;
    }
}

function getUserRole(token) {
    const payload = decodeJWT(token);
    if (!payload) return null;
    const roleClaimKeys = [
        'role', 'Role',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
    ];
    for (const key of roleClaimKeys) {
        if (payload[key]) return payload[key];
    }
    return null;
}

// მიმდინარე მომხმარებელი (/users/me) -> { id, firstName, lastName, email, role }
async function fetchCurrentUser(accessToken) {
    try {
        const res = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'X-API-KEY': API_KEY }
        });
        if (res.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            return null;
        }
        if (!res.ok) return null;
        const raw = await res.json();
        return raw.data ?? raw;
    } catch (err) {
        return null;
    }
}

function isAdminRole(role) {
    return typeof role === 'string' && role.toLowerCase().includes('admin');
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('accessToken');

    // -----------------------------------------------------------------
    // ნაწილი 1: ჰედერის ჩატვირთვა + ყველაფერი, რაც header.html-ს სჭირდება
    // (ბურგერ მენიუ, დროპდაუნი, ავტორიზაციის მოდალი)
    // -----------------------------------------------------------------
    const headerPlaceholder = document.getElementById('header-placeholder');

    if (headerPlaceholder) {
        fetch('header.html')
            .then(response => {
                if (!response.ok) throw new Error('Header file not found!');
                return response.text();
            })
            .then(data => {
                headerPlaceholder.innerHTML = data;

                // --- ბურგერ მენიუ ---
                const burgerBtn = document.querySelector('.burger-menu');
                const closeMenuBtn = document.querySelector('.close-menu');
                const navContainer = document.querySelector('.nav-container');

                if (burgerBtn && navContainer) {
                    burgerBtn.addEventListener('click', () => navContainer.classList.add('active'));
                }
                if (closeMenuBtn && navContainer) {
                    closeMenuBtn.addEventListener('click', () => navContainer.classList.remove('active'));
                }
                document.querySelectorAll('.nav-links a').forEach(link => {
                    link.addEventListener('click', () => {
                        if (navContainer) navContainer.classList.remove('active');
                    });
                });

                // --- აქტიური ლინკის გაფერადება ---
                if (window.location.pathname.includes('menu.html')) {
                    const navMenu = document.getElementById('nav-menu');
                    if (navMenu) navMenu.classList.add('active');
                } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                    const navHome = document.getElementById('nav-home');
                    if (navHome) navHome.classList.add('active');
                }

                // --- დალოგინებულის დროპდაუნი ---
                const authButtonsContainer = document.querySelector('.auth-buttons');
                if (token && authButtonsContainer) {
                    authButtonsContainer.innerHTML = `
                        <div class="user-menu-container" style="position: relative; display: inline-block;">
                            <button class="user-icon-btn" id="user-menu-btn" style="background-color: #df4b37; color: white; border: none; border-radius: 8px; width: 40px; height: 40px; cursor: pointer; font-size: 1.2rem;">
                                <i class="far fa-user"></i>
                            </button>
                            <div class="user-dropdown" id="user-dropdown">
                                <div class="dropdown-header">Hello: <span id="display-username-header">...</span></div>
                                <a href="profile.html" class="dropdown-item">Profile</a>
                                <button id="logout-btn" class="dropdown-item">Logout</button>
                            </div>
                        </div>
                    `;

                    const userBtn = document.getElementById('user-menu-btn');
                    const dropdown = document.getElementById('user-dropdown');
                    if (userBtn && dropdown) {
                        userBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            dropdown.classList.toggle('active');
                        });
                        document.addEventListener('click', (e) => {
                            if (!e.target.closest('.user-menu-container')) dropdown.classList.remove('active');
                        });
                    }

                    const logoutBtn = document.getElementById('logout-btn');
                    if (logoutBtn) {
                        logoutBtn.addEventListener('click', () => {
                            localStorage.removeItem('accessToken');
                            localStorage.removeItem('refreshToken');
                            location.reload();
                        });
                    }

                    fetchCurrentUser(token).then(u => {
                        if (!u) {
                            // ტოკენს ვადა გასვლია: გასუფთავებულია, ვტვირთავთ გამოსული მდგომარეობით
                            if (!localStorage.getItem('accessToken')) location.reload();
                            return;
                        }
                        const hdrName = document.getElementById('display-username-header');
                        if (hdrName) hdrName.textContent = u.firstName || 'User';
                        if (isAdminRole(u.role) && logoutBtn) {
                            const adminLink = document.createElement('a');
                            adminLink.href = 'admin.html';
                            adminLink.className = 'dropdown-item';
                            adminLink.textContent = 'Admin Panel';
                            logoutBtn.before(adminLink);
                        }
                    });
                }

                // -----------------------------------------------------------------
                // კალათა: დროპდაუნი, რაოდენობა, წაშლა, checkout
                // -----------------------------------------------------------------
                const cartIconBtn = document.getElementById('cart-icon-btn');
                const cartDropdown = document.getElementById('cart-dropdown');
                const cartItemsList = document.getElementById('cart-items-list');
                const cartTotalAmount = document.getElementById('cart-total-amount');
                const cartCountBadge = document.getElementById('cart-count');
                const checkoutBtn = document.getElementById('checkout-btn');

                const getToken = () => localStorage.getItem('accessToken');

                const updateCartBadge = (count) => {
                    if (!cartCountBadge) return;
                    if (count > 0) {
                        cartCountBadge.textContent = count;
                        cartCountBadge.style.display = 'inline-flex';
                    } else {
                        cartCountBadge.style.display = 'none';
                    }
                };

                const renderCart = (items) => {
                    if (!cartItemsList) return;
                    if (!items || items.length === 0) {
                        cartItemsList.innerHTML = '<p class="cart-empty">კალათა ცარიელია</p>';
                        if (cartTotalAmount) cartTotalAmount.textContent = '$0.00';
                        updateCartBadge(0);
                        return;
                    }

                    let total = 0;
                    cartItemsList.innerHTML = items.map(item => {
                        const price = item.price ?? item.product?.price ?? 0;
                        const qty = item.quantity ?? 1;
                        total += price * qty;
                        const name = item.name ?? item.product?.name ?? 'პროდუქტი';
                        const itemId = item.id ?? item.itemId;
                        return `
                            <div class="cart-item" data-item-id="${itemId}">
                                <span class="cart-item-name">${name}</span>
                                <div class="cart-item-qty">
                                    <button class="qty-btn qty-minus" data-item-id="${itemId}" data-qty="${qty}">-</button>
                                    <span>${qty}</span>
                                    <button class="qty-btn qty-plus" data-item-id="${itemId}" data-qty="${qty}">+</button>
                                </div>
                                <span class="cart-item-price">$${(price * qty).toFixed(2)}</span>
                                <button class="cart-item-remove" data-item-id="${itemId}"><i class="fas fa-trash"></i></button>
                            </div>
                        `;
                    }).join('');

                    if (cartTotalAmount) cartTotalAmount.textContent = `$${total.toFixed(2)}`;
                    updateCartBadge(items.reduce((sum, i) => sum + (i.quantity ?? 1), 0));
                };

                const fetchCart = async () => {
                    const t = getToken();
                    if (!t) { renderCart([]); return; }
                    try {
                        const res = await fetch(`${API_URL}/cart`, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${t}`, 'X-API-KEY': API_KEY }
                        });
                        if (!res.ok) { renderCart([]); return; }
                        const data = await res.json();
                        const payload = data.data ?? data;
                        const items = payload.items ?? payload.cartItems ?? (Array.isArray(payload) ? payload : []);
                        renderCart(items);
                    } catch (err) {
                        console.error('Cart fetch error:', err);
                    }
                };

                // გლობალურად ხელმისაწვდომი, რომ Add to Cart-მაც განაახლოს დროპდაუნი
                window.refreshCartUI = fetchCart;

                if (cartIconBtn && cartDropdown) {
                    cartIconBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const willOpen = !cartDropdown.classList.contains('active');
                        cartDropdown.classList.toggle('active');
                        if (willOpen) fetchCart();
                    });
                    document.addEventListener('click', (e) => {
                        if (!e.target.closest('.cart-menu-container')) cartDropdown.classList.remove('active');
                    });
                }

                if (cartItemsList) {
                    cartItemsList.addEventListener('click', async (e) => {
                        const t = getToken();
                        if (!t) return;

                        const removeBtn = e.target.closest('.cart-item-remove');
                        if (removeBtn) {
                            const itemId = removeBtn.dataset.itemId;
                            try {
                                await fetch(`${API_URL}/cart/remove-from-cart/${itemId}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${t}`, 'X-API-KEY': API_KEY }
                                });
                                fetchCart();
                            } catch (err) { console.error(err); }
                            return;
                        }

                        const qtyBtn = e.target.closest('.qty-btn');
                        if (qtyBtn) {
                            const itemId = qtyBtn.dataset.itemId;
                            const currentQty = Number(qtyBtn.dataset.qty);
                            const newQty = qtyBtn.classList.contains('qty-plus') ? currentQty + 1 : currentQty - 1;
                            if (newQty < 1) return;
                            try {
                                const res = await fetch(`${API_URL}/cart/edit-quantity`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${t}`,
                                        'X-API-KEY': API_KEY
                                    },
                                    body: JSON.stringify({ itemId: Number(itemId), quantity: newQty })
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok || data.isSuccess === false) {
                                    console.error('Edit quantity failed:', data.error || data);
                                }
                                fetchCart();
                            } catch (err) { console.error(err); }
                        }
                    });
                }

                if (checkoutBtn) {
                    checkoutBtn.addEventListener('click', async () => {
                        const t = getToken();
                        if (!t) return;
                        checkoutBtn.disabled = true;
                        const original = checkoutBtn.textContent;
                        try {
                            const res = await fetch(`${API_URL}/cart/checkout`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${t}`, 'X-API-KEY': API_KEY }
                            });
                            if (!res.ok) throw new Error();
                            checkoutBtn.textContent = 'შეკვეთა გაფორმდა ✓';
                            fetchCart();
                            setTimeout(() => { checkoutBtn.textContent = original; checkoutBtn.disabled = false; }, 1500);
                        } catch (err) {
                            checkoutBtn.textContent = 'შეცდომა';
                            setTimeout(() => { checkoutBtn.textContent = original; checkoutBtn.disabled = false; }, 1500);
                        }
                    });
                }

                if (token) fetchCart();

                // -----------------------------------------------------------------
                // ავტორიზაცია, რეგისტრაცია, ვერიფიკაცია
                // (მოდალი ახლა header.html-შია, ამიტომ აქ ვამუშავებთ,
                //  მას შემდეგ რაც headerPlaceholder.innerHTML უკვე ჩასმულია)
                // -----------------------------------------------------------------
                const modal = document.getElementById('auth-modal');
                const closeBtn = document.getElementById('close-modal');
                const tabLogin = document.getElementById('tab-login');
                const tabRegister = document.getElementById('tab-register');
                const loginForm = document.getElementById('login-form');
                const registerForm = document.getElementById('register-form');
                const verifyForm = document.getElementById('verify-form');
                const authMessage = document.getElementById('auth-message');
                const loginLink = document.querySelector('.login-link');
                const signupBtn = document.querySelector('.btn-signup');

                let pendingEmail = '';
                const VERIFY_URL = `${API_URL}/auth/verify-email`;
                const RESEND_URL = (email) => `${API_URL}/auth/resend-email-verification/${encodeURIComponent(email)}`;

                const showMessage = (text, type) => {
                    if (!authMessage) return;
                    authMessage.className = `message ${type}`;
                    authMessage.textContent = text;
                };

                const hideAllForms = () => {
                    [loginForm, registerForm, verifyForm].forEach(f => f && f.classList.remove('active'));
                    [tabLogin, tabRegister].forEach(t => t && t.classList.remove('active'));
                };

                const showVerifyStep = (email) => {
                    pendingEmail = email;
                    const verifyEmailLabel = document.getElementById('verify-email');
                    if (verifyEmailLabel) verifyEmailLabel.textContent = email;
                    hideAllForms();
                    if (verifyForm) verifyForm.classList.add('active');
                    showMessage('კოდი გამოგზავნილია ელფოსტაზე', 'success');
                };

                const openModal = (isLogin) => {
                    if (!modal) return;
                    modal.classList.add('active');
                    showMessage('', '');
                    if (isLogin) { if (tabLogin) tabLogin.click(); }
                    else { if (tabRegister) tabRegister.click(); }
                };

                if (loginLink) {
                    loginLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        openModal(true);
                        if (navContainer) navContainer.classList.remove('active');
                    });
                }
                if (signupBtn) {
                    signupBtn.addEventListener('click', () => {
                        openModal(false);
                        if (navContainer) navContainer.classList.remove('active');
                    });
                }

                if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
                if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

                if (tabLogin) {
                    tabLogin.addEventListener('click', () => {
                        hideAllForms(); tabLogin.classList.add('active');
                        if (loginForm) loginForm.classList.add('active');
                        showMessage('', '');
                    });
                }

                if (tabRegister) {
                    tabRegister.addEventListener('click', () => {
                        hideAllForms(); tabRegister.classList.add('active');
                        if (registerForm) registerForm.classList.add('active');
                        showMessage('', '');
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
                                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                                body: JSON.stringify(payload)
                            });
                            if (res.ok) {
                                registerForm.reset(); showVerifyStep(payload.email);
                            } else {
                                const errData = await res.json().catch(() => ({}));
                                const details = errData.errors ? Object.values(errData.errors).flat().join(' | ') : '';
                                throw new Error(details || errData.detail || errData.title || 'შეცდომა რეგისტრაციისას');
                            }
                        } catch (err) { showMessage(err.message, 'error'); }
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
                                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                                body: JSON.stringify(payload)
                            });
                            if (res.ok) {
                                const data = await res.json();
                                localStorage.setItem('accessToken', data.accessToken);
                                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                                showMessage('წარმატებული შესვლა!', 'success');

                                const me = await fetchCurrentUser(data.accessToken);
                                const isAdmin = isAdminRole(me?.role ?? getUserRole(data.accessToken));
                                setTimeout(() => {
                                    if (isAdmin) {
                                        window.location.href = 'admin.html';
                                    } else {
                                        location.reload();
                                    }
                                }, 1000);
                            } else {
                                const errData = await res.json().catch(() => ({}));
                                const msg = (errData.detail || errData.title || '').toLowerCase();
                                if (msg.includes('verif')) { showVerifyStep(payload.email); return; }
                                throw new Error('არასწორი Email ან პაროლი');
                            }
                        } catch (err) { showMessage(err.message, 'error'); }
                    });
                }

                if (verifyForm) {
                    verifyForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const code = document.getElementById('verify-code').value.trim();
                        try {
                            const res = await fetch(VERIFY_URL, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                                body: JSON.stringify({ email: pendingEmail, code })
                            });
                            if (!res.ok) {
                                const errData = await res.json().catch(() => ({}));
                                const details = errData.errors ? Object.values(errData.errors).flat().join(' | ') : '';
                                throw new Error(details || errData.detail || 'კოდი არასწორია');
                            }
                            verifyForm.reset(); hideAllForms();
                            if (tabLogin) tabLogin.classList.add('active');
                            if (loginForm) {
                                loginForm.classList.add('active');
                                const loginEmailInput = document.getElementById('login-email');
                                if (loginEmailInput) loginEmailInput.value = pendingEmail;
                            }
                            showMessage('ვერიფიკაცია წარმატებულია! ახლა შედით ანგარიშში.', 'success');
                        } catch (err) { showMessage(err.message, 'error'); }
                    });

                    const resendBtn = document.getElementById('resend-code');
                    if (resendBtn) {
                        resendBtn.addEventListener('click', async () => {
                            try {
                                const res = await fetch(RESEND_URL(pendingEmail), { method: 'POST', headers: { 'X-API-KEY': API_KEY } });
                                if (!res.ok) throw new Error('კოდის გაგზავნა ვერ მოხერხდა');
                                showMessage('ახალი კოდი გამოგზავნილია', 'success');
                            } catch (err) { showMessage(err.message, 'error'); }
                        });
                    }
                }
            })
            .catch(error => console.error('Error loading header:', error));
    }

    // -----------------------------------------------------------------
    // ფუტერის ჩატვირთვა (footer.html) — ყველა გვერდზე ერთი და იგივე
    // -----------------------------------------------------------------
    const footerPlaceholder = document.getElementById('footer-placeholder');

    if (footerPlaceholder) {
        fetch('footer.html')
            .then(response => {
                if (!response.ok) throw new Error('Footer file not found!');
                return response.text();
            })
            .then(html => { footerPlaceholder.innerHTML = html; })
            .catch(error => console.error('Error loading footer:', error));
    }

    // -----------------------------------------------------------------
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
    // ნაწილი 2.6: კალათაში დამატება (index.html + menu.html)
    // -----------------------------------------------------------------
    document.addEventListener('click', async (e) => {
        const cartBtn = e.target.closest('.add-to-cart-btn');
        if (!cartBtn) return;

        const currentToken = localStorage.getItem('accessToken');
        if (!currentToken) {
            const loginLinkEl = document.querySelector('.login-link');
            if (loginLinkEl) loginLinkEl.click();
            return;
        }

        const productId = Number(cartBtn.dataset.id);
        const originalText = cartBtn.textContent;
        cartBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/cart/add-to-cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': API_KEY,
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({ productId, quantity: 1 })
            });

            if (!res.ok) throw new Error('კალათაში დამატება ვერ მოხერხდა');

            cartBtn.textContent = 'დამატებულია ✓';
            if (window.refreshCartUI) window.refreshCartUI();
            setTimeout(() => {
                cartBtn.textContent = originalText;
                cartBtn.disabled = false;
            }, 1200);
        } catch (err) {
            cartBtn.textContent = 'შეცდომა';
            setTimeout(() => {
                cartBtn.textContent = originalText;
                cartBtn.disabled = false;
            }, 1500);
        }
    });

    // -----------------------------------------------------------------
    // ნაწილი 3: პროფილის გვერდი (profile.html)
    // -----------------------------------------------------------------
    const profileForm = document.getElementById('profile-form');

    if (profileForm) {
        if (!token) {
            window.location.href = 'index.html';
        } else {
            const authHeaders = (extra = {}) => ({
                'X-API-KEY': API_KEY,
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                ...extra
            });

            const passwordForm = document.getElementById('password-form');
            const profileMsg = document.getElementById('profile-message');
            const passwordMsg = document.getElementById('password-message');
            const accountMsg = document.getElementById('account-message');
            const avatarBox = document.getElementById('profile-avatar');
            const avatarImg = document.getElementById('profile-img-preview');
            const avatarInitials = document.getElementById('profile-initials');
            const pictureInput = document.getElementById('prof-picture');
            const firstNameInput = document.getElementById('prof-firstname');
            const lastNameInput = document.getElementById('prof-lastname');

            const setMsg = (el, text, type) => {
                if (!el) return;
                el.className = text ? `form-message ${type}` : 'form-message';
                el.textContent = text;
            };

            const readBody = (res) => res.json().catch(() => ({}));

            const errorFrom = (data, fallback) => {
                const details = data.errors ? Object.values(data.errors).flat().join(' | ') : '';
                return details || data.error?.message || data.detail || data.title || fallback;
            };

            const forceLogout = () => {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = 'index.html';
            };

            const showAvatar = (url, first, last) => {
                const initials = `${(first || '').trim().charAt(0)}${(last || '').trim().charAt(0)}`.toUpperCase() || '?';
                if (avatarInitials) avatarInitials.textContent = initials;
                if (!avatarBox || !avatarImg) return;
                if (url) {
                    avatarBox.classList.remove('no-image');
                    avatarImg.src = url;
                } else {
                    avatarBox.classList.add('no-image');
                    avatarImg.removeAttribute('src');
                }
            };

            if (avatarImg) {
                avatarImg.addEventListener('error', () => avatarBox.classList.add('no-image'));
            }

            const refreshAvatarFromInputs = () => {
                showAvatar(pictureInput.value.trim(), firstNameInput.value, lastNameInput.value);
            };
            [pictureInput, firstNameInput, lastNameInput].forEach(inp => {
                if (inp) inp.addEventListener('input', refreshAvatarFromInputs);
            });

            const setValue = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.value = value ?? '';
            };

            const loadProfile = async () => {
                try {
                    const res = await fetch(`${API_URL}/users/profile`, { headers: authHeaders() });
                    if (res.status === 401) return forceLogout();
                    const raw = await readBody(res);
                    if (!res.ok) throw new Error(errorFrom(raw, 'პროფილის ჩატვირთვა ვერ მოხერხდა'));

                    const u = raw.data ?? raw;
                    setValue('prof-picture', u.picture);
                    setValue('prof-firstname', u.firstName);
                    setValue('prof-lastname', u.lastName);
                    setValue('prof-email', u.email);
                    setValue('prof-phone', u.phoneNumber);
                    setValue('prof-address', u.address);
                    setValue('prof-age', u.age ? u.age : '');
                    setValue('pw-username', u.email);

                    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User';
                    const nameEl = document.getElementById('summary-name');
                    const emailEl = document.getElementById('summary-email');
                    const sinceEl = document.getElementById('summary-since');
                    if (nameEl) nameEl.textContent = fullName;
                    if (emailEl) emailEl.textContent = u.email || '';
                    if (sinceEl) {
                        const created = u.createdAt ? new Date(u.createdAt) : null;
                        sinceEl.textContent = created && !isNaN(created)
                            ? `Member since ${created.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
                            : '';
                        sinceEl.style.display = sinceEl.textContent ? 'inline-block' : 'none';
                    }

                    showAvatar((u.picture || '').trim(), u.firstName, u.lastName);
                } catch (err) {
                    console.error('Profile load error:', err);
                    const nameEl = document.getElementById('summary-name');
                    const emailEl = document.getElementById('summary-email');
                    if (nameEl) nameEl.textContent = 'პროფილი ვერ ჩაიტვირთა';
                    if (emailEl) emailEl.textContent = err.message;
                    setMsg(profileMsg, err.message, 'error');
                }
            };

            // --- პირადი ინფორმაციის შენახვა ---
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const saveBtn = profileForm.querySelector('.btn-save');
                const ageValue = document.getElementById('prof-age').value;
                const payload = {
                    firstName: firstNameInput.value.trim(),
                    lastName: lastNameInput.value.trim(),
                    phoneNumber: document.getElementById('prof-phone').value.trim(),
                    picture: pictureInput.value.trim(),
                    address: document.getElementById('prof-address').value.trim(),
                    age: ageValue === '' ? 0 : Number(ageValue)
                };

                saveBtn.disabled = true;
                setMsg(profileMsg, '', '');
                try {
                    const res = await fetch(`${API_URL}/users/edit`, {
                        method: 'PUT',
                        headers: authHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify(payload)
                    });
                    if (res.status === 401) return forceLogout();
                    const data = await readBody(res);
                    if (!res.ok || data.isSuccess === false) {
                        throw new Error(errorFrom(data, 'შენახვა ვერ მოხერხდა'));
                    }
                    setMsg(profileMsg, 'ცვლილებები შენახულია!', 'success');
                    const hdrName = document.getElementById('display-username-header');
                    if (hdrName) hdrName.textContent = payload.firstName || 'User';
                    loadProfile();
                } catch (err) {
                    setMsg(profileMsg, err.message, 'error');
                } finally {
                    saveBtn.disabled = false;
                }
            });

            // --- პაროლის შეცვლა ---
            if (passwordForm) {
                passwordForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const current = document.getElementById('current-password').value;
                    const next = document.getElementById('new-password').value;
                    const confirmPw = document.getElementById('confirm-password').value;
                    const submitBtn = passwordForm.querySelector('.btn-save');

                    if (next !== confirmPw) {
                        return setMsg(passwordMsg, 'ახალი პაროლები არ ემთხვევა ერთმანეთს', 'error');
                    }
                    if (next === current) {
                        return setMsg(passwordMsg, 'ახალი პაროლი უნდა განსხვავდებოდეს ძველისგან', 'error');
                    }

                    // ველების ზუსტი სახელები Swagger-იდან დასადასტურებელია;
                    // სინონიმებს ერთად ვუგზავნით, ზედმეტ ველებს სერვერი უგულებელყოფს
                    const payload = {
                        currentPassword: current,
                        oldPassword: current,
                        newPassword: next,
                        confirmPassword: confirmPw
                    };

                    submitBtn.disabled = true;
                    setMsg(passwordMsg, '', '');
                    try {
                        const res = await fetch(`${API_URL}/users/change-password`, {
                            method: 'PUT',
                            headers: authHeaders({ 'Content-Type': 'application/json' }),
                            body: JSON.stringify(payload)
                        });
                        if (res.status === 401) return forceLogout();
                        const data = await readBody(res);
                        if (!res.ok || data.isSuccess === false) {
                            throw new Error(errorFrom(data, 'პაროლის შეცვლა ვერ მოხერხდა'));
                        }
                        passwordForm.reset();
                        setMsg(passwordMsg, 'პაროლი წარმატებით შეიცვალა!', 'success');
                    } catch (err) {
                        setMsg(passwordMsg, err.message, 'error');
                    } finally {
                        submitBtn.disabled = false;
                    }
                });
            }

            // --- გასვლა და ანგარიშის წაშლა ---
            const logoutAccountBtn = document.getElementById('logout-account-btn');
            const deleteBtn = document.getElementById('delete-account-btn');
            const deleteConfirm = document.getElementById('delete-confirm');
            const deleteYes = document.getElementById('delete-confirm-yes');
            const deleteNo = document.getElementById('delete-confirm-no');

            if (logoutAccountBtn) logoutAccountBtn.addEventListener('click', forceLogout);

            if (deleteBtn && deleteConfirm) {
                deleteBtn.addEventListener('click', () => {
                    deleteConfirm.hidden = false;
                    deleteBtn.hidden = true;
                });
            }
            if (deleteNo) {
                deleteNo.addEventListener('click', () => {
                    deleteConfirm.hidden = true;
                    deleteBtn.hidden = false;
                });
            }
            if (deleteYes) {
                deleteYes.addEventListener('click', async () => {
                    deleteYes.disabled = true;
                    setMsg(accountMsg, '', '');
                    try {
                        const res = await fetch(`${API_URL}/users/delete`, {
                            method: 'DELETE',
                            headers: authHeaders()
                        });
                        if (res.status === 401) return forceLogout();
                        const data = await readBody(res);
                        if (!res.ok || data.isSuccess === false) {
                            throw new Error(errorFrom(data, 'ანგარიშის წაშლა ვერ მოხერხდა'));
                        }
                        forceLogout();
                    } catch (err) {
                        setMsg(accountMsg, err.message, 'error');
                        deleteYes.disabled = false;
                    }
                });
            }

            loadProfile();
        }
    }

    // -----------------------------------------------------------------
    // ნაწილი 4: პროფილის ტაბების გადართვა (profile.html)
    // -----------------------------------------------------------------
    const profileTabs = document.querySelectorAll('.profile-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (profileTabs.length > 0) {
        profileTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                profileTabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');

                const targetContent = document.getElementById(`tab-${tab.getAttribute('data-tab')}`);
                if (targetContent) targetContent.classList.add('active');
            });
        });
    }

    // -----------------------------------------------------------------
    // ნაწილი 5: Admin Panel (admin.html) — კატეგორიები და პროდუქტები
    // -----------------------------------------------------------------
    const adminProductsList = document.getElementById('admin-products-list');

    if (adminProductsList) {
        // დაცვა: მხოლოდ admin როლის მქონემ ნახოს ეს გვერდი
        const meUser = token ? await fetchCurrentUser(token) : null;
        const isAdminUser = isAdminRole(meUser?.role ?? (token ? getUserRole(token) : null));
        if (!token || !isAdminUser) {
            window.location.href = 'index.html';
        } else {
            const addCategoryForm = document.getElementById('add-category-form');
            const categoryMessage = document.getElementById('category-message');
            const addProductForm = document.getElementById('add-product-form');
            const productMessage = document.getElementById('product-message');
            const prodCategorySelect = document.getElementById('prod-category');

            const loadCategoriesIntoSelect = async () => {
                try {
                    const res = await fetch(`${API_URL}/categories`, {
                        method: 'GET',
                        headers: { 'X-API-KEY': API_KEY }
                    });
                    if (!res.ok) return;
                    const data = await res.json();
                    const payload = data.data ?? data;
                    const list = payload.categories ?? (Array.isArray(payload) ? payload : []);
                    if (prodCategorySelect) {
                        prodCategorySelect.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                    }
                    const adminCategoriesList = document.getElementById('admin-categories-list');
                    if (adminCategoriesList) {
                        adminCategoriesList.innerHTML = list.map(c => `
                            <div class="admin-product-row">
                                <span class="admin-product-name">${c.name}</span>
                                ${c.canDelete
                                    ? `<button class="btn-text admin-delete-category-btn" data-id="${c.id}">წაშლა</button>`
                                    : `<span class="btn-text-small" style="opacity:0.5">წაშლა არ შეიძლება</span>`}
                            </div>
                        `).join('');
                    }
                } catch (err) {
                    console.error('Error loading categories:', err);
                }
            };

            const loadAdminProducts = async () => {
                try {
                    const res = await fetch(`${API_URL}/products?Take=100`, {
                        method: 'GET',
                        headers: { 'X-API-KEY': API_KEY, 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error('პროდუქტების წამოღება ვერ მოხერხდა');
                    const data = await res.json();
                    const payload = data.data ?? data;
                    const products = payload.products ?? [];

                    if (products.length === 0) {
                        adminProductsList.innerHTML = '<p>პროდუქტები არ მოიძებნა.</p>';
                        return;
                    }

                    adminProductsList.innerHTML = products.map(p => `
                        <div class="admin-product-row" data-id="${p.id}">
                            <span class="admin-product-name">${p.name}</span>
                            <span class="admin-product-price">$${(p.price ?? 0).toFixed(2)}</span>
                            ${p.canDelete
                                ? `<button class="btn-text admin-delete-btn" data-id="${p.id}">წაშლა</button>`
                                : `<span class="btn-text-small" style="opacity:0.5">წაშლა არ შეიძლება</span>`}
                        </div>
                    `).join('');
                } catch (err) {
                    adminProductsList.innerHTML = `<p class="error-message">შეცდომა: ${err.message}</p>`;
                }
            };

            if (addCategoryForm) {
                addCategoryForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const name = document.getElementById('cat-name').value;
                    try {
                        const res = await fetch(`${API_URL}/categories`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': API_KEY,
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ name })
                        });
                        if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            const details = errData.errors ? Object.values(errData.errors).flat().join(' | ') : '';
                            throw new Error(details || errData.detail || 'შეცდომა კატეგორიის დამატებისას');
                        }
                        addCategoryForm.reset();
                        categoryMessage.className = 'message success';
                        categoryMessage.textContent = 'კატეგორია დაემატა!';
                        loadCategoriesIntoSelect();
                    } catch (err) {
                        categoryMessage.className = 'message error';
                        categoryMessage.textContent = err.message;
                    }
                });
            }

            if (addProductForm) {
                addProductForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = {
                        name: document.getElementById('prod-name').value,
                        description: document.getElementById('prod-description').value,
                        categoryId: Number(prodCategorySelect.value),
                        price: Number(document.getElementById('prod-price').value),
                        spiciness: Number(document.getElementById('prod-spiciness').value),
                        image: document.getElementById('prod-image').value,
                        vegetarian: document.getElementById('prod-vegetarian').checked,
                        method: document.getElementById('prod-method').value,
                        ingredients: document.getElementById('prod-ingredients').value
                            .split(',')
                            .map(i => i.trim())
                            .filter(Boolean)
                    };
                    try {
                        const res = await fetch(`${API_URL}/products`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': API_KEY,
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(payload)
                        });
                        if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            const details = errData.errors ? Object.values(errData.errors).flat().join(' | ') : '';
                            throw new Error(details || errData.detail || 'შეცდომა პროდუქტის დამატებისას');
                        }
                        addProductForm.reset();
                        productMessage.className = 'message success';
                        productMessage.textContent = 'პროდუქტი დაემატა!';
                        loadAdminProducts();
                    } catch (err) {
                        productMessage.className = 'message error';
                        productMessage.textContent = err.message;
                    }
                });
            }

            adminProductsList.addEventListener('click', async (e) => {
                const delBtn = e.target.closest('.admin-delete-btn');
                if (!delBtn) return;
                const id = delBtn.dataset.id;
                try {
                    const res = await fetch(`${API_URL}/products/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}`, 'X-API-KEY': API_KEY }
                    });
                    if (!res.ok) throw new Error();
                    loadAdminProducts();
                } catch (err) {
                    alert('პროდუქტის წაშლა ვერ მოხერხდა.');
                }
            });

            const adminCategoriesListEl = document.getElementById('admin-categories-list');
            if (adminCategoriesListEl) {
                adminCategoriesListEl.addEventListener('click', async (e) => {
                    const delBtn = e.target.closest('.admin-delete-category-btn');
                    if (!delBtn) return;
                    try {
                        const res = await fetch(`${API_URL}/categories/${delBtn.dataset.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}`, 'X-API-KEY': API_KEY }
                        });
                        if (!res.ok) throw new Error();
                        loadCategoriesIntoSelect();
                    } catch (err) {
                        alert('კატეგორიის წაშლა ვერ მოხერხდა (შესაძლოა მასში პროდუქტებია).');
                    }
                });
            }

            loadCategoriesIntoSelect();
            loadAdminProducts();
        }
    }
});
