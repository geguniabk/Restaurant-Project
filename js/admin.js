document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('accessToken');

    // ნაწილი 5: Admin Panel (admin.html) — კატეგორიები და პროდუქტები
    // -----------------------------------------------------------------
    const adminProductsList = document.getElementById('admin-products-list');

    if (adminProductsList) {
        // ⚠️ დემო-რეჟიმი: API-ს role ვერ ვანიჭებთ ჩვენი მხრიდან, ამიტომ
        // ვიზუალური დემოსთვის კონკრეტულ email-ს ვუშვებთ admin.html-ზე.
        // (ფორმების submit-ი მაინც API-ს namdvili role-permission-ზეა
        // დამოკიდებული — თუ ბაზაში admin არ ხარ, add/edit/delete 401/403-ს დააბრუნებს.)
        const ADMIN_DEMO_EMAIL = 'geguniabk@gmail.com';

        // დაცვა: admin როლის მქონემ ან დემო-email-ის მფლობელმა ნახოს ეს გვერდი
        const meUser = token ? await fetchCurrentUser(token) : null;
        const isAdminUser = isAdminRole(meUser?.role ?? (token ? getUserRole(token) : null))
            || meUser?.email === ADMIN_DEMO_EMAIL;
        if (!token || !isAdminUser) {
            window.location.href = 'index.html';
        } else {
            const addCategoryForm = document.getElementById('add-category-form');
            const categoryMessage = document.getElementById('category-message');
            const addProductForm = document.getElementById('add-product-form');
            const productMessage = document.getElementById('product-message');
            const prodCategorySelect = document.getElementById('prod-category');
            const productFormTitle = document.getElementById('product-form-title');
            const productSubmitBtn = addProductForm ? addProductForm.querySelector('button[type="submit"]') : null;
            const cancelEditBtn = document.getElementById('cancel-edit-btn');

            let editingProductId = null;
            let cachedProducts = [];

            const resetProductForm = () => {
                editingProductId = null;
                addProductForm.reset();
                if (productSubmitBtn) productSubmitBtn.textContent = 'დამატება';
                if (productFormTitle) productFormTitle.textContent = 'ახალი პროდუქტი';
                if (cancelEditBtn) cancelEditBtn.style.display = 'none';
            };

            const enterEditMode = (product) => {
                editingProductId = product.id;
                document.getElementById('prod-name').value = product.name || '';
                document.getElementById('prod-description').value = product.description || '';
                if (prodCategorySelect) prodCategorySelect.value = product.categoryId ?? '';
                document.getElementById('prod-price').value = product.price ?? 0;
                document.getElementById('prod-spiciness').value = product.spiciness ?? 0;
                document.getElementById('prod-image').value = product.image || '';
                document.getElementById('prod-method').value = product.method || '';
                document.getElementById('prod-ingredients').value = (product.ingredients || []).join(', ');
                document.getElementById('prod-vegetarian').checked = !!product.vegetarian;

                if (productSubmitBtn) productSubmitBtn.textContent = 'განახლება';
                if (productFormTitle) productFormTitle.textContent = 'პროდუქტის რედაქტირება';
                if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';

                addProductForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };

            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', resetProductForm);
            }

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
                    cachedProducts = products;

                    if (products.length === 0) {
                        adminProductsList.innerHTML = '<p>პროდუქტები არ მოიძებნა.</p>';
                        return;
                    }

                    adminProductsList.innerHTML = products.map(p => `
                        <div class="admin-product-row" data-id="${p.id}">
                            <span class="admin-product-name">${p.name}</span>
                            <span class="admin-product-price">$${(p.price ?? 0).toFixed(2)}</span>
                            <div style="display:flex; gap:10px;">
                                <button class="btn-text admin-edit-btn" data-id="${p.id}">რედაქტირება</button>
                                ${p.canDelete
                                    ? `<button class="btn-text admin-delete-btn" data-id="${p.id}">წაშლა</button>`
                                    : `<span class="btn-text-small" style="opacity:0.5">წაშლა არ შეიძლება</span>`}
                            </div>
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

                    const isEditing = editingProductId !== null;
                    const url = isEditing ? `${API_URL}/products/${editingProductId}` : `${API_URL}/products`;
                    const method = isEditing ? 'PUT' : 'POST';

                    try {
                        const res = await fetch(url, {
                            method,
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
                            throw new Error(details || errData.detail || `შეცდომა პროდუქტის ${isEditing ? 'განახლებისას' : 'დამატებისას'}`);
                        }
                        const successText = isEditing ? 'პროდუქტი განახლდა!' : 'პროდუქტი დაემატა!';
                        resetProductForm();
                        productMessage.className = 'message success';
                        productMessage.textContent = successText;
                        loadAdminProducts();
                    } catch (err) {
                        productMessage.className = 'message error';
                        productMessage.textContent = err.message;
                    }
                });
            }

            adminProductsList.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.admin-edit-btn');
                if (editBtn) {
                    const id = Number(editBtn.dataset.id);
                    const product = cachedProducts.find(p => p.id === id);
                    if (product) enterEditMode(product);
                    return;
                }

                const delBtn = e.target.closest('.admin-delete-btn');
                if (!delBtn) return;
                const id = delBtn.dataset.id;
                try {
                    const res = await fetch(`${API_URL}/products/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}`, 'X-API-KEY': API_KEY }
                    });
                    if (!res.ok) throw new Error();
                    if (editingProductId === Number(id)) resetProductForm();
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
