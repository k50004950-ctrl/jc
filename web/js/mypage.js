// 마이페이지 기능

function loadMyPageData() {
    var user = null;
    try {
        user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem('user_info') || 'null');
    } catch(_) {}

    if (!user) return;

    // 프로필 헤더
    var nameEl = document.getElementById('mypage-name');
    var roleEl = document.getElementById('mypage-role');
    var avatarEl = document.getElementById('mypage-avatar');

    if (nameEl) nameEl.textContent = user.name || '회원';
    if (roleEl) {
        var roleMap = { 'super_admin': '총관리자', 'admin': '관리자', 'member': '회원' };
        roleEl.textContent = (roleMap[user.role] || '회원') + (user.org_name ? ' · ' + user.org_name : '');
    }
    if (avatarEl && user.profile_image) {
        avatarEl.innerHTML = '<img src="' + user.profile_image + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.parentElement.innerHTML=\'<svg width=48 height=48 viewBox=\\\"0 0 24 24\\\" fill=\\\"none\\\" stroke=\\\"#9CA3AF\\\" stroke-width=\\\"1.5\\\"><path d=\\\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\\\"/><circle cx=\\\"12\\\" cy=\\\"7\\\" r=\\\"4\\\"/></svg>\'">';
    }

    // 프로필 완성도 계산 — API에서 상세 정보 가져오기
    loadProfileCompletion();
}

async function loadProfileCompletion() {
    try {
        var result = await apiClient.request('/auth/me');
        if (!result || !result.user) return;
        var u = result.user;

        var fields = ['name', 'phone', 'address', 'profile_image', 'company', 'position'];
        var filled = 0;
        fields.forEach(function(f) { if (u[f]) filled++; });
        var pct = Math.round((filled / fields.length) * 100);

        var pctEl = document.getElementById('mypage-completion-pct');
        var barEl = document.getElementById('mypage-completion-bar');
        var msgEl = document.getElementById('mypage-completion-msg');

        if (pctEl) pctEl.textContent = pct + '%';
        if (barEl) barEl.style.width = pct + '%';
        if (msgEl) {
            if (pct >= 100) {
                msgEl.textContent = '프로필이 완성되었습니다!';
                msgEl.style.color = 'var(--primary-color)';
            } else {
                msgEl.textContent = '프로필을 완성하면 다른 회원에게 더 잘 보입니다.';
            }
        }
    } catch(e) {
        console.error('프로필 완성도 로드 오류:', e);
    }
}

console.log('MyPage module loaded');
