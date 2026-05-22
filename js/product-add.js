// [수정사항: 2026-05-19] 1. SKU 폼 제외 및 자동생성 제거
document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('user_name')) {
        window.location.replace('login.html');
        return;
    }
    const form = document.getElementById('productAddForm');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const categorySelect = document.getElementById('category');
    const unitSelect = document.getElementById('unit');
    const locationSelect = document.getElementById('location');
    const supplierSelect = document.getElementById('supplier');

    // 기존 데이터 로딩
    const products = await API.getProducts();

    // 카테고리, 단위, 보관위치, 거래처 셀렉트 박스 채우기
    const populateSelect = (selectElement, key) => {
        const uniqueValues = [...new Set(products.map(p => p[key]).filter(Boolean))];
        uniqueValues.forEach(val => {
            const option = document.createElement('option');
            option.value = val;
            option.text = val;
            selectElement.appendChild(option);
        });
    };

    populateSelect(categorySelect, 'category');
    populateSelect(unitSelect, 'unit');
    populateSelect(locationSelect, 'location');
    populateSelect(supplierSelect, 'supplier');

    // 초기 로딩 오버레이 숨기기
    loadingOverlay.classList.add('hidden');

    // 폼 제출 이벤트
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            item_name: document.getElementById('itemName').value,
            category: categorySelect.value,
            unit: unitSelect.value,
            min_stock_level: parseInt(document.getElementById('minStock').value) || 0,
            location: locationSelect.value,
            supplier: supplierSelect.value
        };

        loadingOverlay.querySelector('p').textContent = '저장 중입니다...';
        loadingOverlay.classList.remove('hidden');

        const result = await API.postProduct(payload);

        loadingOverlay.classList.add('hidden');

        if (result && result.success) {
            alert('품목이 성공적으로 추가되었습니다!');
            window.location.href = 'index.html'; // 저장 완료 후 홈으로 이동
        }
    });
});
