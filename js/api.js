// [수정사항: 2026-05-19] 품목 추가(POST /api/products) API 연동 추가
const CONFIG = {
    API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
        ? 'http://localhost:3000'
        : 'https://tm-stock-server.onrender.com',
    USE_MOCK: false
};

const API_ENDPOINTS = {
    PRODUCTS: `${CONFIG.API_BASE_URL}/api/products`,
    MOVEMENTS: `${CONFIG.API_BASE_URL}/api/movements`
};

const API = {
    async getProducts() {
        if (CONFIG.USE_MOCK) return this._getMockProducts();
        try {
            const response = await fetch(API_ENDPOINTS.PRODUCTS);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching products:', error);
            alert('데이터를 불러오는데 실패했습니다.');
            return [];
        }
    },

    async getMovements(days = 7) {
        if (CONFIG.USE_MOCK) return [];
        try {
            const response = await fetch(`${API_ENDPOINTS.MOVEMENTS}?days=${days}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching movements:', error);
            return [];
        }
    },

    async postMovement(payload) {
        if (CONFIG.USE_MOCK) return { success: true };
        try {
            const response = await fetch(API_ENDPOINTS.MOVEMENTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error posting movement:', error);
            // [수정사항 2026-05-19] alert 제거하고 실패 상태만 반환하여 상위 컴포넌트에서 일괄 처리
            return { success: false };
        }
    },

    // [신규 2026-05-19] 로그인 검증
    async login(id, password) {
        if (CONFIG.USE_MOCK) return { success: true, name: '테스트유저' };
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password })
            });
            return await response.json();
        } catch (error) {
            console.error('Error logging in:', error);
            return { success: false, error: '서버 통신 실패' };
        }
    },

    // [수정사항 2026-05-19] 1. 품목 추가 기능 관련 API 메서드 추가
    async postProduct(payload) {
        if (CONFIG.USE_MOCK) return { success: true };
        try {
            const response = await fetch(API_ENDPOINTS.PRODUCTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error posting product:', error);
            alert('품목 추가에 실패했습니다.');
            return { success: false };
        }
    },

    _getMockProducts() {
        return [];
    }
};
