// [수정사항: 2026-05-19] 1. 초압축 레이아웃 적용, 2. 업데이트 시점 복구, 3. SKU 누락으로 인한 덮어쓰기 오류 수정
document.addEventListener('DOMContentLoaded', async () => {
    // [수정사항 2026-05-19] 로그인 상태 체크
    const userName = localStorage.getItem('user_name');
    if (!userName) {
        window.location.replace('login.html');
        return;
    }
    document.getElementById('workerNameDisplay').textContent = userName;

    const productListEl = document.getElementById('productList');
    const locationFilter = document.getElementById('locationFilter');
    const supplierFilter = document.getElementById('supplierFilter'); 
    const btnSave = document.getElementById('btnSave');
    const changeCountBadge = document.getElementById('changeCountBadge');
    const btnSaveBottom = document.getElementById('btnSaveBottom');
    const changeCountBadgeBottom = document.getElementById('changeCountBadgeBottom');
    const loadingOverlay = document.getElementById('loadingOverlay');
    // [수정사항 2026-05-20] checkDate 삭제
    let allProducts = [];
    let modifications = {}; 

    allProducts = await API.getProducts();

    const locations = [...new Set(allProducts.map(p => p.location).filter(Boolean))];
    locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.text = loc;
        locationFilter.appendChild(option);
    });

    const suppliers = [...new Set(allProducts.map(p => p.supplier).filter(Boolean))];
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup;
        option.text = sup;
        supplierFilter.appendChild(option);
    });

    // [수정사항 2026-05-21] 기본 거래처를 전체(ALL)에서 첫 번째 거래처로 변경
    if (suppliers.length > 0) {
        supplierFilter.value = suppliers[0];
    }

    const renderList = () => {
        productListEl.innerHTML = '';
        const locVal = locationFilter.value;
        const supVal = supplierFilter.value;
        
        let filtered = allProducts;
        if (locVal !== 'ALL') filtered = filtered.filter(p => p.location === locVal);
        if (supVal !== 'ALL') filtered = filtered.filter(p => p.supplier === supVal);

        if (filtered.length === 0) {
            productListEl.innerHTML = '<div class="col-span-2 text-center text-slate-400 py-10 text-xs">품목이 없습니다.</div>';
            return;
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            // 초압축을 위한 클래스 세팅
            card.className = "bg-white rounded-lg p-2 shadow-sm border border-slate-100 flex flex-col justify-between relative";
            
            // [수정사항 2026-05-19] 완벽한 고유 식별을 위해 row_index 사용
            const itemKey = p.row_index !== undefined ? p.row_index.toString() : (p.sku || `${p.item_name}_${p.location}`); 

            const currentMod = modifications[itemKey];
            const displayVal = currentMod ? currentMod.newQuantity : '';
            const isModified = currentMod !== undefined;

            // [수정사항 2026-05-20] 업데이트 시점 표기 강조 및 위치 이동, 담당자 표기 추가
            const lastUpdatedText = p.last_updated ? p.last_updated.replace('T', ' ').substring(5, 16) : '-';
            const lastWorkerText = p.last_worker ? `👤 ${p.last_worker}` : '';

            card.innerHTML = `
                <div class="flex justify-between items-end">
                    <div class="flex-1 min-w-0 pr-1">
                        <div class="flex items-center text-[9px] text-slate-500 mb-0.5 truncate">
                            <span class="font-bold bg-slate-100 text-slate-600 px-1 rounded mr-1">${p.location || '위치'}</span>
                            <span class="truncate">${p.supplier || ''}</span>
                        </div>
                        <h3 class="font-bold text-base text-slate-800 leading-tight line-clamp-2 mb-0.5">${p.item_name}</h3>
                        <div class="font-bold text-sm text-red-500">${lastUpdatedText}</div>
                    </div>
                    <div class="flex flex-col items-end shrink-0">
                        <div class="font-bold text-[10px] text-blue-500 mb-0.5 h-3.5 flex items-center">${lastWorkerText}</div>
                        <div class="relative w-20">
                            <input type="number" 
                                   min="0" step="0.1"
                                   data-key="${itemKey}"
                                   value="${displayVal}" 
                                   placeholder="${p.current_stock || 0}"
                                   class="inventory-input w-full bg-slate-50 border ${isModified ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200'} text-slate-900 text-base font-bold text-center rounded p-1 pr-6 shadow-inner h-8 transition-colors">
                            <span class="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 select-none pointer-events-none">${p.unit}</span>
                        </div>
                    </div>
                </div>
            `;
            productListEl.appendChild(card);
        });

        // 이벤트 바인딩 (모바일 호환성을 위해 change 이벤트도 추가)
        document.querySelectorAll('.inventory-input').forEach(input => {
            input.addEventListener('input', handleInput);
            input.addEventListener('change', handleInput);
        });
    };

    const handleInput = (e) => {
        const input = e.target;
        const itemKey = input.dataset.key;
        const val = input.value;

        if (val === '') {
            delete modifications[itemKey];
            input.classList.remove('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
            input.classList.add('border-slate-200', 'bg-slate-50');
        } else {
            const product = allProducts.find(p => (p.row_index !== undefined ? p.row_index.toString() : (p.sku || `${p.item_name}_${p.location}`)) === itemKey);
            modifications[itemKey] = { ...product, newQuantity: parseFloat(val) };
            input.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
            input.classList.remove('border-slate-200', 'bg-slate-50');
        }

        updateBadge();
    };

    const updateBadge = () => {
        const count = Object.keys(modifications).length;
        if (count > 0) {
            changeCountBadge.textContent = `${count}건`;
            changeCountBadge.classList.remove('hidden');
            if(changeCountBadgeBottom) {
                changeCountBadgeBottom.textContent = `${count}건`;
                changeCountBadgeBottom.classList.remove('hidden');
            }
        } else {
            changeCountBadge.classList.add('hidden');
            if(changeCountBadgeBottom) changeCountBadgeBottom.classList.add('hidden');
        }
    };

    locationFilter.addEventListener('change', renderList);
    supplierFilter.addEventListener('change', renderList);

    const saveHandler = async () => {
        const modKeys = Object.keys(modifications);
        if (modKeys.length === 0) {
            alert('변경된 수량이 없습니다.');
            return;
        }

        const worker = userName; // 로그인한 사용자 이름을 담당자로 사용

        if (!confirm(`총 ${modKeys.length}건의 재고를 업데이트하시겠습니까?`)) {
            return;
        }

        loadingOverlay.classList.remove('hidden');

        // [수정사항 2026-05-20] 제출 시점의 시간을 자동으로 구해서 전송
        const nowTime = new Date();
        const offsetMs = nowTime.getTimezoneOffset() * 60000;
        const localIso = (new Date(nowTime - offsetMs)).toISOString().slice(0,16);
        const formattedDate = localIso.replace('T', ' ') + ':00';

        let hasErrors = false;
        try {
            // [수정사항 2026-05-19] 구글 시트 API 동시 접근 제한(Rate Limit) 방지를 위해 순차적(Sequential)으로 전송하도록 변경
            for (const key of modKeys) {
                const item = modifications[key];
                const payload = {
                    date: formattedDate,
                    row_index: item.row_index,
                    sku: item.sku || '', // SKU가 비어있으면 빈 문자열 전송
                    item_name: item.item_name,
                    location: item.location || '', // 동명이인 품목 식별을 위해 위치도 전송
                    type: "실사/조정",
                    quantity: item.newQuantity,
                    worker: worker
                };
                const result = await API.postMovement(payload);
                if (!result || !result.success) {
                    hasErrors = true;
                }
            }
            
            loadingOverlay.classList.add('hidden');
            
            if (hasErrors) {
                alert('업데이트 중 일부 통신 오류가 발생했습니다. (일부 품목만 저장되었을 수 있습니다.)');
            } else {
                alert('재고 업데이트가 완료되었습니다.');
            }
            
            modifications = {};
            updateBadge();
            loadingOverlay.classList.remove('hidden');
            allProducts = await API.getProducts();
            renderList();
        } catch (error) {
            console.error(error);
            alert('업데이트 중 일부 오류가 발생했습니다.');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    };

    btnSave.addEventListener('click', saveHandler);
    if(btnSaveBottom) btnSaveBottom.addEventListener('click', saveHandler);

    // [수정사항 2026-06-15] 최신 업데이트 내역 모달 관련 로직 추가
    const latestUpdatesModal = document.getElementById('latestUpdatesModal');
    const btnOpenLatest = document.getElementById('btnOpenLatest');
    const btnCloseLatest = document.getElementById('btnCloseLatest');
    const btnFilterToday = document.getElementById('btnFilterToday');
    const btnFilter3Days = document.getElementById('btnFilter3Days');
    const btnFilter1Week = document.getElementById('btnFilter1Week');

    const updateFilterTabUI = (activeBtn) => {
        [btnFilterToday, btnFilter3Days, btnFilter1Week].forEach(btn => {
            if (btn === activeBtn) {
                btn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all";
            } else {
                btn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 transition-all";
            }
        });
    };

    const loadLatestUpdates = async (days) => {
        const listEl = document.getElementById('latestUpdatesList');
        listEl.innerHTML = '<div class="text-center text-slate-400 py-10 text-xs">업데이트 내역을 불러오는 중...</div>';
        
        try {
            const data = await API.getMovements(days);
            listEl.innerHTML = '';
            
            if (data.length === 0) {
                listEl.innerHTML = '<div class="text-center text-slate-400 py-10 text-xs">해당 기간의 업데이트 내역이 없습니다.</div>';
                return;
            }
            
            data.forEach(item => {
                const card = document.createElement('div');
                card.className = "p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm space-y-1";
                
                card.innerHTML = `
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center min-w-0 flex-1">
                            <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded mr-1.5 shrink-0">${item.supplier}</span>
                            <span class="font-bold text-slate-800 text-sm truncate">${item.item_name}</span>
                        </div>
                        <span class="text-xs font-bold text-emerald-600 shrink-0">${item.quantity} 개</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-500">
                        <span class="text-red-500 font-semibold">${item.date}</span>
                        <span class="font-bold text-blue-500">👤 ${item.worker}</span>
                    </div>
                `;
                listEl.appendChild(card);
            });
        } catch (err) {
            console.error('Error loading latest updates:', err);
            listEl.innerHTML = '<div class="text-center text-red-500 py-10 text-xs">데이터 로드에 실패했습니다.</div>';
        }
    };

    if (btnOpenLatest) {
        btnOpenLatest.addEventListener('click', () => {
            latestUpdatesModal.classList.remove('hidden');
            updateFilterTabUI(btnFilterToday);
            loadLatestUpdates(0); // 기본값: 오늘 (0일)
        });
    }

    if (btnCloseLatest) {
        btnCloseLatest.addEventListener('click', () => {
            latestUpdatesModal.classList.add('hidden');
        });
    }

    if (btnFilterToday) {
        btnFilterToday.addEventListener('click', () => {
            updateFilterTabUI(btnFilterToday);
            loadLatestUpdates(0);
        });
    }

    if (btnFilter3Days) {
        btnFilter3Days.addEventListener('click', () => {
            updateFilterTabUI(btnFilter3Days);
            loadLatestUpdates(3);
        });
    }

    if (btnFilter1Week) {
        btnFilter1Week.addEventListener('click', () => {
            updateFilterTabUI(btnFilter1Week);
            loadLatestUpdates(7);
        });
    }

    renderList();
});
