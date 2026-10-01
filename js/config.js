const API_URL = 'https://restaurantapi.stepacademy.ge/api';
const API_KEY = '3588ec56-4ea7-48c3-aa61-78c8270f8766';

// JWT ტოკენიდან payload-ის ამოკითხვა (მხოლოდ decode)
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
// Newsletter ფორმის ვიზუალური დამუშავება (backend endpoint არ არსებობს)
function initNewsletterForm(scope = document) {
    const form = scope.querySelector('.newsletter-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = form.querySelector('input[type="email"]');
        if (!emailInput || !emailInput.value.trim() || !emailInput.checkValidity()) {
            emailInput?.focus();
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'გმადლობთ! ✓';
        form.reset();

        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = originalText;
        }, 2500);
    });
}

