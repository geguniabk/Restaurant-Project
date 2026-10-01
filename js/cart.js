document.addEventListener('DOMContentLoaded', () => {
    const contentEl = document.getElementById('cart-page-content');
    if (!contentEl) return;

    const getToken = () => localStorage.getItem('accessToken');

    const renderEmpty = () => {
        contentEl.innerHTML = `
            <div class="cart-page-empty">
                <p>კალათა ცარიელია</p>
                <a href="menu.html">მენიუზე გადასვლა</a>
            </div>
        `;
    };

    const renderNotLoggedIn = () => {
        contentEl.innerHTML = `
            <div class="cart-page-empty">
                <p>კალათის სანახავად საჭიროა ავტორიზაცია</p>
                <a href="index.html">მთავარ გვერდზე დაბრუნება</a>
            </div>
        `;
    };

    const renderItems = (items) => {
        let subtotal = 0;
        const rowsHtml = items.map(item => {
            const price = item.price ?? item.product?.price ?? 0;
            const qty = item.quantity ?? 1;
            const name = item.name ?? item.product?.name ?? 'პროდუქტი';
            const itemId = item.id ?? item.itemId;
            subtotal += price * qty;
            return `
                <div class="cart-page-item" data-item-id="${itemId}">
                    <span class="cart-page-item-name">${name}</span>
                    <div class="cart-page-item-qty">
                        <button class="qty-minus" data-item-id="${itemId}" data-qty="${qty}">-</button>
                        <span>${qty}</span>
                        <button class="qty-plus" data-item-id="${itemId}" data-qty="${qty}">+</button>
                    </div>
                    <span class="cart-page-item-price">$${(price * qty).toFixed(2)}</span>
                    <button class="cart-page-item-remove" data-item-id="${itemId}"><i class="fas fa-trash"></i></button>
                </div>
            `;
        }).join('');

        const tax = subtotal * 0.1;
        const total = subtotal + tax;

        contentEl.innerHTML = `
            <div class="cart-page-list">${rowsHtml}</div>
            <div class="cart-page-summary">
                <div class="cart-page-summary-row">
                    <span>ქვე-ჯამი</span>
                    <span>$${subtotal.toFixed(2)}</span>
                </div>
                <div class="cart-page-summary-row">
                    <span>გადასახადი (10%)</span>
                    <span>$${tax.toFixed(2)}</span>
                </div>
                <div class="cart-page-summary-row total">
                    <span>ჯამი</span>
                    <span>$${total.toFixed(2)}</span>
                </div>
                <button id="confirm-order-btn" class="confirm-order-btn">შეკვეთის დადასტურება</button>
            </div>
        `;

        attachRowEvents();
        attachConfirmEvent();
    };

    const fetchCart = async () => {
        const t = getToken();
        if (!t) { renderNotLoggedIn(); return; }
        try {
            const res = await fetch(`${API_URL}/cart`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${t}`, 'X-API-KEY': API_KEY }
            });
            if (!res.ok) { renderEmpty(); return; }
            const data = await res.json();
            const payload = data.data ?? data;
            const items = payload.items ?? payload.cartItems ?? (Array.isArray(payload) ? payload : []);
            if (!items || items.length === 0) { renderEmpty(); return; }
            renderItems(items);
        } catch (err) {
            console.error('Cart fetch error:', err);
            renderEmpty();
        }
    };

    const attachRowEvents = () => {
        contentEl.querySelectorAll('.cart-page-item-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                const t = getToken();
                if (!t) return;
                const itemId = btn.dataset.itemId;
                try {
                    await fetch(`${API_URL}/cart/remove-from-cart/${itemId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${t}`, 'X-API-KEY': API_KEY }
                    });
                    fetchCart();
                    if (window.refreshCartUI) window.refreshCartUI();
                } catch (err) { console.error(err); }
            });
        });

        contentEl.querySelectorAll('.qty-minus, .qty-plus').forEach(btn => {
            btn.addEventListener('click', async () => {
                const t = getToken();
                if (!t) return;
                const itemId = btn.dataset.itemId;
                const currentQty = Number(btn.dataset.qty);
                const newQty = btn.classList.contains('qty-plus') ? currentQty + 1 : currentQty - 1;
                if (newQty < 1) return;
                try {
                    await fetch(`${API_URL}/cart/edit-quantity`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${t}`,
                            'X-API-KEY': API_KEY
                        },
                        body: JSON.stringify({ itemId: Number(itemId), quantity: newQty })
                    });
                    fetchCart();
                    if (window.refreshCartUI) window.refreshCartUI();
                } catch (err) { console.error(err); }
            });
        });
    };

    const attachConfirmEvent = () => {
        const confirmBtn = document.getElementById('confirm-order-btn');
        if (!confirmBtn) return;
        confirmBtn.addEventListener('click', async () => {
            const t = getToken();
            if (!t) return;
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'მიმდინარეობს...';
            try {
                const res = await fetch(`${API_URL}/cart/checkout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${t}`, 'X-API-KEY': API_KEY }
                });
                if (!res.ok) throw new Error();
                window.location.href = 'order-confirmation.html';
            } catch (err) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'შეცდომა, სცადეთ თავიდან';
            }
        });
    };

    fetchCart();
});
