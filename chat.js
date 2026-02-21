(function() {
if (typeof firebase === 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        alert('Ошибка загрузки Firebase. Пожалуйста, обновите страницу.');
    });
    return;
}

const firebaseConfig = {
    apiKey: "AIzaSyCVdthLC_AX8EI5lKsL-6UOpP7B01dIjQ8",
    authDomain: "speednexusrus.firebaseapp.com",
    projectId: "speednexusrus",
    storageBucket: "speednexusrus.firebasestorage.app",
    messagingSenderId: "524449944041",
    appId: "1:524449944041:web:362f4343ed1507ec2d3b78"
};

let app;
let db;
let supabase;
let auth;

try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    
    const supabaseUrl = 'https://bncysgnqsgpdpuupzgqj.supabase.co';
    const supabaseKey = 'sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR';
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (error) {
    document.addEventListener('DOMContentLoaded', function() {
        alert('Ошибка подключения к серверу. Пожалуйста, обновите страницу.');
    });
    return;
}

const elements = {
    registerScreen: document.getElementById('registerScreen'),
    codeScreen: document.getElementById('codeScreen'),
    chatsScreen: document.getElementById('chatsScreen'),
    chatScreen: document.getElementById('chatScreen'),
    chatsList: document.getElementById('chatsList'),
    searchChats: document.getElementById('searchChats'),
    chatsMenuBtn: document.getElementById('chatsMenuBtn'),
    findFriendsCircleBtn: document.getElementById('findFriendsCircleBtn'),
    backToChats: document.getElementById('backToChats'),
    chatWithUser: document.getElementById('chatWithUser'),
    chatStatus: document.getElementById('chatStatus'),
    chatHeaderInfo: document.getElementById('chatHeaderInfo'),
    privateMessages: document.getElementById('privateMessages'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    registerUsername: document.getElementById('registerUsername'),
    registerPhone: document.getElementById('registerPhone'),
    registerButton: document.getElementById('registerButton'),
    registerError: document.getElementById('registerError'),
    codeInput: document.getElementById('codeInput'),
    codeError: document.getElementById('codeError'),
    verifyCodeBtn: document.getElementById('verifyCodeBtn'),
    resendCodeBtn: document.getElementById('resendCodeBtn'),
    phoneDisplay: document.getElementById('phoneDisplay'),
    usernameDisplay: document.getElementById('usernameDisplay'),
    sideMenu: document.getElementById('sideMenu'),
    closeMenu: document.getElementById('closeMenu'),
    myProfileBtn: document.getElementById('myProfileBtn'),
    currentUsernameDisplay: document.getElementById('currentUsernameDisplay'),
    userAvatar: document.getElementById('userAvatar'),
    userStatusDisplay: document.getElementById('userStatusDisplay'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    contactsBtn: document.getElementById('contactsBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    editProfileModal: document.getElementById('editProfileModal'),
    editUsername: document.getElementById('editUsername'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    editUsernameError: document.getElementById('editUsernameError'),
    settingsModal: document.getElementById('settingsModal'),
    hidePhoneToggle: document.getElementById('hidePhoneToggle'),
    myPhoneNumberDisplay: document.getElementById('myPhoneNumberDisplay'),
    userProfileModal: document.getElementById('userProfileModal'),
    profileUsername: document.getElementById('profileUsername'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profilePhone: document.getElementById('profilePhone'),
    profilePhoneContainer: document.getElementById('profilePhoneContainer'),
    profileStatus: document.getElementById('profileStatus'),
    startChatFromProfile: document.getElementById('startChatFromProfile'),
    findFriendsModal: document.getElementById('findFriendsModal'),
    searchUsername: document.getElementById('searchUsername'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    contactsModal: document.getElementById('contactsModal'),
    contactsList: document.getElementById('contactsList'),
    chatsTitle: document.getElementById('chatsTitle')
};

let currentUser = null;
let currentChatWith = null;
let currentChatUserId = null;
let isChatActive = false;
let isPageVisible = true;
let chats = [];
let unreadCounts = {};
let onlineUsers = new Map();
let typingUsers = new Map();
let messagesUnsubscribe = null;
let chatsUnsubscribe = null;
let usersUnsubscribe = null;
let typingUnsubscribe = null;
let heartbeatInterval = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let messageListener = null;
let connectionId = null;
let typingTimer = null;
let recaptchaVerifier = null;
let confirmationResult = null;
let pendingUsername = '';
let pendingPhone = '';

function showToast(text) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 10000;
        animation: fadeInOut 2s ease;
    `;
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

document.addEventListener('DOMContentLoaded', function() {
    init();
});

function init() {
    checkUser();
    setupEventListeners();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    setInterval(cleanupOldConnections, 3000);
}

async function cleanupOldConnections() {
    try {
        const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();
        const usersSnapshot = await db.collection('users').get();
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            
            const activeConnections = await db.collection('users')
                .doc(userId)
                .collection('connections')
                .where('is_online', '==', true)
                .where('last_seen', '>', threeSecondsAgo)
                .get();
            
            const shouldBeOnline = !activeConnections.empty;
            const currentStatus = userDoc.data().is_online;
            
            if (currentStatus !== shouldBeOnline) {
                await db.collection('users').doc(userId).update({
                    is_online: shouldBeOnline,
                    last_check: new Date().toISOString()
                });
            }
            
            const deadConnections = await db.collection('users')
                .doc(userId)
                .collection('connections')
                .where('is_online', '==', true)
                .where('last_seen', '<', threeSecondsAgo)
                .get();
            
            deadConnections.forEach(doc => {
                doc.ref.update({ is_online: false });
            });
        }
    } catch (e) {}
}

function handleVisibilityChange() {
    isPageVisible = !document.hidden;
    if (currentUser && connectionId) {
        updateOnlineStatus(!document.hidden);
    }
}

function handleBeforeUnload() {
    if (currentUser && connectionId) {
        removeConnection();
    }
}

async function updateOnlineStatus(isOnline) {
    if (!currentUser || !connectionId) return;
    
    try {
        const now = new Date().toISOString();
        
        await db.collection('users')
            .doc(currentUser.uid)
            .collection('connections')
            .doc(connectionId)
            .set({
                connection_id: connectionId,
                is_online: isOnline,
                last_seen: now,
                device: isMobile ? 'mobile' : 'desktop'
            });
        
        await db.collection('users')
            .doc(currentUser.uid)
            .update({
                is_online: isOnline,
                last_seen: now
            });
    } catch (e) {}
}

async function createConnection() {
    if (!currentUser) return;
    
    try {
        const now = new Date().toISOString();
        connectionId = 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await db.collection('users')
            .doc(currentUser.uid)
            .collection('connections')
            .doc(connectionId)
            .set({
                connection_id: connectionId,
                created_at: now,
                last_seen: now,
                is_online: true,
                device: isMobile ? 'mobile' : 'desktop'
            });
        
        await db.collection('users')
            .doc(currentUser.uid)
            .set({
                uid: currentUser.uid,
                username: currentUser.username,
                phone: currentUser.phone || '',
                hidePhone: currentUser.hidePhone || false,
                is_online: true,
                last_seen: now
            }, { merge: true });
    } catch (e) {}
}

async function removeConnection() {
    if (!currentUser || !connectionId) return;
    
    try {
        const now = new Date().toISOString();
        
        await db.collection('users')
            .doc(currentUser.uid)
            .collection('connections')
            .doc(connectionId)
            .update({
                is_online: false,
                last_seen: now
            });
        
        const activeConnections = await db.collection('users')
            .doc(currentUser.uid)
            .collection('connections')
            .where('is_online', '==', true)
            .get();
        
        if (activeConnections.empty) {
            await db.collection('users')
                .doc(currentUser.uid)
                .update({
                    is_online: false,
                    last_seen: now
                });
        }
    } catch (e) {}
}

async function checkUser() {
    showLoading(true);
    try {
        const saved = localStorage.getItem('speednexus_user');
        if (saved) {
            const userData = JSON.parse(saved);
            const userDoc = await db.collection('users').doc(userData.uid).get();
              
            if (userDoc.exists) {
                currentUser = {
                    uid: userDoc.id,
                    username: userDoc.data().username,
                    phone: userDoc.data().phone || '',
                    hidePhone: userDoc.data().hidePhone || false
                };
                
                if (elements.hidePhoneToggle) {
                    elements.hidePhoneToggle.checked = currentUser.hidePhone;
                }
                
                await createConnection();
                await updateOnlineStatus(true);
                  
                showChats();
                updateUI();
                setupRealtimeSubscriptions();
                loadChats();
                startHeartbeat();
                setupTypingListener();
            } else {
                localStorage.removeItem('speednexus_user');
                showRegister();
            }
        } else {
            showRegister();
        }
    } catch (e) {
        showRegister();
    } finally {
        showLoading(false);
    }
}

function showRegister() {
    stopHeartbeat();
    cleanupSubscriptions();
    elements.registerScreen.style.display = 'flex';
    elements.codeScreen.style.display = 'none';
    elements.chatsScreen.style.display = 'none';
    elements.chatScreen.style.display = 'none';
}

function showChats() {
    elements.registerScreen.style.display = 'none';
    elements.codeScreen.style.display = 'none';
    elements.chatsScreen.style.display = 'flex';
    elements.chatScreen.style.display = 'none';
    elements.chatsTitle.textContent = `Чаты (${currentUser?.username || ''})`;
}

function formatPhoneNumber(e) {
    let input = e.target.value.replace(/\D/g, '');
    if (input.startsWith('7')) input = '+' + input;
    else if (!input.startsWith('+')) input = '+7' + input;
    
    const match = input.match(/^(\+7)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
    if (match) {
        e.target.value = match[1] + (match[2] ? ' (' + match[2] + ')' : '') + 
                         (match[3] ? ' ' + match[3] : '') + 
                         (match[4] ? '-' + match[4] : '') + 
                         (match[5] ? '-' + match[5] : '');
    }
}

async function startRegistration() {
    const username = elements.registerUsername.value.trim();
    const phone = elements.registerPhone.value.replace(/\D/g, '');
    
    if (!username || username.length < 3) {
        showError(elements.registerError, 'Никнейм минимум 3 символа');
        return;
    }
    
    if (username.length > 15) {
        showError(elements.registerError, 'Никнейм максимум 15 символов');
        return;
    }
    
    if (!phone.startsWith('7')) {
        showError(elements.registerError, 'Введите корректный номер телефона');
        return;
    }
    
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
        showError(elements.registerError, 'Этот никнейм уже занят');
        return;
    }
    
    showLoading(true);
    try {
        const fullPhone = '+' + phone;
        
        pendingUsername = username;
        pendingPhone = fullPhone;
        
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }
        
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('registerButton', {
            size: 'invisible',
            callback: function(response) {
                console.log('reCAPTCHA solved');
            }
        });
        
        recaptchaVerifier = window.recaptchaVerifier;
        
        const appVerifier = recaptchaVerifier;
        
        confirmationResult = await auth.signInWithPhoneNumber(fullPhone, appVerifier);
        
        elements.phoneDisplay.textContent = elements.registerPhone.value;
        elements.usernameDisplay.textContent = username;
        elements.registerScreen.style.display = 'none';
        elements.codeScreen.style.display = 'flex';
        elements.registerError.style.display = 'none';
        
    } catch (error) {
        console.error('Firebase error:', error);
        
        if (error.code === 'auth/too-many-requests') {
            showError(elements.registerError, 'Слишком много попыток. Попробуйте завтра');
        } else if (error.code === 'auth/quota-exceeded') {
            showError(elements.registerError, 'Лимит SMS на сегодня. Попробуйте завтра');
        } else if (error.code === 'auth/invalid-phone-number') {
            showError(elements.registerError, 'Неверный номер телефона');
        } else {
            showError(elements.registerError, 'Ошибка отправки кода');
        }
        
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }
    } finally {
        showLoading(false);
    }
}

async function verifyCode() {
    const code = elements.codeInput.value.trim();
    if (!code || code.length < 6) {
        showError(elements.codeError, 'Введите код');
        return;
    }
    
    showLoading(true);
    try {
        const result = await confirmationResult.confirm(code);
        const user = result.user;
        
        const uid = user.uid;
        
        await db.collection('users').doc(uid).set({
            uid: uid,
            phone: pendingPhone,
            username: pendingUsername,
            hidePhone: false,
            is_online: true,
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString()
        });
        
        currentUser = {
            uid: uid,
            username: pendingUsername,
            phone: pendingPhone,
            hidePhone: false
        };
        
        if (elements.hidePhoneToggle) {
            elements.hidePhoneToggle.checked = false;
        }
        
        await createConnection();
        localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
        
        elements.codeScreen.style.display = 'none';
        showChats();
        updateUI();
        setupRealtimeSubscriptions();
        loadChats();
        startHeartbeat();
        setupTypingListener();
        
    } catch (error) {
        console.error('Verify error:', error);
        showError(elements.codeError, 'Неверный код');
    } finally {
        showLoading(false);
    }
}

async function resendCode() {
    if (!pendingPhone) return;
    
    showLoading(true);
    try {
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }
        
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('resendCodeBtn', {
            size: 'invisible'
        });
        
        recaptchaVerifier = window.recaptchaVerifier;
        
        confirmationResult = await auth.signInWithPhoneNumber(pendingPhone, recaptchaVerifier);
        
        showToast('Код отправлен повторно');
        
    } catch (error) {
        console.error('Resend error:', error);
        showError(elements.codeError, 'Ошибка отправки кода');
    } finally {
        showLoading(false);
    }
}

function openSavedMessages() {
    if (!currentUser) return;
    
    currentChatWith = 'Заметки';
    currentChatUserId = 'saved_' + currentUser.uid;
    isChatActive = true;
    
    elements.chatWithUser.textContent = 'Заметки';
    elements.chatsScreen.style.display = 'none';
    elements.chatScreen.style.display = 'flex';
    elements.privateMessages.innerHTML = '';
    elements.messageInput.value = '';
    
    loadSavedMessages();
    
    elements.chatStatus.textContent = 'сохраненные заметки';
    elements.chatStatus.style.color = '#4CAF50';
}

function loadSavedMessages() {
    const saved = JSON.parse(localStorage.getItem(`saved_${currentUser.uid}`) || '[]');
    elements.privateMessages.innerHTML = '';
    
    saved.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.className = 'message me';
        
        let timeString = '';
        if (msg.time) {
            const date = new Date(msg.time);
            timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
        
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="text">${escapeHtml(msg.text)}</div>
                <div class="time">${timeString}</div>
            </div>
        `;
        
        elements.privateMessages.appendChild(messageElement);
    });
    
    scrollToBottom();
}

function saveMessageToLocal(text) {
    const saved = JSON.parse(localStorage.getItem(`saved_${currentUser.uid}`) || '[]');
    saved.push({
        text: text,
        time: new Date().toISOString()
    });
    localStorage.setItem(`saved_${currentUser.uid}`, JSON.stringify(saved));
}

async function showChat(username) {
    if (username === 'Заметки') {
        openSavedMessages();
        return;
    }
    
    showLoading(true);
    try {
        const user = await findUserByUsername(username);
        if (!user) {
            return;
        }

        currentChatWith = username;
        currentChatUserId = user.uid;
        isChatActive = true;
          
        elements.chatWithUser.textContent = username;
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'flex';
        elements.privateMessages.innerHTML = '';
        elements.messageInput.value = '';
          
        await loadMessages(user.uid);
        setupTypingDetection();
          
        setTimeout(() => {
            if (isChatActive && isPageVisible) {
                markMessagesAsRead(user.uid);
            }
        }, 1500);
          
        updateChatStatus();
        scrollToBottom();
        setupMessageListener(user.uid);
        
        if (typingUsers.has(user.uid)) {
            showTypingIndicator();
        }
          
    } catch (e) {
    } finally {
        showLoading(false);
    }
}

function setupMessageListener(userId) {
    if (messageListener) {
        messageListener();
    }

    messageListener = db.collection('messages')
        .where('chat_id', '==', [currentUser.uid, userId].sort().join('_'))
        .orderBy('created_at')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    const msgId = change.doc.id;
                      
                    if (!document.querySelector(`[data-message-id="${msgId}"]`)) {
                        const isMyMessage = (msg.sender === currentUser.uid);
                        displayMessage(msg, isMyMessage, msgId);
                          
                        if (isChatActive && currentChatUserId === userId) {
                            scrollToBottom();
                              
                            if (!isMyMessage && !msg.read) {
                                markMessagesAsRead(userId);
                            }
                        }
                    }
                } else if (change.type === 'modified') {
                    const msg = change.doc.data();
                    const msgId = change.doc.id;
                    const messageElement = document.querySelector(`[data-message-id="${msgId}"]`);
                    
                    if (messageElement && msg.read) {
                        const timeElement = messageElement.querySelector('.time');
                        if (timeElement && messageElement.classList.contains('me')) {
                            timeElement.textContent = timeElement.textContent.replace('✓', '✓✓');
                        }
                    }
                }
            });
        });
}

function updateUI() {
    if (currentUser) {
        elements.currentUsernameDisplay.textContent = currentUser.username;
        elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
        elements.userStatusDisplay.textContent = 'на связи';
    }
}

async function showUserProfile(userId, username) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return;
        
        const userData = userDoc.data();
        const isOnline = onlineUsers.get(userId)?.is_online === true;
        
        elements.profileUsername.textContent = username;
        elements.profileName.textContent = username;
        elements.profileAvatar.textContent = username.charAt(0).toUpperCase();
        
        if (userData.hidePhone && userId !== currentUser.uid) {
            elements.profilePhoneContainer.style.display = 'none';
        } else {
            elements.profilePhoneContainer.style.display = 'flex';
            elements.profilePhone.textContent = userData.phone || 'не указан';
        }
        
        elements.profileStatus.textContent = isOnline ? 'на связи' : 'был(а) недавно';
        elements.profileStatus.style.color = isOnline ? '#4CAF50' : 'rgba(255,255,255,0.5)';
        
        elements.startChatFromProfile.onclick = () => {
            hideModal('userProfileModal');
            showChat(username);
        };
        
        showModal('userProfileModal');
        
    } catch (e) {}
}

function setupTypingDetection() {
    if (!currentChatUserId) return;
    
    elements.messageInput.addEventListener('input', () => {
        if (!currentChatUserId) return;
        
        const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
        
        if (typingTimer) {
            clearTimeout(typingTimer);
        } else {
            db.collection('typing').doc(chatId + '_' + currentUser.uid).set({
                userId: currentUser.uid,
                chatId: chatId,
                timestamp: new Date().toISOString()
            });
        }
        
        typingTimer = setTimeout(() => {
            db.collection('typing').doc(chatId + '_' + currentUser.uid).delete();
            typingTimer = null;
        }, 3000);
    });
}

function showTypingIndicator() {
    const statusElement = elements.chatStatus;
    if (!statusElement) return;
    
    statusElement.innerHTML = '<span class="typing-animation">что-то пишет<span>.</span><span>.</span><span>.</span></span>';
    statusElement.style.color = '#b19cd9';
}

function hideTypingIndicator() {
    const statusElement = elements.chatStatus;
    if (!statusElement) return;
    updateChatStatus();
}

function setupEventListeners() {
    elements.registerButton.addEventListener('click', startRegistration);
    elements.registerPhone.addEventListener('input', formatPhoneNumber);
    elements.registerUsername.addEventListener('keypress', e => {
        if (e.key === 'Enter') startRegistration();
    });

    elements.verifyCodeBtn.addEventListener('click', verifyCode);
    elements.resendCodeBtn.addEventListener('click', resendCode);
    elements.codeInput.addEventListener('input', () => {
        if (elements.codeInput.value.length === 6) {
            verifyCode();
        }
    });

    elements.chatsMenuBtn.addEventListener('click', () => {
        elements.sideMenu.style.display = 'block';
        setTimeout(() => elements.sideMenu.classList.add('show'), 10);
    });

    elements.closeMenu.addEventListener('click', closeMenu);
    elements.myProfileBtn.addEventListener('click', () => {
        closeMenu();
        showUserProfile(currentUser.uid, currentUser.username);
    });

    document.addEventListener('click', e => {
        if (!elements.sideMenu.contains(e.target) && !elements.chatsMenuBtn.contains(e.target) && elements.sideMenu.classList.contains('show')) {
            closeMenu();
        }
    });

    elements.findFriendsCircleBtn.addEventListener('click', () => {
        elements.searchUsername.value = '';
        elements.searchResults.innerHTML = '';
        showModal('findFriendsModal');
        setTimeout(() => searchUsers(), 100);
    });

    elements.backToChats.addEventListener('click', () => {
        if (messageListener) {
            messageListener();
            messageListener = null;
        }
        
        if (typingTimer) {
            clearTimeout(typingTimer);
            const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
            db.collection('typing').doc(chatId + '_' + currentUser.uid).delete();
            typingTimer = null;
        }
        
        currentChatWith = null;
        currentChatUserId = null;
        isChatActive = false;
        showChats();
    });

    elements.chatHeaderInfo.addEventListener('click', () => {
        if (currentChatUserId && !currentChatUserId.startsWith('saved_')) {
            showUserProfile(currentChatUserId, currentChatWith);
        }
    });

    elements.editProfileBtn.addEventListener('click', () => {
        elements.editUsername.value = currentUser?.username || '';
        elements.editUsernameError.style.display = 'none';
        showModal('editProfileModal');
        closeMenu();
    });

    elements.saveProfileBtn.addEventListener('click', editProfile);
    
    elements.settingsBtn.addEventListener('click', () => {
        if (elements.myPhoneNumberDisplay) {
            elements.myPhoneNumberDisplay.textContent = currentUser.phone || 'Номер не указан';
            elements.myPhoneNumberDisplay.className = currentUser.hidePhone ? 'phone-number hidden' : 'phone-number';
        }
        showModal('settingsModal');
        closeMenu();
    });

    elements.hidePhoneToggle.addEventListener('change', async () => {
        if (!currentUser) return;
        
        const hidePhone = elements.hidePhoneToggle.checked;
        currentUser.hidePhone = hidePhone;
        
        try {
            await db.collection('users').doc(currentUser.uid).update({
                hidePhone: hidePhone
            });
            
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            if (elements.myPhoneNumberDisplay) {
                elements.myPhoneNumberDisplay.className = hidePhone ? 'phone-number hidden' : 'phone-number';
            }
            
        } catch (e) {}
    });

    elements.searchBtn.addEventListener('click', searchUsers);
    elements.searchUsername.addEventListener('input', debounce(searchUsers, 300));
    elements.contactsBtn.addEventListener('click', () => {
        loadContacts();
        showModal('contactsModal');
        closeMenu();
    });

    elements.logoutBtn.addEventListener('click', logout);
    elements.sendMessageBtn.addEventListener('click', sendMessage);
      
    elements.messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', e => {
            const modal = e.target.closest('.modal');
            if (modal) hideModal(modal.id);
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) hideModal(modal.id);
        });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            if (elements.sideMenu.classList.contains('show')) {
                closeMenu();
            }
        }
    });

    elements.searchChats.addEventListener('input', e => filterChats(e.target.value));
}

function closeMenu() {
    elements.sideMenu.classList.remove('show');
    setTimeout(() => elements.sideMenu.style.display = 'none', 300);
}

function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function hideModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function cleanupSubscriptions() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    if (chatsUnsubscribe) {
        chatsUnsubscribe();
        chatsUnsubscribe = null;
    }
    if (usersUnsubscribe) {
        usersUnsubscribe();
        usersUnsubscribe = null;
    }
    if (messageListener) {
        messageListener();
        messageListener = null;
    }
    if (typingUnsubscribe) {
        typingUnsubscribe();
        typingUnsubscribe = null;
    }
}

function setupRealtimeSubscriptions() {
    cleanupSubscriptions();

    if (!currentUser) return;

    usersUnsubscribe = db.collection('users').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'modified' || change.type === 'added') {
                const userData = change.doc.data();
                onlineUsers.set(change.doc.id, {
                    username: userData.username,
                    is_online: userData.is_online === true,
                    phone: userData.phone,
                    hidePhone: userData.hidePhone || false
                });
                
                if (currentChatUserId === change.doc.id) {
                    currentChatWith = userData.username;
                    elements.chatWithUser.textContent = userData.username;
                }
                
                if (currentUser && change.doc.id === currentUser.uid) {
                    currentUser.username = userData.username;
                    currentUser.phone = userData.phone || currentUser.phone;
                    currentUser.hidePhone = userData.hidePhone || false;
                    localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
                    updateUI();
                    elements.chatsTitle.textContent = `Чаты (${currentUser.username})`;
                    
                    if (elements.hidePhoneToggle) {
                        elements.hidePhoneToggle.checked = currentUser.hidePhone;
                    }
                }
            } else if (change.type === 'removed') {
                onlineUsers.delete(change.doc.id);
            }
        });
          
        if (currentChatWith) {
            updateChatStatus();
        }
        displayChats();
        updateSearchResultsWithStatus();
        updateContactsWithStatus();
    });

    chatsUnsubscribe = db.collection('messages')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('created_at', 'desc')
        .onSnapshot(() => {
            loadChats();
        });
}

function startHeartbeat() {
    stopHeartbeat();
      
    heartbeatInterval = setInterval(() => {
        if (currentUser && connectionId && navigator.onLine && !document.hidden) {
            updateOnlineStatus(true);
        }
    }, 5000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function updateChatStatus() {
    if (!currentChatUserId || !elements.chatStatus) return;
    
    if (currentChatUserId.startsWith('saved_')) {
        elements.chatStatus.textContent = 'сохраненные заметки';
        elements.chatStatus.style.color = '#4CAF50';
        return;
    }
    
    if (typingUsers.has(currentChatUserId)) {
        showTypingIndicator();
        return;
    }
    
    const user = onlineUsers.get(currentChatUserId);
    const isOnline = user?.is_online === true;
      
    if (isOnline) {
        elements.chatStatus.textContent = 'на связи';
        elements.chatStatus.style.color = '#4CAF50';
    } else {
        elements.chatStatus.textContent = 'был(а) недавно';
        elements.chatStatus.style.color = 'rgba(255,255,255,0.5)';
    }
}

async function findUserByUsername(username) {
    const snapshot = await db.collection('users').where('username', '==', username).get();
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
            uid: doc.id,
            username: doc.data().username,
            phone: doc.data().phone,
            hidePhone: doc.data().hidePhone || false
        };
    }
    return null;
}

async function findUserById(userId) {
    const doc = await db.collection('users').doc(userId).get();
    if (doc.exists) {
        return {
            uid: doc.id,
            username: doc.data().username,
            phone: doc.data().phone,
            hidePhone: doc.data().hidePhone || false
        };
    }
    return null;
}

async function loadChats() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.collection('messages')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('created_at', 'desc')
            .get();

        const chatsMap = new Map();
        const newUnreadCounts = {};

        const promises = snapshot.docs.map(async (doc) => {
            const msg = doc.data();
            const otherUserId = msg.sender === currentUser.uid ? msg.receiver : msg.sender;
              
            let otherUsername = onlineUsers.get(otherUserId)?.username;
            if (!otherUsername) {
                const user = await findUserById(otherUserId);
                if (user) {
                    otherUsername = user.username;
                } else {
                    otherUsername = otherUserId;
                }
            }
              
            return { msg, otherUserId, otherUsername };
        });

        const results = await Promise.all(promises);
          
        results.forEach(({ msg, otherUserId, otherUsername }) => {
            if (!chatsMap.has(otherUserId) || new Date(msg.created_at) > new Date(chatsMap.get(otherUserId).lastTime)) {
                chatsMap.set(otherUserId, {
                    userId: otherUserId,
                    username: otherUsername,
                    lastMessage: msg.message,
                    lastTime: msg.created_at,
                    isMyMessage: msg.sender === currentUser.uid,
                    type: msg.type || 'text'
                });
            }
              
            if (msg.receiver === currentUser.uid && !msg.read) {
                newUnreadCounts[otherUserId] = (newUnreadCounts[otherUserId] || 0) + 1;
            }
        });

        chats = Array.from(chatsMap.values());
        unreadCounts = newUnreadCounts;
        displayChats();
        updateTitle();
    } catch (e) {}
}

function displayChats() {
    if (!elements.chatsList) return;
    
    elements.chatsList.innerHTML = '';
    
    if (!currentUser) return;
    
    const savedElement = document.createElement('div');
    savedElement.className = 'chat-item saved-chat';
    savedElement.onclick = openSavedMessages;
    
    const saved = JSON.parse(localStorage.getItem(`saved_${currentUser.uid}`) || '[]');
    const lastSaved = saved.length > 0 ? saved[saved.length - 1] : null;
    const lastMessage = lastSaved ? lastSaved.text : 'Нет заметок';
    const lastTime = lastSaved ? lastSaved.time : null;
    
    savedElement.innerHTML = `
        <div class="chat-avatar"></div>
        <div class="chat-info">
            <div class="chat-name">
                Заметки
                <span class="saved-badge">${saved.length}</span>
            </div>
            <div class="chat-last-message">${escapeHtml(lastMessage.substring(0, 30))}${lastMessage.length > 30 ? '...' : ''}</div>
            <div class="chat-time">${lastTime ? formatMessageTime(lastTime) : ''}</div>
        </div>
    `;
    
    elements.chatsList.appendChild(savedElement);
    
    const searchTerm = elements.searchChats.value.toLowerCase();
    let filteredChats = chats || [];
      
    if (searchTerm) {
        filteredChats = filteredChats.filter(chat => chat.username.toLowerCase().includes(searchTerm));
    }
      
    const sortedChats = [...filteredChats].sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
      
    sortedChats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        
        div.onclick = () => showChat(chat.username);
        
        const userStatus = onlineUsers.get(chat.userId);
        const isOnline = userStatus?.is_online === true;
        const isTyping = typingUsers.has(chat.userId);
        const unreadCount = unreadCounts[chat.userId] || 0;
        const timeString = formatMessageTime(chat.lastTime);
        const messagePrefix = chat.isMyMessage ? 'Вы: ' : '';
        let displayMessage = chat.lastMessage.length > 30 ? chat.lastMessage.substring(0, 30) + '...' : chat.lastMessage;
        
        if (isTyping) {
            displayMessage = '<span class="typing-animation-small">что-то пишет<span>.</span><span>.</span><span>.</span></span>';
        } else {
            displayMessage = escapeHtml(messagePrefix + displayMessage);
        }
          
        div.innerHTML = `
            <div class="chat-avatar ${isOnline ? 'online' : ''}">${escapeHtml(chat.username.charAt(0).toUpperCase())}</div>
            <div class="chat-info">
                <div class="chat-name">
                    ${escapeHtml(chat.username)}
                    <span class="chat-status-text ${isOnline ? 'online' : ''}">${isOnline ? 'на связи' : 'без связи'}</span>
                </div>
                <div class="chat-last-message ${isTyping ? 'typing-message' : ''}">${displayMessage}</div>
                <div class="chat-time">${timeString}</div>
            </div>
            ${unreadCount ? `<div class="unread-badge">${unreadCount}</div>` : ''}
        `;
        
        const avatar = div.querySelector('.chat-avatar');
        const nameSpan = div.querySelector('.chat-name');
        
        avatar.addEventListener('click', (e) => {
            e.stopPropagation();
            showUserProfile(chat.userId, chat.username);
        });
        
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            showUserProfile(chat.userId, chat.username);
        });
          
        elements.chatsList.appendChild(div);
    });
}

function filterChats(searchTerm) {
    displayChats();
}

async function loadMessages(userId) {
    if (!userId || !currentUser) return;
      
    try {
        const snapshot = await db.collection('messages')
            .where('chat_id', '==', [currentUser.uid, userId].sort().join('_'))
            .orderBy('created_at')
            .get();

        elements.privateMessages.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMyMessage = (msg.sender === currentUser.uid);
            displayMessage(msg, isMyMessage, doc.id);
        });
          
        scrollToBottom();
    } catch (e) {}
}

function displayMessage(msg, isMyMessage, msgId) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isMyMessage ? 'me' : 'other'}`;
    messageElement.dataset.messageId = msgId;
    
    let timeString = '';
    let messageDate = null;
    
    if (msg.created_at) {
        try {
            messageDate = new Date(msg.created_at);
            if (!isNaN(messageDate.getTime())) {
                timeString = messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            } else {
                messageDate = new Date();
                timeString = messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {
            messageDate = new Date();
            timeString = messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
    } else {
        messageDate = new Date();
        timeString = messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    const lastMessage = elements.privateMessages.lastElementChild;
    let showDateSeparator = true;
    
    if (lastMessage && lastMessage.classList.contains('message')) {
        const lastMsgId = lastMessage.dataset.messageId;
        const lastMsgElement = document.querySelector(`[data-message-id="${lastMsgId}"]`);
        
        if (lastMsgElement) {
            const lastMsgTimeAttr = lastMsgElement.querySelector('.message-content .time')?.getAttribute('data-fulltime');
            if (lastMsgTimeAttr) {
                const lastDate = new Date(lastMsgTimeAttr);
                if (lastDate.toDateString() === messageDate.toDateString()) {
                    showDateSeparator = false;
                }
            }
        }
    }
    
    if (showDateSeparator) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        
        const dateStr = messageDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        separator.innerHTML = `<span>${dateStr}</span>`;
        elements.privateMessages.appendChild(separator);
    }
    
    const statusSymbol = isMyMessage ? (msg.read ? '✓✓' : '✓') : '';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `
        <div class="text">${escapeHtml(msg.message)}</div>
        <div class="time" data-fulltime="${msg.created_at || ''}">${timeString} ${statusSymbol}</div>
    `;
    
    messageElement.appendChild(messageContent);
    elements.privateMessages.appendChild(messageElement);
}

function scrollToBottom() {
    if (elements.privateMessages) {
        elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
    }
}

async function sendMessage() {
    if (!currentChatUserId || !currentUser || !elements.messageInput.value.trim()) return;
    
    const messageText = elements.messageInput.value.trim();
    elements.messageInput.value = '';
    
    if (currentChatUserId.startsWith('saved_')) {
        saveMessageToLocal(messageText);
        loadSavedMessages();
        displayChats();
        return;
    }
    
    if (typingTimer) {
        clearTimeout(typingTimer);
        const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
        await db.collection('typing').doc(chatId + '_' + currentUser.uid).delete();
        typingTimer = null;
    }
    
    const participantsArray = [currentUser.uid, currentChatUserId].sort();
    const chatId = participantsArray.join('_');
      
    try {
        await db.collection('messages').add({
            chat_id: chatId,
            participants: participantsArray,
            sender: currentUser.uid,
            receiver: currentChatUserId,
            message: messageText,
            type: 'text',
            read: false,
            created_at: new Date().toISOString()
        });
    } catch (e) {}
}

async function markMessagesAsRead(userId) {
    if (!userId || !currentUser || !isChatActive || !isPageVisible) return;
    
    try {
        const snapshot = await db.collection('messages')
            .where('receiver', '==', currentUser.uid)
            .where('sender', '==', userId)
            .where('read', '==', false)
            .get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { 
                    read: true,
                    read_at: new Date().toISOString()
                });
            });
            
            await batch.commit();
            
            if (unreadCounts[userId]) {
                delete unreadCounts[userId];
                updateTitle();
                displayChats();
            }
        }
    } catch (e) {}
}

function updateTitle() {
    const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    document.title = totalUnread ? `(${totalUnread}) SpeedNexus` : 'SpeedNexus';
}

async function editProfile() {
    const newUsername = elements.editUsername.value.trim();
    if (!newUsername || newUsername.length < 3) {
        showError(elements.editUsernameError, 'Минимум 3 символа');
        return;
    }
      
    if (newUsername.length > 15) {
        showError(elements.editUsernameError, 'Максимум 15 символов');
        return;
    }
      
    if (newUsername === currentUser.username) {
        hideModal('editProfileModal');
        return;
    }

    showLoading(true);
    try {
        const existingUser = await findUserByUsername(newUsername);

        if (existingUser && existingUser.uid !== currentUser.uid) {
            showError(elements.editUsernameError, 'Имя пользователя уже занято');
            return;
        }

        await db.collection('users').doc(currentUser.uid).update({
            username: newUsername
        });

        hideModal('editProfileModal');
        
    } catch (e) {
        showError(elements.editUsernameError, 'Ошибка при изменении профиля');
    } finally {
        showLoading(false);
    }
}

async function searchUsers() {
    const searchTerm = elements.searchUsername.value.trim();
      
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
          
        snapshot.forEach(doc => {
            const user = doc.data();
            if (!searchTerm || user.username.toLowerCase().includes(searchTerm.toLowerCase())) {
                if (user.username !== currentUser?.username) {
                    users.push(user);
                }
            }
        });

        elements.searchResults.innerHTML = '';
          
        if (users.length === 0) {
            elements.searchResults.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Пользователи не найдены</div>';
            return;
        }

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-result';
            
            const avatar = document.createElement('div');
            avatar.className = `user-result-avatar ${onlineUsers.get(user.uid)?.is_online ? 'online' : ''}`;
            avatar.textContent = user.username.charAt(0).toUpperCase();
            
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                hideModal('findFriendsModal');
                showUserProfile(user.uid, user.username);
            });
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'user-result-name';
            nameSpan.textContent = user.username;
            
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                hideModal('findFriendsModal');
                showUserProfile(user.uid, user.username);
            });
            
            const infoDiv = document.createElement('div');
            infoDiv.appendChild(nameSpan);
            
            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = 'color: rgba(255,255,255,0.7); font-size: 12px;';
            statusDiv.textContent = onlineUsers.get(user.uid)?.is_online ? 'на связи' : 'без связи';
            infoDiv.appendChild(statusDiv);
            
            const infoWrapper = document.createElement('div');
            infoWrapper.className = 'user-result-info';
            infoWrapper.appendChild(avatar);
            infoWrapper.appendChild(infoDiv);
            
            userElement.appendChild(infoWrapper);
            
            userElement.addEventListener('click', () => {
                hideModal('findFriendsModal');
                showChat(user.username);
            });
              
            elements.searchResults.appendChild(userElement);
        });
    } catch (e) {
        elements.searchResults.innerHTML = '<div style="color: #ff7d7d; text-align: center;">Ошибка при поиске</div>';
    }
}

function updateSearchResultsWithStatus() {
    const searchResults = document.querySelectorAll('.user-result');
    searchResults.forEach(result => {
        const nameElement = result.querySelector('.user-result-name');
        if (nameElement) {
            const username = nameElement.textContent;
            findUserByUsername(username).then(user => {
                if (user) {
                    const isOnline = onlineUsers.get(user.uid)?.is_online === true;
                    const avatarElement = result.querySelector('.user-result-avatar');
                    const statusElement = result.querySelector('div[style*="font-size: 12px"]');
                      
                    if (avatarElement) {
                        avatarElement.className = `user-result-avatar ${isOnline ? 'online' : ''}`;
                    }
                    if (statusElement) {
                        statusElement.textContent = isOnline ? 'на связи' : 'без связи';
                    }
                }
            });
        }
    });
}

function updateContactsWithStatus() {
    const contactsItems = document.querySelectorAll('.contact-item');
    contactsItems.forEach(item => {
        const nameElement = item.querySelector('.contact-name');
        if (nameElement) {
            const username = nameElement.textContent;
            findUserByUsername(username).then(user => {
                if (user) {
                    const isOnline = onlineUsers.get(user.uid)?.is_online === true;
                    const avatarElement = item.querySelector('.contact-avatar');
                    const statusElement = item.querySelector('div[style*="font-size: 12px"]');
                      
                    if (avatarElement) {
                        avatarElement.className = `contact-avatar ${isOnline ? 'online' : ''}`;
                    }
                    if (statusElement) {
                        statusElement.textContent = isOnline ? 'на связи' : 'без связи';
                    }
                }
            });
        }
    });
}

function loadContacts() {
    const contacts = JSON.parse(localStorage.getItem('speednexus_contacts') || '[]');
    elements.contactsList.innerHTML = '';
      
    if (contacts.length === 0) {
        elements.contactsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Нет контактов</div>';
        return;
    }

    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        
        findUserByUsername(contact.username).then(user => {
            const isOnline = user ? onlineUsers.get(user.uid)?.is_online === true : false;
            
            const avatar = document.createElement('div');
            avatar.className = `contact-avatar ${isOnline ? 'online' : ''}`;
            avatar.textContent = contact.username.charAt(0).toUpperCase();
            
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                hideModal('contactsModal');
                if (user) {
                    showUserProfile(user.uid, contact.username);
                }
            });
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'contact-name';
            nameSpan.textContent = contact.username;
            
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                hideModal('contactsModal');
                if (user) {
                    showUserProfile(user.uid, contact.username);
                }
            });
            
            const infoDiv = document.createElement('div');
            infoDiv.appendChild(nameSpan);
            
            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = 'color: rgba(255,255,255,0.7); font-size: 12px;';
            statusDiv.textContent = isOnline ? 'на связи' : 'без связи';
            infoDiv.appendChild(statusDiv);
            
            const infoWrapper = document.createElement('div');
            infoWrapper.className = 'contact-info';
            infoWrapper.appendChild(avatar);
            infoWrapper.appendChild(infoDiv);
            
            contactElement.appendChild(infoWrapper);
            
            contactElement.addEventListener('click', () => {
                hideModal('contactsModal');
                showChat(contact.username);
            });
        });
          
        elements.contactsList.appendChild(contactElement);
    });
}

async function logout() {
    showLoading(true);
    
    if (typingTimer) {
        clearTimeout(typingTimer);
        const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
        await db.collection('typing').doc(chatId + '_' + currentUser.uid).delete();
        typingTimer = null;
    }
    
    if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
    }
    
    try {
        await auth.signOut();
        await removeConnection();
    } catch (e) {}
      
    localStorage.removeItem('speednexus_user');
    stopHeartbeat();
    cleanupSubscriptions();
    currentUser = null;
    currentChatWith = null;
    currentChatUserId = null;
    isChatActive = false;
    onlineUsers.clear();
    typingUsers.clear();
    unreadCounts = {};
    pendingUsername = '';
    pendingPhone = '';
    showRegister();
    showLoading(false);
}

function formatMessageTime(timestamp) {
    if (!timestamp) return '';
      
    try {
        const messageDate = new Date(timestamp);
        if (isNaN(messageDate.getTime())) return '';
          
        const now = new Date();
        const diffMs = now - messageDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин`;
        if (diffHours < 24) return `${diffHours} ч`;
        if (diffDays === 1) return 'вчера';
        if (diffDays < 7) return `${diffDays} дн`;
          
        return messageDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch (e) {
        return '';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

})();
