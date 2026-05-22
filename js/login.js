// [신규 2026-05-19] 로그인 처리 스크립트
document.addEventListener('DOMContentLoaded', () => {
    // 이미 로그인된 상태면 메인으로 이동
    if (localStorage.getItem('user_name')) {
        window.location.replace('index.html');
        return;
    }

    const form = document.getElementById('loginForm');
    const btn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('errorMsg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('userId').value.trim();
        const pw = document.getElementById('userPw').value.trim();
        
        if (!id || !pw) return;

        btn.disabled = true;
        btn.textContent = '확인 중...';
        btn.classList.add('opacity-70');
        errorMsg.classList.add('hidden');

        try {
            const res = await API.login(id, pw);
            if (res && res.success) {
                // 로그인 성공 시 로컬스토리지에 이름 저장
                localStorage.setItem('user_name', res.name);
                window.location.replace('index.html');
            } else {
                errorMsg.textContent = res.error || '아이디 또는 비밀번호가 일치하지 않습니다.';
                errorMsg.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = '로그인';
                btn.classList.remove('opacity-70');
            }
        } catch (error) {
            errorMsg.textContent = '서버 통신 오류가 발생했습니다.';
            errorMsg.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = '로그인';
            btn.classList.remove('opacity-70');
        }
    });
});
