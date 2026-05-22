document.addEventListener('DOMContentLoaded', async () => {
    // 1. 현재 시간 설정
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - offset)).toISOString().slice(0,16);
    document.getElementById('inDate').value = localISOTime;

    // 2. 요소 참조
    const productSelect = document.getElementById('productSelect');
    const productSearch = document.getElementById('productSearch');
    const quantityInput = document.getElementById('quantity');
    const btnMinus = document.getElementById('btnMinus');
    const btnPlus = document.getElementById('btnPlus');
    const unitText = document.getElementById('unitText');
    const form = document.getElementById('stockInForm');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let products = [];

    // 3. 품목 리스트 불러오기
    products = await API.getProducts();
    
    // 품목 렌더링 함수
    const renderProducts = (searchTerm = '') => {
        productSelect.innerHTML = '';
        const filtered = products.filter(p => p.item_name.includes(searchTerm) || p.sku.includes(searchTerm));
        
        if (filtered.length === 0) {
            const option = document.createElement('option');
            option.text = '검색 결과가 없습니다.';
            option.disabled = true;
            productSelect.appendChild(option);
            return;
        }

        filtered.forEach(p => {
            const option = document.createElement('option');
            option.value = p.sku;
            option.text = `[${p.category}] ${p.item_name} (${p.unit})`;
            option.dataset.unit = p.unit;
            option.dataset.name = p.item_name;
            option.className = "p-2 border-b border-slate-100";
            productSelect.appendChild(option);
        });
    };

    renderProducts();

    // 4. 이벤트 리스너 설정
    productSearch.addEventListener('input', (e) => {
        renderProducts(e.target.value);
    });

    productSelect.addEventListener('change', (e) => {
        const selectedOption = productSelect.options[productSelect.selectedIndex];
        unitText.textContent = `(${selectedOption.dataset.unit})`;
    });

    btnMinus.addEventListener('click', () => {
        let val = parseInt(quantityInput.value) || 0;
        if (val > 1) quantityInput.value = val - 1;
    });

    btnPlus.addEventListener('click', () => {
        let val = parseInt(quantityInput.value) || 0;
        quantityInput.value = val + 1;
    });

    // 5. 폼 제출 처리
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const date = document.getElementById('inDate').value;
        const worker = document.getElementById('worker').value;
        const sku = productSelect.value;
        const quantity = parseInt(quantityInput.value);

        if (!worker) {
            alert('담당자를 선택해주세요.');
            return;
        }
        if (!sku) {
            alert('품목을 선택해주세요.');
            return;
        }
        if (quantity <= 0 || isNaN(quantity)) {
            alert('유효한 수량을 입력해주세요.');
            return;
        }

        const selectedOption = productSelect.options[productSelect.selectedIndex];
        const itemName = selectedOption.dataset.name;

        // Date format convert to "YYYY-MM-DD HH:mm:ss"
        const formattedDate = date.replace('T', ' ') + ':00';

        const payload = {
            date: formattedDate,
            sku: sku,
            item_name: itemName,
            type: "입고",
            quantity: quantity,
            worker: worker
        };

        // 로딩 표시
        loadingOverlay.classList.remove('hidden');

        const result = await API.postMovement(payload);

        loadingOverlay.classList.add('hidden');

        if (result && result.success) {
            alert(`${itemName} ${quantity}${selectedOption.dataset.unit} 입고 완료되었습니다!`);
            // 리셋 폼
            quantityInput.value = 1;
            productSearch.value = '';
            renderProducts();
            productSelect.selectedIndex = -1;
            unitText.textContent = '';
        } else {
            alert('입고 등록 중 문제가 발생했습니다. 다시 시도해주세요.');
        }
    });
});
