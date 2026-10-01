document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    if (!form) return;

    const messageEl = document.getElementById('reset-message');
    const showMessage = (text, type) => {
        if (!messageEl) return;
        messageEl.className = `message ${type}`;
        messageEl.textContent = text;
    };

    // token URL query param-იდან: reset-password.html?token=XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showMessage('არასწორი ან ვადაგასული ბმული — სცადეთ თავიდან "დაგავიწყდა პაროლი?"-დან', 'error');
        form.querySelectorAll('input, button').forEach(el => el.disabled = true);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showMessage('პაროლები არ ემთხვევა', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ token, newPassword })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const details = errData.errors ? Object.values(errData.errors).flat().join(' | ') : '';
                throw new Error(details || errData.detail || 'პაროლის განახლება ვერ მოხერხდა');
            }
            form.reset();
            form.querySelectorAll('input, button').forEach(el => el.disabled = true);
            showMessage('პაროლი წარმატებით განახლდა! შეგიძლიათ შეხვიდეთ ახალი პაროლით.', 'success');
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
});
