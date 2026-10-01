document.addEventListener('DOMContentLoaded', () => {
    // კალათაში დამატება (index.html + menu.html)
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
});
