(function initPanelEnhancements() {
    const MOBILE_TAB_CONFIG = {
        trainer: [
            { page: 'dashboard', label: 'Ana', icon: '🏠' },
            { page: 'performance', label: 'Derece', icon: '⏱️' },
            { page: 'attendance', label: 'Yoklama', icon: '✓' },
            { page: 'chat', label: 'Sohbet', icon: '💬' },
            { page: '__more__', label: 'Menü', icon: '☰' }
        ],
        admin: [
            { page: 'dashboard', label: 'Ana', icon: '🏠' },
            { page: 'schedules', label: 'Saatler', icon: '🕐' },
            { page: 'finance', label: 'Finans', icon: '💰' },
            { page: 'chat', label: 'Sohbet', icon: '💬' },
            { page: '__more__', label: 'Menü', icon: '☰' }
        ],
        secretary: [
            { page: 'registration', label: 'Kayıt', icon: '📝' },
            { page: 'students', label: 'Liste', icon: '👥' },
            { page: 'chat', label: 'Sohbet', icon: '💬' },
            { page: '__more__', label: 'Menü', icon: '☰' }
        ],
        parent: [
            { page: 'dashboard', label: 'Ana', icon: '🏠' },
            { page: 'payments', label: 'Ödeme', icon: '💳' },
            { page: 'attendance', label: 'Devam', icon: '📊' },
            { page: 'chat', label: 'Sohbet', icon: '💬' },
            { page: '__more__', label: 'Menü', icon: '☰' }
        ],
        superadmin: [
            { page: 'dashboard', label: 'Ana', icon: '🏠' },
            { page: 'admins', label: 'Admin', icon: '👤' },
            { page: 'orders', label: 'Sipariş', icon: '📦' },
            { page: 'chat', label: 'Sohbet', icon: '💬' },
            { page: '__more__', label: 'Menü', icon: '☰' }
        ]
    };

    function detectPanelRole() {
        const fromBody = document.body.dataset.panelRole;
        if (fromBody && MOBILE_TAB_CONFIG[fromBody]) {
            return fromBody;
        }
        const path = window.location.pathname || '';
        if (path.includes('trainer')) return 'trainer';
        if (path.includes('admin')) return 'admin';
        if (path.includes('secretary')) return 'secretary';
        if (path.includes('parent')) return 'parent';
        if (path.includes('superadmin')) return 'superadmin';
        return null;
    }

    function debounce(fn, wait) {
        let timer = null;
        return function debounced(...args) {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                timer = null;
                fn.apply(this, args);
            }, wait);
        };
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function switchToPage(pageName) {
        const link = document.querySelector(`.nav-link[data-page="${pageName}"]`);
        if (link) {
            link.click();
            return true;
        }
        if (typeof window.switchPage === 'function') {
            window.switchPage(pageName);
            return true;
        }
        return false;
    }

    function buildMobileBottomNav() {
        if (window.innerWidth > 768 || document.querySelector('.mobile-bottom-nav')) {
            return;
        }

        const tabs = MOBILE_TAB_CONFIG[detectPanelRole()];
        if (!tabs) {
            return;
        }

        const nav = document.createElement('nav');
        nav.className = 'mobile-bottom-nav';
        nav.setAttribute('aria-label', 'Ana menü');

        const inner = document.createElement('div');
        inner.className = 'mobile-bottom-nav-inner';
        inner.style.setProperty('--mobile-nav-cols', String(tabs.length));

        tabs.forEach(tab => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-bottom-nav-item';
            button.dataset.page = tab.page;
            button.innerHTML = `<span class="nav-icon" aria-hidden="true">${tab.icon}</span><span>${escapeHtml(tab.label)}</span>`;
            inner.appendChild(button);
        });

        nav.appendChild(inner);
        document.body.appendChild(nav);

        inner.querySelectorAll('.mobile-bottom-nav-item').forEach(button => {
            button.addEventListener('click', (event) => {
                const page = button.dataset.page;

                inner.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
                    item.classList.toggle('active', item === button && page !== '__more__');
                });

                if (page === '__more__') {
                    // Sidebar dogrudan acilsin; '.sidebar-toggle' uzerinden geri tetiklemek
                    // mobile-responsive.js'teki disari tiklama dinleyicisiyle catisip
                    // menuyu aninda kapatabiliyor. Bu nedenle yerinde DOM guncellemesi yapariz.
                    event.preventDefault();
                    event.stopPropagation();

                    const sidebar = document.querySelector('.sidebar');
                    const overlay = document.querySelector('.mobile-sidebar-overlay');
                    const toggle = document.querySelector('.sidebar-toggle');

                    if (!sidebar) {
                        toggle?.click();
                        return;
                    }

                    const willOpen = sidebar.classList.contains('mobile-hidden');
                    sidebar.classList.toggle('mobile-hidden', !willOpen);
                    document.body.classList.toggle('mobile-nav-open', willOpen);
                    if (overlay) {
                        overlay.classList.toggle('active', willOpen);
                    }
                    if (toggle) {
                        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                    }
                    button.classList.toggle('active', willOpen);
                    button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                    return;
                }

                switchToPage(page);

                const sidebar = document.querySelector('.sidebar');
                if (sidebar && !sidebar.classList.contains('mobile-hidden')) {
                    sidebar.classList.add('mobile-hidden');
                    document.body.classList.remove('mobile-nav-open');
                    document.querySelector('.mobile-sidebar-overlay')?.classList.remove('active');
                    document.querySelector('.sidebar-toggle')?.setAttribute('aria-expanded', 'false');
                }
            });
        });

        syncBottomNavActive();
    }

    function syncBottomNavActive() {
        const activePage = document.querySelector('.nav-link.active')?.dataset?.page;
        document.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
            if (item.dataset.page === '__more__') {
                return;
            }
            item.classList.toggle('active', item.dataset.page === activePage);
        });
    }

    function ensureTableResponsiveWrappers() {
        const root = document.querySelector('.main-content') || document.body;
        root.querySelectorAll('table').forEach(table => {
            if (table.closest('.table-responsive')) {
                return;
            }

            const parent = table.parentElement;
            if (!parent) {
                return;
            }

            if (parent.classList.contains('table-responsive')) {
                return;
            }

            if (parent.tagName === 'DIV' && parent.children.length === 1) {
                parent.classList.add('table-responsive');
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            parent.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }

    function convertTablesToMobileCards() {
        ensureTableResponsiveWrappers();

        if (window.innerWidth > 768) {
            document.querySelectorAll('.table-responsive.use-mobile-cards .mobile-data-cards').forEach(el => el.remove());
            document.querySelectorAll('.table-responsive.use-mobile-cards').forEach(el => el.classList.remove('use-mobile-cards'));
            return;
        }

        document.querySelectorAll('.table-responsive').forEach(wrapper => {
            const table = wrapper.querySelector('table');
            if (!table || wrapper.dataset.mobileCards === 'off') {
                return;
            }

            wrapper.classList.add('use-mobile-cards');

            let cardsHost = wrapper.querySelector('.mobile-data-cards');
            if (!cardsHost) {
                cardsHost = document.createElement('div');
                cardsHost.className = 'mobile-data-cards';
                wrapper.appendChild(cardsHost);
            }

            const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
            const rows = Array.from(table.querySelectorAll('tbody tr'));
            cardsHost.innerHTML = '';

            if (!rows.length) {
                cardsHost.innerHTML = '<p style="padding:16px;color:#64748b;text-align:center;">Kayıt bulunamadı</p>';
                return;
            }

            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                const actionCell = cells[cells.length - 1];
                const hasActions = actionCell && actionCell.querySelector('button');
                const dataCells = hasActions ? cells.slice(0, -1) : cells;

                const article = document.createElement('article');
                article.className = 'mobile-data-card';

                const titleEl = document.createElement('div');
                titleEl.className = 'mobile-data-card-title';
                titleEl.textContent = (dataCells[0]?.textContent || 'Kayıt').trim();
                article.appendChild(titleEl);

                dataCells.forEach((cell, index) => {
                    if (index === 0) {
                        return;
                    }
                    const label = headers[index] || '';
                    if (!label) {
                        return;
                    }
                    const rowEl = document.createElement('div');
                    rowEl.className = 'mobile-data-card-row';
                    const labelSpan = document.createElement('span');
                    labelSpan.textContent = label;
                    const valueSpan = document.createElement('span');
                    valueSpan.textContent = cell.textContent.trim();
                    rowEl.appendChild(labelSpan);
                    rowEl.appendChild(valueSpan);
                    article.appendChild(rowEl);
                });

                if (hasActions) {
                    const actions = document.createElement('div');
                    actions.className = 'mobile-data-card-actions';
                    actions.innerHTML = actionCell.innerHTML;
                    article.appendChild(actions);
                }

                cardsHost.appendChild(article);
            });
        });
    }

    function init() {
        document.body.classList.add('panel-enhanced');

        const role = detectPanelRole();
        if (role) {
            document.body.dataset.panelRole = role;
        }

        buildMobileBottomNav();
        convertTablesToMobileCards();

        const observer = new MutationObserver(debounce(() => {
            convertTablesToMobileCards();
            syncBottomNavActive();
        }, 350));

        const main = document.querySelector('.main-content');
        if (main) {
            observer.observe(main, { childList: true, subtree: true });
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                setTimeout(syncBottomNavActive, 120);
            });
        });

        window.addEventListener('resize', debounce(() => {
            const existing = document.querySelector('.mobile-bottom-nav');
            if (window.innerWidth > 768 && existing) {
                existing.remove();
            } else if (window.innerWidth <= 768 && !existing) {
                buildMobileBottomNav();
            }
            convertTablesToMobileCards();
        }, 200));

        window.PanelEnhancements = {
            debounce,
            ensureTableResponsiveWrappers,
            convertTablesToMobileCards,
            syncBottomNavActive
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
