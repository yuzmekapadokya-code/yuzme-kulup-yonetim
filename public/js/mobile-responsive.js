(function () {
    window.refreshMobileLayout = function refreshMobileLayout() {
        if (window.PanelEnhancements?.ensureTableResponsiveWrappers) {
            window.PanelEnhancements.ensureTableResponsiveWrappers();
        }
        if (window.PanelEnhancements?.convertTablesToMobileCards) {
            window.PanelEnhancements.convertTablesToMobileCards();
        }
    };

    const MOBILE_BREAKPOINT = 768;
    const ACTIVE_LINK_PADDING = 20;
    const CONTENT_SCROLL_PADDING = 14;
    const MOBILE_CONTENT_SCROLL_DELAY = 180;
    let pendingContentScrollTimer = null;
    let pendingNavLinkScrollFrame = null;
    let suppressSidebarAutoScrollUntil = 0;

    function getElements() {
        return {
            body: document.body,
            sidebar: document.querySelector('.sidebar'),
            header: document.querySelector('.header'),
            dashboard: document.querySelector('.dashboard'),
        };
    }

    function isMobileViewport() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function ensureOverlay() {
        let overlay = document.querySelector('.mobile-sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-sidebar-overlay';
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function ensureToggleButton(header) {
        if (!header) {
            return null;
        }

        let toggle = document.querySelector('.sidebar-toggle');
        if (!toggle) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'sidebar-toggle';
            toggle.setAttribute('aria-label', 'Menüyü aç veya kapat');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.innerHTML = '&#9776;';
            header.insertBefore(toggle, header.firstChild);
        }

        return toggle;
    }

    function syncBottomNavMoreState(open) {
        const moreButton = document.querySelector('.mobile-bottom-nav-item[data-page="__more__"]');
        if (!moreButton) {
            return;
        }
        moreButton.classList.toggle('active', !!open);
        moreButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function setSidebarState(open) {
        const { body, sidebar } = getElements();
        const overlay = ensureOverlay();
        const toggle = document.querySelector('.sidebar-toggle');

        if (!sidebar) {
            return;
        }

        if (!isMobileViewport()) {
            sidebar.classList.remove('mobile-hidden');
            body.classList.remove('mobile-nav-open');
            overlay.classList.remove('active');
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
            }
            syncBottomNavMoreState(false);
            return;
        }

        sidebar.classList.toggle('mobile-hidden', !open);
        body.classList.toggle('mobile-nav-open', open);
        overlay.classList.toggle('active', open);
        if (toggle) {
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        syncBottomNavMoreState(!!open);
    }

    function getResolvedScrollBehavior(behavior = 'smooth') {
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return prefersReducedMotion ? 'auto' : behavior;
    }

    function shouldSuppressSidebarAutoScroll() {
        return isMobileViewport() && Date.now() < suppressSidebarAutoScrollUntil;
    }

    function cancelPendingNavLinkScroll() {
        if (pendingNavLinkScrollFrame !== null) {
            window.cancelAnimationFrame(pendingNavLinkScrollFrame);
            pendingNavLinkScrollFrame = null;
        }
    }

    function markSidebarManualInteraction() {
        suppressSidebarAutoScrollUntil = Date.now() + 900;
        cancelPendingNavLinkScroll();
    }

    function isRootScrollContainer(container) {
        return container === document.body || container === document.documentElement || container === document.scrollingElement;
    }

    function getMainScrollContainer() {
        return document.querySelector('.main-content') || document.scrollingElement || document.documentElement || document.body;
    }

    function isElementVisible(element) {
        if (!element) {
            return false;
        }

        const computedStyles = window.getComputedStyle(element);
        if (computedStyles.display === 'none' || computedStyles.visibility === 'hidden') {
            return false;
        }

        return element.getClientRects().length > 0;
    }

    function getHeaderOffset() {
        const { header } = getElements();
        if (!header || !isElementVisible(header)) {
            return CONTENT_SCROLL_PADDING;
        }

        const headerStyles = window.getComputedStyle(header);
        if (headerStyles.position !== 'sticky' && headerStyles.position !== 'fixed') {
            return CONTENT_SCROLL_PADDING;
        }

        return Math.ceil(header.getBoundingClientRect().height) + CONTENT_SCROLL_PADDING;
    }

    function getSidebarScrollContainer(sidebar) {
        const navMenu = sidebar.querySelector('.nav-menu');
        if (!navMenu) {
            return sidebar;
        }

        const navMenuStyles = window.getComputedStyle(navMenu);
        const canScrollWithinNav = navMenu.scrollHeight > navMenu.clientHeight + 4 && navMenuStyles.overflowY !== 'visible';
        return canScrollWithinNav ? navMenu : sidebar;
    }

    function scrollElementWithinContainer(container, element, options) {
        if (!container || !element) {
            return;
        }

        const behavior = getResolvedScrollBehavior(options.behavior || 'smooth');
        const align = options.align || 'nearest';
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const currentScrollTop = container.scrollTop;
        const relativeTop = elementRect.top - containerRect.top + currentScrollTop;
        const relativeBottom = relativeTop + elementRect.height;
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        let nextScrollTop = currentScrollTop;

        if (align === 'center') {
            const desiredCenterLine = Math.max(56, container.clientHeight * 0.42);
            nextScrollTop = relativeTop - desiredCenterLine + (elementRect.height / 2);
        } else {
            const visibleTop = currentScrollTop + ACTIVE_LINK_PADDING;
            const visibleBottom = currentScrollTop + container.clientHeight - ACTIVE_LINK_PADDING;
            if (relativeTop < visibleTop) {
                nextScrollTop = relativeTop - ACTIVE_LINK_PADDING;
            } else if (relativeBottom > visibleBottom) {
                nextScrollTop = relativeBottom - container.clientHeight + ACTIVE_LINK_PADDING;
            }
        }

        nextScrollTop = Math.min(maxScrollTop, Math.max(0, nextScrollTop));
        if (Math.abs(nextScrollTop - currentScrollTop) < 2) {
            return;
        }

        container.scrollTo({
            top: nextScrollTop,
            behavior,
        });
    }

    function getActivePageName(fallbackPageName = '') {
        return document.querySelector('.nav-link.active')?.dataset?.page || fallbackPageName || '';
    }

    function getActivePageTarget(pageName) {
        const candidates = [];

        if (pageName) {
            candidates.push(document.getElementById(pageName + '-page'));
            candidates.push(document.getElementById(pageName + '-section'));

            if (pageName === 'dashboard') {
                candidates.push(document.querySelector('.dashboard-grid'));
            }
        }

        const activePage = Array.from(document.querySelectorAll('.page-content')).find(function (page) {
            return page.classList.contains('active') && isElementVisible(page);
        }) || Array.from(document.querySelectorAll('.page-content')).find(function (page) {
            return isElementVisible(page);
        });

        candidates.push(activePage);
        candidates.push(document.querySelector('.main-content .card'));

        return candidates.find(isElementVisible) || null;
    }

    function scrollMainContentToTarget(targetElement, options = {}) {
        const container = getMainScrollContainer();
        const behavior = getResolvedScrollBehavior(options.behavior || 'smooth');
        const offset = options.offset ?? getHeaderOffset();

        if (!container) {
            if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                targetElement.scrollIntoView({ behavior, block: 'start' });
                return;
            }

            window.scrollTo({ top: 0, left: 0, behavior });
            return;
        }

        const useWindowScroll = isRootScrollContainer(container);

        if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
            const targetRect = targetElement.getBoundingClientRect();
            const containerTop = useWindowScroll ? 0 : container.getBoundingClientRect().top;
            const currentScrollTop = useWindowScroll
                ? (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0)
                : container.scrollTop;
            const nextScrollTop = Math.max(0, Math.round(currentScrollTop + targetRect.top - containerTop - offset));

            if (useWindowScroll) {
                window.scrollTo({ top: nextScrollTop, left: 0, behavior });
            } else {
                container.scrollTo({ top: nextScrollTop, left: 0, behavior });
            }
            return;
        }

        if (useWindowScroll) {
            window.scrollTo({ top: 0, left: 0, behavior });
            return;
        }

        container.scrollTo({ top: 0, left: 0, behavior });
    }

    function scheduleActiveContentScroll(options = {}) {
        if (pendingContentScrollTimer) {
            window.clearTimeout(pendingContentScrollTimer);
        }

        const delay = Number.isFinite(options.delay) ? options.delay : 0;
        pendingContentScrollTimer = window.setTimeout(function () {
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    const pageName = getActivePageName(options.pageName);
                    const targetElement = getActivePageTarget(pageName);
                    scrollMainContentToTarget(targetElement, {
                        behavior: options.behavior || 'smooth',
                    });
                });
            });
        }, Math.max(0, delay));
    }

    function scrollActiveNavLinkIntoView(options = {}) {
        const { sidebar } = getElements();
        const activeLink = document.querySelector('.nav-link.active');
        if (!sidebar || !activeLink) {
            return;
        }

        if (shouldSuppressSidebarAutoScroll()) {
            return;
        }

        const container = getSidebarScrollContainer(sidebar);
        const align = options.align || (isMobileViewport() ? 'center' : 'nearest');
        scrollElementWithinContainer(container, activeLink, {
            behavior: options.behavior || 'smooth',
            align,
        });
    }

    function scheduleActiveNavLinkScroll(options = {}) {
        cancelPendingNavLinkScroll();
        pendingNavLinkScrollFrame = window.requestAnimationFrame(function () {
            pendingNavLinkScrollFrame = window.requestAnimationFrame(function () {
                pendingNavLinkScrollFrame = null;
                scrollActiveNavLinkIntoView(options);
            });
        });
    }

    function observeActiveNavLinkChanges() {
        const navLinks = document.querySelectorAll('.nav-link');
        if (!navLinks.length || typeof MutationObserver === 'undefined') {
            return;
        }

        const observer = new MutationObserver(function (mutations) {
            const hasActiveStateChange = mutations.some(function (mutation) {
                return mutation.type === 'attributes' && mutation.attributeName === 'class';
            });

            if (hasActiveStateChange) {
                scheduleActiveNavLinkScroll();
                scheduleActiveContentScroll({
                    behavior: 'smooth',
                    delay: isMobileViewport() ? MOBILE_CONTENT_SCROLL_DELAY : 0,
                });
            }
        });

        navLinks.forEach(function (link) {
            observer.observe(link, {
                attributes: true,
                attributeFilter: ['class'],
            });
        });
    }

    function observePageContentChanges() {
        const pages = document.querySelectorAll('.page-content');
        if (!pages.length || typeof MutationObserver === 'undefined') {
            return;
        }

        const observer = new MutationObserver(function (mutations) {
            const hasVisibilityChange = mutations.some(function (mutation) {
                return mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style');
            });

            if (hasVisibilityChange) {
                scheduleActiveContentScroll({
                    behavior: 'smooth',
                    delay: isMobileViewport() ? 80 : 0,
                });
            }
        });

        pages.forEach(function (page) {
            observer.observe(page, {
                attributes: true,
                attributeFilter: ['class', 'style'],
            });
        });
    }

    function initializeMobileNavigation() {
        const { sidebar, header, dashboard } = getElements();
        if (!sidebar || !header || !dashboard) {
            return;
        }

        const overlay = ensureOverlay();
        const toggle = ensureToggleButton(header);
        if (!toggle) {
            return;
        }

        const sidebarInteractionEvents = ['touchstart', 'pointerdown', 'wheel'];
        sidebarInteractionEvents.forEach(function (eventName) {
            sidebar.addEventListener(eventName, markSidebarManualInteraction, { passive: true });
        });

        if (isMobileViewport()) {
            sidebar.classList.add('mobile-hidden');
        } else {
            sidebar.classList.remove('mobile-hidden');
        }

        toggle.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const shouldOpen = sidebar.classList.contains('mobile-hidden');
            setSidebarState(shouldOpen);
        });

        overlay.addEventListener('click', function () {
            setSidebarState(false);
        });

        document.addEventListener('click', function (event) {
            if (!isMobileViewport()) {
                return;
            }

            const currentToggle = document.querySelector('.sidebar-toggle');
            if (!currentToggle || sidebar.classList.contains('mobile-hidden')) {
                return;
            }

            const target = event.target;
            if (!target || target.nodeType !== 1) {
                return;
            }

            // Alt menudeki "Menu" butonu sidebar'i acmak icin de kapatmak icin de kullanilabilir;
            // outside-click kontrolu bu alani disari tiklama saymamali.
            const bottomNav = target.closest && target.closest('.mobile-bottom-nav');
            if (bottomNav) {
                return;
            }

            if (!sidebar.contains(target) && !currentToggle.contains(target)) {
                setSidebarState(false);
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                setSidebarState(false);
            }
        });

        document.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                const requestedPage = link.dataset.page || '';
                scheduleActiveNavLinkScroll({
                    behavior: 'smooth',
                    align: isMobileViewport() ? 'center' : 'nearest',
                });
                if (isMobileViewport()) {
                    setSidebarState(false);
                }
                scheduleActiveContentScroll({
                    behavior: 'smooth',
                    pageName: requestedPage,
                    delay: isMobileViewport() ? MOBILE_CONTENT_SCROLL_DELAY : 0,
                });
            });
        });

        observeActiveNavLinkChanges();
        observePageContentChanges();
        if (!isMobileViewport()) {
            scheduleActiveNavLinkScroll({
                behavior: 'auto',
                align: 'nearest',
            });
        }
        scheduleActiveContentScroll({
            behavior: 'auto',
            delay: isMobileViewport() ? 60 : 0,
        });

        window.addEventListener('resize', function () {
            if (isMobileViewport()) {
                setSidebarState(false);
                sidebar.classList.add('mobile-hidden');
            } else {
                setSidebarState(false);
                sidebar.classList.remove('mobile-hidden');
            }
            scheduleActiveContentScroll({
                behavior: 'auto',
                delay: isMobileViewport() ? 60 : 0,
            });
        }, { passive: true });
    }

    document.addEventListener('DOMContentLoaded', initializeMobileNavigation);
})();