document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------
    // AI ასისტენტი (კერძების რეკომენდაცია) — მუშაობს საკვანძო სიტყვების
    // ამოცნობით და არსებული /products/filter API-ს გამოყენებით.
    // რეალური LLM არ გამოიყენება — ეს იაფი და დამოუკიდებელი გადაწყვეტაა.
    // -----------------------------------------------------------------

    const widgetHtml = `
        <div id="ai-assistant-widget">
            <button id="ai-assistant-toggle" aria-label="კერძების დამხმარე">
                <i class="fas fa-robot"></i>
            </button>
            <div id="ai-assistant-panel" class="ai-assistant-panel">
                <div class="ai-assistant-header">
                    <span><i class="fas fa-robot"></i> კერძების დამხმარე</span>
                    <button id="ai-assistant-close" aria-label="დახურვა"><i class="fas fa-times"></i></button>
                </div>
                <div id="ai-assistant-messages" class="ai-assistant-messages"></div>
                <form id="ai-assistant-form" class="ai-assistant-form">
                    <input type="text" id="ai-assistant-input" placeholder="მაგ: რამე ცხარე და იაფი მინდა" autocomplete="off">
                    <button type="submit" aria-label="გაგზავნა"><i class="fas fa-paper-plane"></i></button>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHtml);

    const toggleBtn = document.getElementById('ai-assistant-toggle');
    const panel = document.getElementById('ai-assistant-panel');
    const closeBtn = document.getElementById('ai-assistant-close');
    const messagesEl = document.getElementById('ai-assistant-messages');
    const form = document.getElementById('ai-assistant-form');
    const input = document.getElementById('ai-assistant-input');

    let categoryMap = {};
    let hasGreeted = false;

    const loadCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories`, { headers: { 'X-API-KEY': API_KEY } });
            if (!res.ok) return;
            const data = await res.json();
            const payload = data.data ?? data;
            const list = payload.categories ?? (Array.isArray(payload) ? payload : []);
            list.forEach(c => { if (c?.name && c?.id != null) categoryMap[c.name.toLowerCase()] = c.id; });
        } catch (err) {
            console.error('AI assistant: categories load error', err);
        }
    };

    const addMessage = (html, sender) => {
        const bubble = document.createElement('div');
        bubble.className = `ai-msg ai-msg-${sender}`;
        bubble.innerHTML = html;
        messagesEl.appendChild(bubble);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const renderDishCards = (dishes) => {
        if (!dishes || dishes.length === 0) {
            addMessage('ვერაფერი შესაბამისი ვიპოვე — სცადე სხვანაირად აღწერო რა გინდა.', 'bot');
            return;
        }
        const cardsHtml = dishes.slice(0, 4).map(d => `
            <div class="ai-dish-card">
                <img src="${d.image || 'images/chef.png'}" alt="${d.name}">
                <div class="ai-dish-info">
                    <strong>${d.name}</strong>
                    <span class="ai-dish-price">$${(d.price ?? 0).toFixed(2)}</span>
                    <button class="btn-signup add-to-cart-btn" data-id="${d.id}">Add to Cart</button>
                </div>
            </div>
        `).join('');
        addMessage(`<div class="ai-dish-cards">${cardsHtml}</div>`, 'bot');
    };

    // საკვანძო სიტყვების რუქა კატეგორიებთან შესატყვისად
    const categoryKeywords = {
        'desserts': ['დესერტი', 'ტკბილი', 'dessert', 'ნამცხვარი'],
        'pizzas': ['პიცა', 'pizza'],
        'appetizers': ['სალათი', 'აპეტაიზერი', 'appetizer', 'საუზმე'],
        'main courses': ['მთავარი კერძი', 'საუზმე', 'ძირითადი'],
        'first courses': ['სუპი', 'პირველი კერძი', 'soup'],
        'side dishes': ['გვერდითი კერძი', 'თანხლები', 'side dish']
    };

    const findCategoryId = (text) => {
        for (const [catName, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(k => text.includes(k))) {
                const id = categoryMap[catName];
                if (id != null) return id;
            }
        }
        return null;
    };

    const parseAndSearch = async (rawText) => {
        const text = rawText.toLowerCase().trim();
        const params = new URLSearchParams();
        params.set('Take', 8);
        params.set('Page', 1);

        let spicyWanted = false;
        let cheapWanted = false;
        let expensiveWanted = false;

        if (/ვეგეტარიან|vegetarian/.test(text)) {
            params.set('Vegetarian', 'true');
        }
        if (/ცხარე|ცხარიან|spicy/.test(text)) {
            spicyWanted = true;
        }
        if (/იაფი|დაბალ ფას|cheap/.test(text)) {
            cheapWanted = true;
            params.set('MaxPrice', 10);
        }
        if (/ძვირ|expensive|პრემიუმ/.test(text)) {
            expensiveWanted = true;
            params.set('MinPrice', 15);
        }
        const categoryId = findCategoryId(text);
        if (categoryId != null) params.set('CategoryId', categoryId);

        try {
            const res = await fetch(`${API_URL}/products/filter?${params.toString()}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const payload = data.data ?? data;
            let dishes = payload.products ?? [];

            // Spiciness API-ს ფილტრი ზუსტ დონეზეა, ამიტომ "ცხარე"-სთვის კლიენტის მხარეს ვასუფთავებთ (>=3)
            if (spicyWanted) {
                dishes = dishes.filter(d => (d.spiciness ?? 0) >= 3);
            }

            const introText = cheapWanted || expensiveWanted || spicyWanted || categoryId != null || /ვეგეტარიან/.test(text)
                ? 'აი, რაც შემოგთავაზე:'
                : 'ზუსტად ვერ გავიგე რა გინდოდა, მაგრამ აი პოპულარული კერძები:';

            addMessage(introText, 'bot');
            renderDishCards(dishes);
        } catch (err) {
            addMessage('ვიცოდი, რომ ეს მოხდებოდა 😅 სცადე ცოტა ხნის შემდეგ ხელახლა.', 'bot');
        }
    };

    const greet = () => {
        if (hasGreeted) return;
        hasGreeted = true;
        addMessage('გამარჯობა! 👋 მითხარი რა გინდა სჭამო (მაგ. „ცხარე და იაფი", „ვეგეტარიანული პიცა") და შემოგთავაზებ კერძებს.', 'bot');
    };

    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) greet();
    });

    closeBtn.addEventListener('click', () => panel.classList.remove('active'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        addMessage(text, 'user');
        input.value = '';
        parseAndSearch(text);
    });

    loadCategories();
});
