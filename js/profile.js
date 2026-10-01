document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('accessToken');

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
});
