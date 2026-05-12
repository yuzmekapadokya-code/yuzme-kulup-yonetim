// Login Form Handler
function initLoginForm() {
    console.log('initLoginForm: Çalışıyor...');
    const form = document.getElementById('loginForm');
    if (!form) {
        console.error('initLoginForm: loginForm element bulunamadı');
        return;
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMessage');
        
        try {
            errorDiv.textContent = 'Giriş yapılıyor...';
            errorDiv.style.color = '#3498db';
            
            console.log('Giriş denemesi:', email);
            // Firebase login using window.auth
            const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('Giriş başarılı, kullanıcı:', user.uid);
            // Get user role from Firestore
            const userDoc = await window.db.collection('users').doc(user.uid).get();

            if (!userDoc.exists) {
                throw new Error('Kullanıcı verisi bulunamadı');
            }

            const userData = userDoc.data();
            const role = userData.role;

            console.log('Kullanıcı rolü:', role);

            // If account already frozen, block login
            if (userData.frozen) {
                try {
                    await window.auth.signOut();
                } catch (e) {
                    console.warn('signOut error after frozen check', e);
                }
                throw new Error('Hesabınız dondurulmuş. Lütfen yönetici ile iletişime geçin.');
            }

            // If admin, check membership end date and freeze if expired
            if (role === 'admin' && userData.membershipEnd) {
                const endDate = new Date(userData.membershipEnd);
                if (isFinite(endDate.getTime()) && new Date() > endDate) {
                    // Mark account frozen in Firestore and prevent login
                    try {
                        await window.db.collection('users').doc(user.uid).update({ frozen: true });
                    } catch (e) {
                        console.warn('freeze update error', e);
                    }
                    try {
                        await window.auth.signOut();
                    } catch (e) {
                        console.warn('signOut error after freeze update', e);
                    }
                    throw new Error('Üyeliğiniz sona erdi; profiliniz otomatik olarak donduruldu. Giriş engellendi.');
                }
            }
            
            // Store user info in sessionStorage
            sessionStorage.setItem('user_id', user.uid);
            sessionStorage.setItem('user_email', user.email);
            sessionStorage.setItem('user_role', role);
            sessionStorage.setItem('user_name', userData.name || 'Kullanıcı');
            
            // Redirect based on role
            if (role === 'superadmin') {
                window.location.href = 'pages/superadmin.html';
            } else if (role === 'admin') {
                window.location.href = 'pages/admin.html';
            } else if (role === 'secretary') {
                window.location.href = 'pages/secretary.html';
            } else if (role === 'trainer') {
                window.location.href = 'pages/trainer.html';
            } else if (role === 'parent') {
                window.location.href = 'pages/parent.html';
            } else {
                throw new Error('Geçersiz kullanıcı rolü');
            }
            
        } catch (error) {
            errorDiv.textContent = 'Hata: ' + error.message;
            errorDiv.style.color = '#e74c3c';
            console.error('Login error:', error);
        }
    });
}

// Check if user is logged in on page load
function checkUserLoggedIn() {
    const userId = sessionStorage.getItem('user_id');
    if (userId) {
        const role = sessionStorage.getItem('user_role');
        if (role === 'superadmin') {
            window.location.href = 'pages/superadmin.html';
        } else if (role === 'admin') {
            window.location.href = 'pages/admin.html';
        } else if (role === 'secretary') {
            window.location.href = 'pages/secretary.html';
        } else if (role === 'trainer') {
            window.location.href = 'pages/trainer.html';
        } else if (role === 'parent') {
            window.location.href = 'pages/parent.html';
        }
    }
}

// Initialize when ready
function initAuth() {
    console.log('initAuth çağrıldı - window.auth:', typeof window.auth, 'window.db:', typeof window.db);
    if (typeof window.auth !== 'undefined' && typeof window.db !== 'undefined') {
        console.log('✓ Firebase hazır, initialization yapılıyor...');
        initLoginForm();
        checkUserLoggedIn();
    } else {
        console.log('⏳ Firebase henüz hazır değil, 100ms sonra tekrar dene...');
        setTimeout(initAuth, 100);
    }
}

console.log('auth.js yüklendi - document.readyState:', document.readyState);
if (document.readyState === 'loading') {
    console.log('auth.js: DOM loading, DOMContentLoaded listener ekleniyor...');
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    console.log('auth.js: DOM zaten loaded, hemen initAuth çağrı...');
    initAuth();
}
