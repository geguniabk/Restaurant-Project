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
                    checkoutBtn.addEventListener('click', () => {
                        window.location.href = 'cart.html';
                    });
                }

                if (token) fetchCart();

                // -----------------------------------------------------------------
                // ავტორიზაცია, რეგისტრაცია, ვერიფიკაცია, პაროლის აღდგენა
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
                const forgotForm = document.getElementById('forgot-password-form');
                const forgotLink = document.getElementById('forgot-password-link');
                const backToLoginBtn = document.getElementById('back-to-login-btn');

                let pendingEmail = '';
                const VERIFY_URL = `${API_URL}/auth/verify-email`;
                const RESEND_URL = (email) => `${API_URL}/auth/resend-email-verification/${encodeURIComponent(email)}`;

                const showMessage = (text, type) => {
                    if (!authMessage) return;
                    authMessage.className = `message ${type}`;
                    authMessage.textContent = text;
                };

                const hideAllForms = () => {
                    [loginForm, registerForm, verifyForm, forgotForm].forEach(f => f && f.classList.remove('active'));
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
                                // ⚠️ FIX: ზოგჯერ API აბრუნებს { data: { accessToken, ... } },
                                // ზოგჯერ პირდაპირ { accessToken, ... }-ს. ორივეს ვამუშავებთ.
                                const raw = await res.json();
                                const data = raw.data ?? raw;

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

                // --- პაროლის აღდგენა ("დაგავიწყდა პაროლი?") ---
                if (forgotLink) {
                    forgotLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        hideAllForms();
                        if (forgotForm) forgotForm.classList.add('active');
                        showMessage('', '');
                    });
                }

                if (backToLoginBtn) {
                    backToLoginBtn.addEventListener('click', () => {
                        hideAllForms();
                        if (tabLogin) tabLogin.classList.add('active');
                        if (loginForm) loginForm.classList.add('active');
                        showMessage('', '');
                    });
                }

                if (forgotForm) {
                    forgotForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const email = document.getElementById('forgot-email').value;
                        try {
                            const res = await fetch(`${API_URL}/auth/forgot-password/${encodeURIComponent(email)}`, {
                                method: 'POST',
                                headers: { 'X-API-KEY': API_KEY }
                            });
                            if (!res.ok) throw new Error('ელფოსტა ვერ მოიძებნა ან შეცდომა მოხდა');
                            forgotForm.reset();
                            showMessage('შეამოწმეთ ელფოსტა — გამოგზავნილია პაროლის აღდგენის ბმული', 'success');
                        } catch (err) {
                            showMessage(err.message, 'error');
                        }
                    });
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
            .then(html => { footerPlaceholder.innerHTML = html; initNewsletterForm(footerPlaceholder); })
            .catch(error => console.error('Error loading footer:', error));
    }

});
