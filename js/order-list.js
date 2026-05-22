document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('orderListContainer');
    const totalItemsCount = document.getElementById('totalItemsCount');
    const btnRefresh = document.getElementById('btnRefresh');

    const loadOrderList = async () => {
        container.innerHTML = `
            <div class="animate-pulse space-y-6">
                <div>
                    <div class="h-6 w-32 bg-slate-200 rounded mb-3"></div>
                    <div class="h-20 bg-slate-200 rounded-2xl"></div>
                </div>
            </div>
        `;

        const products = await API.getProducts();

        // 발주 필요한 항목 필터링 (현재고 < 안전재고)
        const neededProducts = products.filter(p => (p.current_stock || 0) < p.min_stock_level);
        
        totalItemsCount.textContent = `${neededProducts.length}개`;

        if (neededProducts.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-400 py-20 space-y-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl">
                        🎉
                    </div>
                    <p class="font-bold text-lg text-slate-600">발주가 필요한 품목이 없습니다!</p>
                    <p class="text-sm">현재고가 모두 안전재고 이상입니다.</p>
                </div>
            `;
            return;
        }

        // 거래처(supplier)별 그룹화
        const grouped = neededProducts.reduce((acc, p) => {
            const supplier = p.supplier || '거래처 미지정';
            if (!acc[supplier]) acc[supplier] = [];
            acc[supplier].push(p);
            return acc;
        }, {});

        container.innerHTML = '';

        Object.keys(grouped).forEach(supplier => {
            const supplierGroup = document.createElement('div');
            supplierGroup.className = 'mb-8';

            const supplierTitle = document.createElement('h2');
            supplierTitle.className = 'text-lg font-black text-slate-800 mb-3 flex items-center';
            supplierTitle.innerHTML = `
                <span class="w-2 h-5 bg-purple-500 rounded-full mr-2"></span>
                ${supplier}
            `;
            supplierGroup.appendChild(supplierTitle);

            const itemList = document.createElement('div');
            itemList.className = 'space-y-3';

            grouped[supplier].forEach(p => {
                const current = p.current_stock || 0;
                const needed = p.min_stock_level - current; // 필요량

                const itemCard = document.createElement('div');
                itemCard.className = 'bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center';

                itemCard.innerHTML = `
                    <div class="flex-1 pr-2">
                        <div class="text-xs text-slate-500 mb-1">${p.category}</div>
                        <h3 class="font-bold text-lg text-slate-800 leading-tight">${p.item_name}</h3>
                        <div class="flex items-center text-sm mt-2 text-slate-600">
                            <span class="bg-slate-100 px-2 py-0.5 rounded mr-2">현재: <b class="text-slate-800">${current}</b></span>
                            <span class="bg-slate-100 px-2 py-0.5 rounded">안전: <b class="text-slate-800">${p.min_stock_level}</b></span>
                        </div>
                    </div>
                    <div class="bg-purple-50 p-3 rounded-xl min-w-[80px] text-center border border-purple-100">
                        <div class="text-xs font-bold text-purple-600 mb-0.5">발주필요</div>
                        <div class="text-2xl font-black text-purple-700">${needed}<span class="text-sm font-medium ml-0.5">${p.unit}</span></div>
                    </div>
                `;
                itemList.appendChild(itemCard);
            });

            supplierGroup.appendChild(itemList);
            container.appendChild(supplierGroup);
        });
    };

    btnRefresh.addEventListener('click', loadOrderList);

    // 초기 로딩
    loadOrderList();
});
