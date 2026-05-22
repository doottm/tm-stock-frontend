document.addEventListener('DOMContentLoaded', () => {
    // 로그인 상태 체크
    const userName = localStorage.getItem('user_name');
    if (!userName) {
        window.location.replace('login.html');
        return;
    }
    
    document.getElementById('userNameDisplay').textContent = `${userName}님`;
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('user_name');
        window.location.replace('login.html');
    });
});
