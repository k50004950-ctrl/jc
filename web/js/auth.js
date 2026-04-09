// 인증 관련 기능 (Railway API 연동)

// 인증 상태
const AuthStatus = {
    INITIAL: 'initial',
    LOADING: 'loading',
    UNAUTHENTICATED: 'unauthenticated',
    AUTHENTICATED: 'authenticated',
    PENDING_APPROVAL: 'pendingApproval',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended',
    WITHDRAWN: 'withdrawn'
};

let currentAuthStatus = AuthStatus.INITIAL;
let currentUser = null;

// 로그인 폼 유효성 검사
function validateLoginForm() {
    clearAllErrors();

    let isValid = true;
    let firstErrorField = null;

    const emailEl = document.getElementById('login-email');
    const email = emailEl.value.trim();
    if (!email) {
        showError('email-error', '이메일을 입력하세요.');
        isValid = false;
        if (!firstErrorField) firstErrorField = emailEl;
    } else if (!validateEmail(email)) {
        showError('email-error', '올바른 이메일 형식이 아닙니다.');
        isValid = false;
        if (!firstErrorField) firstErrorField = emailEl;
    }

    const passwordEl = document.getElementById('login-password');
    const password = passwordEl.value;
    if (!password) {
        showError('password-error', '비밀번호를 입력하세요.');
        isValid = false;
        if (!firstErrorField) firstErrorField = passwordEl;
    } else if (password.length < 8) {
        showError('password-error', '비밀번호는 8자 이상이어야 합니다.');
        isValid = false;
        if (!firstErrorField) firstErrorField = passwordEl;
    }

    // 첫 번째 에러 필드로 포커스 이동
    if (firstErrorField) firstErrorField.focus();

    return isValid;
}

// 로그인 처리
async function handleLogin(event) {
    event.preventDefault();
    
    console.log('🔹 로그인 시작');
    
    // 유효성 검사
    if (!validateLoginForm()) {
        console.log('❌ 유효성 검사 실패');
        return;
    }
    
    const loginButton = document.querySelector('.btn-login');
    setButtonLoading(loginButton, true);
    
    try {
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        
        console.log('📝 로그인 시도:', email);
        
        // API 로그인 호출
        const result = await apiClient.login(email, password);
        
        if (result.success) {
            console.log('✅ 로그인 성공:', result.user);

            // 사용자 정보 저장
            currentUser = result.user;
            localStorage.setItem('user_info', JSON.stringify(result.user));

            // 로그인 유지 옵션 저장
            if (rememberMe) {
                localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
            }

            // 관리자 계정이면 관리자 페이지로 이동
            if (['super_admin'].includes(result.user.role)) {
                // 관리자 웹에서도 동일 토큰 사용
                localStorage.setItem('admin_token', result.token || localStorage.getItem('auth_token'));
                localStorage.setItem('admin_user', JSON.stringify(result.user));
                window.location.href = '/admin/';
                return;
            }

            // 홈 화면으로 이동 — history 스택 초기화
            currentAuthStatus = AuthStatus.AUTHENTICATED;
            history.replaceState({ screen: 'home' }, '', '#home');
            window._navPopstate = true; // 중복 pushState 방지
            navigateToScreen('home');
            window._navPopstate = false;
            // 로그인 직후 스크롤 초기화 — 앱바 보이도록
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;

            // 홈 화면 데이터 로드
            if (typeof loadHomeData === 'function') {
                loadHomeData();
            }
        } else {
            // 에러 메시지 표시
            showInlineError('inline-error', result.message || '로그인에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('❌ 로그인 에러:', error);
        
        // 사용자 친화적 에러 메시지
        let errorMessage = '로그인 중 오류가 발생했습니다.';
        
        if (error.message) {
            if (error.message.includes('승인')) {
                errorMessage = error.message;
                currentAuthStatus = AuthStatus.PENDING_APPROVAL;
            } else if (error.message.includes('정지')) {
                errorMessage = error.message;
                currentAuthStatus = AuthStatus.SUSPENDED;
            } else if (error.message.includes('이메일') || error.message.includes('비밀번호')) {
                errorMessage = error.message;
            } else {
                errorMessage = error.message;
            }
        }
        
        showInlineError('inline-error', errorMessage);
        
    } finally {
        setButtonLoading(loginButton, false);
    }
}

// 로그아웃 처리
async function handleLogout() {
    try {
        console.log('🔹 로그아웃 시작');
        
        // API 로그아웃 호출
        await apiClient.logout();
        
        // 로컬 상태 초기화
        currentUser = null;
        currentAuthStatus = AuthStatus.UNAUTHENTICATED;
        
        console.log('✅ 로그아웃 완료');
        
        // 로그인 화면으로 이동
        navigateToScreen('login');
        
        // 폼 초기화
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.reset();
        }
        
    } catch (error) {
        console.error('❌ 로그아웃 에러:', error);
        // 에러가 발생해도 로컬 상태는 초기화하고 로그인 화면으로 이동
        currentUser = null;
        currentAuthStatus = AuthStatus.UNAUTHENTICATED;
        apiClient.clearToken();
        navigateToScreen('login');
    }
}

// 인증 상태 확인
async function checkAuthStatus() {
    try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
            console.log('❌ 저장된 토큰 없음');
            currentAuthStatus = AuthStatus.UNAUTHENTICATED;
            return false;
        }
        
        console.log('🔹 인증 상태 확인 중...');
        
        // API로 현재 사용자 정보 조회
        const result = await apiClient.getMe();
        
        if (result.success && result.user) {
            console.log('✅ 인증 유효:', result.user);
            currentUser = result.user;
            currentAuthStatus = AuthStatus.AUTHENTICATED;
            localStorage.setItem('user_info', JSON.stringify(result.user));
            return true;
        } else {
            console.log('❌ 인증 실패');
            currentAuthStatus = AuthStatus.UNAUTHENTICATED;
            apiClient.clearToken();
            return false;
        }
        
    } catch (error) {
        console.error('❌ 인증 확인 에러:', error);
        currentAuthStatus = AuthStatus.UNAUTHENTICATED;
        apiClient.clearToken();
        return false;
    }
}

// 현재 사용자 정보 가져오기
function getCurrentUser() {
    if (currentUser) {
        return currentUser;
    }
    
    // 로컬 스토리지에서 가져오기
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
        try {
            currentUser = JSON.parse(userInfo);
            return currentUser;
        } catch (error) {
            console.error('사용자 정보 파싱 에러:', error);
            return null;
        }
    }
    
    return null;
}

// 인증 필요 확인
function requireAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        console.log('❌ 인증 필요 - 로그인 화면으로 이동');
        navigateToScreen('login');
        return false;
    }
    return true;
}

// ========== Google 로그인 ==========

var _googleClientId = null;

async function initGoogleLogin() {
    // 서버에서 Google Client ID 가져오기
    try {
        var res = await fetch('/api/auth/google-client-id');
        var data = await res.json();
        if (data.clientId) {
            _googleClientId = data.clientId;
            console.log('Google Login initialized');
        }
    } catch (_) {
        console.log('Google Login not configured');
    }
}

async function handleGoogleLogin() {
    var baseUrl = window.location.origin || 'https://jc-production-7db6.up.railway.app';
    var state = 'gstate_' + Math.random().toString(36).substring(2);
    var googleRedirectUrl = baseUrl + '/api/auth/google/redirect?state=' + state;

    // Capacitor 앱 — Chrome Custom Tab으로 열기 (Google이 WebView 차단)
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        localStorage.setItem('google_oauth_state', state);

        // Chrome Custom Tab (Android) / SFSafariViewController (iOS)로 열기
        // Google이 WebView 차단 + Apple이 외부 브라우저 리젝하므로 이 방식 필수
        try {
            // 방법 1: Capacitor Browser 플러그인
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
                await window.Capacitor.Plugins.Browser.open({ url: googleRedirectUrl });
            }
            // 방법 2: Capacitor 글로벌 (v5+)
            else if (window.CapacitorBrowser) {
                await window.CapacitorBrowser.open({ url: googleRedirectUrl });
            }
            // 방법 3: 직접 네이티브 호출
            else if (window.Capacitor && window.Capacitor.nativeCallback) {
                window.Capacitor.nativeCallback('Browser', 'open', { url: googleRedirectUrl });
            }
            // 방법 4: 최후 fallback — _blank
            else {
                window.open(googleRedirectUrl, '_blank');
            }
        } catch (e) {
            console.error('Browser open error:', e);
            window.open(googleRedirectUrl, '_blank');
        }

        // 서버에서 토큰 폴링 (1.5초 간격, 최대 90초)
        var pollCount = 0;
        var pollInterval = setInterval(async function() {
            pollCount++;
            if (pollCount > 60) { clearInterval(pollInterval); return; }
            try {
                var resp = await fetch(baseUrl + '/api/auth/google/poll?state=' + state);
                var data = await resp.json();
                if (data.success && data.token) {
                    clearInterval(pollInterval);
                    localStorage.removeItem('google_oauth_state');
                    try { var B = window.Capacitor.Plugins.Browser; if (B && B.close) await B.close(); } catch(_) {}

                    apiClient.setToken(data.token);
                    currentUser = data.user;
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('user_info', JSON.stringify(data.user));
                    if (['super_admin'].includes(data.user.role)) {
                        localStorage.setItem('admin_token', data.token);
                    }
                    navigateToScreen('home');
                } else if (data.signup) {
                    clearInterval(pollInterval);
                    localStorage.removeItem('google_oauth_state');
                    try { var B = window.Capacitor.Plugins.Browser; if (B && B.close) await B.close(); } catch(_) {}
                    goToSignupWithSocial(data.email, data.name);
                }
            } catch(_) {}
        }, 1500);
        return;
    }

    // 일반 웹 브라우저 — state 없이 리다이렉트 (서버가 직접 토큰으로 리다이렉트)
    window.location.href = baseUrl + '/api/auth/google/redirect';
}

async function onGoogleCredentialResponse(response) {
    var errEl = document.getElementById('inline-error');
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }

    var loginBtn = document.getElementById('google-login-btn');
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = '로그인 중...'; }

    try {
        var result = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        var data = await result.json();

        if (data.success) {
            // 로그인 성공
            apiClient.setToken(data.token);
            currentUser = data.user;
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_info', JSON.stringify(data.user));

            if (['super_admin'].includes(data.user.role)) {
                localStorage.setItem('admin_token', data.token);
            }

            navigateToScreen('home');
        } else if (result.status === 404 && data.google_email) {
            // 미가입 → 회원가입 화면으로 이동 + 이메일/이름 자동입력
            goToSignupWithSocial(data.google_email, data.google_name || '');
        } else {
            if (errEl) { errEl.textContent = data.message || 'Google 로그인 실패'; errEl.classList.add('show'); }
        }
    } catch (err) {
        if (errEl) { errEl.textContent = 'Google 로그인 중 오류가 발생했습니다.'; errEl.classList.add('show'); }
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Google로 로그인'; }
    }
}

// ========== Apple 로그인 ==========

var _appleClientId = null;
var _appleRedirectUri = null;

async function initAppleLogin() {
    try {
        var res = await fetch('/api/auth/apple-client-id');
        var data = await res.json();
        if (data.clientId) {
            _appleClientId = data.clientId;
            _appleRedirectUri = data.redirectUri;
            console.log('Apple Login initialized');
        }
    } catch (_) {
        console.log('Apple Login not configured');
    }
}

async function handleAppleLogin() {
    if (!_appleClientId) {
        await initAppleLogin();
        if (!_appleClientId) {
            var errEl = document.getElementById('inline-error');
            if (errEl) { errEl.textContent = 'Apple 로그인이 아직 설정되지 않았습니다.'; errEl.classList.add('show'); }
            return;
        }
    }

    var errEl = document.getElementById('inline-error');
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }

    try {
        // Apple Sign In — 리다이렉트 방식 (앱 내 WebView에서 동작)
        AppleID.auth.init({
            clientId: _appleClientId,
            scope: 'name email',
            redirectURI: _appleRedirectUri,
            usePopup: false
        });

        AppleID.auth.signIn();
        // 리다이렉트 방식이므로 여기서 페이지가 이동됨
        // 콜백 처리는 checkAppleCallback()에서 수행
    } catch (error) {
        if (error.error === 'popup_closed_by_user' || error.error === 'user_cancelled_authorize') {
            return;
        }
        console.error('Apple login error:', error);
        if (errEl) { errEl.textContent = 'Apple 로그인 중 오류가 발생했습니다.'; errEl.classList.add('show'); }
    }
}

async function onAppleLoginResponse(response) {
    var errEl = document.getElementById('inline-error');
    var loginBtn = document.getElementById('apple-login-btn');
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = '로그인 중...'; }

    try {
        var idToken = response.authorization && response.authorization.id_token;
        if (!idToken) throw new Error('Apple 인증 토큰을 받지 못했습니다.');

        var result = await fetch('/api/auth/apple', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_token: idToken,
                user: response.user || null
            })
        });
        var data = await result.json();

        if (data.success) {
            apiClient.setToken(data.token);
            currentUser = data.user;
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_info', JSON.stringify(data.user));

            if (['super_admin'].includes(data.user.role)) {
                localStorage.setItem('admin_token', data.token);
            }

            navigateToScreen('home');
        } else if (result.status === 404 && data.apple_email) {
            // 미가입 → 회원가입 화면으로 이동 + 이메일/이름 자동입력
            goToSignupWithSocial(data.apple_email, data.apple_name || '');
        } else {
            if (errEl) { errEl.textContent = data.message || 'Apple 로그인 실패'; errEl.classList.add('show'); }
        }
    } catch (err) {
        console.error('Apple login response error:', err);
        if (errEl) { errEl.textContent = 'Apple 로그인 중 오류가 발생했습니다.'; errEl.classList.add('show'); }
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg> Apple로 로그인';
        }
    }
}

// Apple 콜백 리다이렉트 처리 (URL에 apple_id_token이 있는 경우)
function checkAppleCallback() {
    var params = new URLSearchParams(window.location.search);
    var appleIdToken = params.get('apple_id_token');
    if (appleIdToken) {
        var appleUser = params.get('apple_user');
        var userData = null;
        try { if (appleUser) userData = JSON.parse(decodeURIComponent(appleUser)); } catch (_) {}

        var isSignupMode = localStorage.getItem('apple_signup_mode') === 'true';
        localStorage.removeItem('apple_signup_mode');

        // URL 파라미터 제거
        window.history.replaceState({}, '', window.location.pathname + (isSignupMode ? '#signup' : '#login'));

        if (isSignupMode) {
            // 회원가입 폼에 이메일/이름 자동입력
            try {
                var parts = appleIdToken.split('.');
                var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                var appleEmail = (payload.email || '').toLowerCase();
                var appleName = (userData && userData.name)
                    ? ((userData.name.lastName || '') + (userData.name.firstName || '')).trim()
                    : '';
                goToSignupWithSocial(appleEmail, appleName);
            } catch (e) { console.error('Apple signup parse error:', e); }
        } else {
            // 로그인 처리
            onAppleLoginResponse({
                authorization: { id_token: appleIdToken },
                user: userData
            });
        }
    }
}

/**
 * Google OAuth 리다이렉트 콜백 처리
 */
function checkGoogleCallback() {
    var params = new URLSearchParams(window.location.search);

    // 로그인 성공
    var googleToken = params.get('google_token');
    if (googleToken) {
        var googleUser = params.get('google_user');
        try {
            var userData = JSON.parse(decodeURIComponent(googleUser));
            apiClient.setToken(googleToken);
            currentUser = userData;
            localStorage.setItem('auth_token', googleToken);
            localStorage.setItem('user_info', googleUser);
            if (['super_admin'].includes(userData.role)) {
                localStorage.setItem('admin_token', googleToken);
            }
        } catch (e) { console.error('Google callback parse error:', e); }
        window.history.replaceState({}, '', '/');
        setTimeout(function() { navigateToScreen('home'); }, 100);
        return;
    }

    // 미가입 → 회원가입
    var signupEmail = params.get('google_signup_email');
    if (signupEmail) {
        var signupName = params.get('google_signup_name') || '';
        window.history.replaceState({}, '', '/#signup');
        setTimeout(function() { goToSignupWithSocial(signupEmail, signupName); }, 300);
        return;
    }

    // 에러
    var googleError = params.get('google_error');
    if (googleError) {
        window.history.replaceState({}, '', '/#login');
        var errEl = document.getElementById('inline-error');
        if (errEl) {
            var msg = googleError === 'pending' ? '승인 대기 중입니다.' :
                      googleError === 'suspended' ? '정지된 계정입니다.' :
                      'Google 로그인에 실패했습니다.';
            errEl.textContent = msg;
            errEl.classList.add('show');
        }
    }
}

// ========== 소셜 회원가입 (이메일/이름 자동입력) ==========

/**
 * 로그인 시 미가입 → 회원가입 화면으로 이동 + 이메일/이름 자동입력
 */
function goToSignupWithSocial(email, name) {
    navigateToScreen('signup');
    setTimeout(function() {
        var emailEl = document.getElementById('signup-email');
        var nameEl = document.getElementById('signup-name');
        if (emailEl && email) { emailEl.value = email; emailEl.readOnly = true; emailEl.style.background = '#F3F4F6'; }
        if (nameEl && name) nameEl.value = name;
        hideSocialPasswordFields();
        var emailErr = document.getElementById('signup-email-error');
        if (emailErr) { emailErr.textContent = '소셜 계정 이메일이 자동입력되었습니다.'; emailErr.style.color = 'var(--primary-color)'; emailErr.style.display = 'block'; }
    }, 200);
}

/**
 * 소셜 가입 시 비밀번호 필드 숨기기 + required 해제
 */
function hideSocialPasswordFields() {
    window._socialSignup = true;
    var pwEl = document.getElementById('signup-password');
    var pwConfEl = document.getElementById('signup-password-confirm');
    // 비밀번호 필드의 부모 form-group을 찾아서 숨김
    if (pwEl) {
        pwEl.required = false;
        pwEl.closest('.form-group').style.display = 'none';
        // 비밀번호 강도 미터도 숨김
        var strengthEl = document.getElementById('password-strength');
        if (strengthEl) strengthEl.style.display = 'none';
    }
    if (pwConfEl) {
        pwConfEl.required = false;
        pwConfEl.closest('.form-group').style.display = 'none';
    }
}

/**
 * 소셜 가입 해제 (직접 입력으로 전환 시)
 */
function showPasswordFields() {
    window._socialSignup = false;
    var pwEl = document.getElementById('signup-password');
    var pwConfEl = document.getElementById('signup-password-confirm');
    if (pwEl) {
        pwEl.required = true;
        pwEl.closest('.form-group').style.display = '';
        var strengthEl = document.getElementById('password-strength');
        if (strengthEl) strengthEl.style.display = '';
    }
    if (pwConfEl) {
        pwConfEl.required = true;
        pwConfEl.closest('.form-group').style.display = '';
    }
}

/**
 * 회원가입 폼에서 소셜 버튼으로 이메일/이름 자동입력
 */
async function socialSignupFill(provider) {
    if (provider === 'google') {
        if (!_googleClientId) {
            await initGoogleLogin();
            if (!_googleClientId) { alert('Google 로그인이 설정되지 않았습니다.'); return; }
        }
        google.accounts.id.initialize({
            client_id: _googleClientId,
            callback: function(response) {
                // Google ID Token에서 이메일/이름 추출
                try {
                    var parts = response.credential.split('.');
                    var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                    var emailEl = document.getElementById('signup-email');
                    var nameEl = document.getElementById('signup-name');
                    if (emailEl && payload.email) { emailEl.value = payload.email.toLowerCase(); emailEl.readOnly = true; emailEl.style.background = '#F3F4F6'; }
                    if (nameEl && payload.name) nameEl.value = payload.name;
                    hideSocialPasswordFields();
                    var emailErr = document.getElementById('signup-email-error');
                    if (emailErr) { emailErr.textContent = 'Google 이메일이 입력되었습니다.'; emailErr.style.color = 'var(--primary-color)'; emailErr.style.display = 'block'; }
                } catch (e) { console.error('Google token parse error:', e); }
            }
        });
        google.accounts.id.prompt(function(notification) {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // fallback: 팝업 버튼 렌더
                var tempDiv = document.createElement('div');
                tempDiv.id = 'google-signup-temp';
                tempDiv.style.cssText = 'position:fixed;top:-9999px;';
                document.body.appendChild(tempDiv);
                google.accounts.id.renderButton(tempDiv, { theme: 'outline', size: 'large' });
                var gBtn = tempDiv.querySelector('div[role="button"]');
                if (gBtn) gBtn.click();
                setTimeout(function() { if (tempDiv.parentNode) tempDiv.parentNode.removeChild(tempDiv); }, 5000);
            }
        });
    } else if (provider === 'apple') {
        if (!_appleClientId) {
            await initAppleLogin();
            if (!_appleClientId) { alert('Apple 로그인이 설정되지 않았습니다.'); return; }
        }
        try {
            AppleID.auth.init({
                clientId: _appleClientId,
                scope: 'name email',
                redirectURI: _appleRedirectUri,
                usePopup: false
            });
            // 리다이렉트 방식 — 회원가입 폼에서도 동일하게 처리
            // 콜백에서 signup 플래그로 회원가입 폼으로 돌아옴
            localStorage.setItem('apple_signup_mode', 'true');
            AppleID.auth.signIn();
            return; // 리다이렉트 발생
            var idToken = ''; // 아래 코드는 리다이렉트 후 실행 안 됨
            if (idToken) {
                var parts = idToken.split('.');
                var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                var emailEl = document.getElementById('signup-email');
                var nameEl = document.getElementById('signup-name');
                if (emailEl && payload.email) { emailEl.value = payload.email.toLowerCase(); emailEl.readOnly = true; emailEl.style.background = '#F3F4F6'; }
                if (nameEl && response.user && response.user.name) {
                    nameEl.value = ((response.user.name.lastName || '') + (response.user.name.firstName || '')).trim();
                }
                hideSocialPasswordFields();
                var emailErr = document.getElementById('signup-email-error');
                if (emailErr) { emailErr.textContent = 'Apple 이메일이 입력되었습니다.'; emailErr.style.color = 'var(--primary-color)'; emailErr.style.display = 'block'; }
            }
        } catch (error) {
            if (error.error !== 'popup_closed_by_user' && error.error !== 'user_cancelled_authorize') {
                console.error('Apple signup fill error:', error);
            }
        }
    }
}

// 페이지 로드 시 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 폼
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 로그인 안 된 상태에서만 소셜 로그인 초기화
    if (!localStorage.getItem('auth_token')) {
        initGoogleLogin();
        initAppleLogin();
        checkAppleCallback();
        checkGoogleCallback();
    }

    // 비밀번호 토글 (signup-link, logout-btn은 navigation.js의 setupSignupEvents에서 등록)
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            
            if (input.type === 'password') {
                input.type = 'text';
                this.querySelector('.icon').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
            } else {
                input.type = 'password';
                this.querySelector('.icon').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
            }
        });
    });
});

// 전화번호 자동 하이픈 포매팅
function formatPhoneInput(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length >= 8) {
        input.value = v.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
    } else if (v.length >= 4) {
        input.value = v.replace(/(\d{3})(\d+)/, '$1-$2');
    } else {
        input.value = v;
    }
}

// 아이디(이메일) 찾기
function showFindEmailScreen() {
    navigateToScreen('find-email');
    // 전화번호 입력 이벤트 바인딩
    setTimeout(() => {
        const phoneInput = document.getElementById('find-email-phone');
        if (phoneInput && !phoneInput._formatted) {
            phoneInput._formatted = true;
            phoneInput.addEventListener('input', () => formatPhoneInput(phoneInput));
        }
    }, 100);
}

async function handleFindEmail() {
    const name = (document.getElementById('find-email-name')?.value || '').trim();
    const phone = (document.getElementById('find-email-phone')?.value || '').trim();
    const errorEl = document.getElementById('find-email-error');
    const resultEl = document.getElementById('find-email-result');

    if (!name || !phone) {
        if (errorEl) { errorEl.textContent = '이름과 전화번호를 모두 입력해주세요.'; errorEl.style.display = 'block'; }
        return;
    }
    if (errorEl) { errorEl.style.display = 'none'; }
    if (resultEl) resultEl.style.display = 'none';

    try {
        const res = await apiClient.request('/auth/find-email', {
            method: 'POST',
            body: JSON.stringify({ name, phone })
        });
        if (res.found) {
            if (resultEl) { resultEl.style.display = 'block'; }
            document.getElementById('find-email-value').textContent = res.email;
        } else {
            if (errorEl) { errorEl.textContent = '일치하는 계정을 찾을 수 없습니다.'; errorEl.style.display = 'block'; }
        }
    } catch (err) {
        if (errorEl) { errorEl.textContent = err.message || '이메일 찾기 중 오류'; errorEl.style.display = 'block'; }
    }
}

console.log('✅ Auth 모듈 로드 완료 (Railway API)');
