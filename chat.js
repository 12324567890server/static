(function() {
const firebaseConfig = {
    apiKey: "AIzaSyCVdthLC_AX8EI5lKsL-6UOpP7B01dIjQ8",
    authDomain: "speednexusrus.firebaseapp.com",
    projectId: "speednexusrus",
    storageBucket: "speednexusrus.firebasestorage.app",
    messagingSenderId: "524449944041",
    appId: "1:524449944041:web:362f4343ed1507ec2d3b78"
};

let app, db, storage;

try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    storage = firebase.storage();
} catch (error) {
    alert('Ошибка подключения к Firebase');
    return;
}

const elements = {
    loginScreen: document.getElementById('loginScreen'),
    chatsScreen: document.getElementById('chatsScreen'),
    chatScreen: document.getElementById('chatScreen'),
    chatsList: document.getElementById('chatsList'),
    searchChats: document.getElementById('searchChats'),
    chatsMenuBtn: document.getElementById('chatsMenuBtn'),
    findFriendsCircleBtn: document.getElementById('findFriendsCircleBtn'),
    backToChats: document.getElementById('backToChats'),
    chatWithUser: document.getElementById('chatWithUser'),
    chatStatus: document.getElementById('chatStatus'),
    privateMessages: document.getElementById('privateMessages'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    loginUsername: document.getElementById('loginUsername'),
    loginButton: document.getElementById('loginButton'),
    loginError: document.getElementById('loginError'),
    sideMenu: document.getElementById('sideMenu'),
    closeMenu: document.getElementById('closeMenu'),
    currentUsernameDisplay: document.getElementById('currentUsernameDisplay'),
    userAvatar: document.getElementById('userAvatar'),
    userStatusDisplay: document.getElementById('userStatusDisplay'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    contactsBtn: document.getElementById('contactsBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    editProfileModal: document.getElementById('editProfileModal'),
    editUsername: document.getElementById('editUsername'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    editUsernameError: document.getElementById('editUsernameError'),
    findFriendsModal: document.getElementById('findFriendsModal'),
    searchUsername: document.getElementById('searchUsername'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    contactsModal: document.getElementById('contactsModal'),
    contactsList: document.getElementById('contactsList'),
    chatsTitle: document.getElementById('chatsTitle')
};

let currentUser = null;
let currentChatUser = null;
let onlineUsers = {};
let chats = [];
let messagesListener = null;
let typingListener = null;
let typingTimeout = null;
let currentAvatarFile = null;

document.addEventListener('DOMContentLoaded', init);

function init() {
    checkUser();
    setupEventListeners();
    setInterval(cleanupOfflineUsers, 10000);
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
                    username: userDoc.data().username
                };
                await setOnline(true);
                showChats();
                loadChats();
                startOnlineTracking();
            } else {
                localStorage.removeItem('speednexus_user');
                showLogin();
            }
        } else {
            showLogin();
        }
    } catch (e) {
        showLogin();
    } finally {
        showLoading(false);
    }
}

function showLogin() {
    elements.loginScreen.style.display = 'flex';
    elements.chatsScreen.style.display = 'none';
    elements.chatScreen.style.display = 'none';
}

function showChats() {
    elements.loginScreen.style.display = 'none';
    elements.chatsScreen.style.display = 'flex';
    elements.chatScreen.style.display = 'none';
    updateUI();
}

function setupEventListeners() {
    elements.loginButton.addEventListener('click', login);
    elements.loginUsername.addEventListener('keypress', e => e.key === 'Enter' && login());
    
    elements.chatsMenuBtn.addEventListener('click', () => {
        elements.sideMenu.style.display = 'block';
        setTimeout(() => elements.sideMenu.classList.add('show'), 10);
    });
    
    elements.closeMenu.addEventListener('click', () => {
        elements.sideMenu.classList.remove('show');
        setTimeout(() => elements.sideMenu.style.display = 'none', 300);
    });
    
    elements.findFriendsCircleBtn.addEventListener('click', () => {
        elements.searchUsername.value = '';
        elements.searchResults.innerHTML = '';
        elements.findFriendsModal.style.display = 'flex';
        setTimeout(() => searchUsers(), 100);
    });
    
    elements.backToChats.addEventListener('click', () => {
        if (messagesListener) {
            messagesListener();
            messagesListener = null;
        }
        if (typingListener) {
            typingListener();
            typingListener = null;
        }
        currentChatUser = null;
        showChats();
    });
    
    elements.editProfileBtn.addEventListener('click', () => {
        elements.editUsername.value = currentUser?.username || '';
        elements.editUsernameError.style.display = 'none';
        loadAvatarPreview();
        elements.editProfileModal.style.display = 'flex';
    });
    
    elements.saveProfileBtn.addEventListener('click', editProfile);
    
    elements.searchBtn.addEventListener('click', searchUsers);
    elements.searchUsername.addEventListener('input', debounce(searchUsers, 300));
    
    elements.contactsBtn.addEventListener('click', () => {
        loadContacts();
        elements.contactsModal.style.display = 'flex';
    });
    
    elements.logoutBtn.addEventListener('click', logout);
    elements.sendMessageBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());
    elements.messageInput.addEventListener('input', handleTyping);
    
    elements.searchChats.addEventListener('input', filterChats);
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', e => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    const selectAvatarBtn = document.getElementById('selectAvatarBtn');
    const avatarUpload = document.getElementById('avatarUpload');
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    
    if (selectAvatarBtn) {
        selectAvatarBtn.addEventListener('click', () => {
            avatarUpload.click();
        });
    }
    
    if (avatarUpload) {
        avatarUpload.addEventListener('change', handleAvatarSelect);
    }
    
    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', removeAvatar);
    }
}

async function login() {
    const username = elements.loginUsername.value.trim();
    if (!username || username.length < 3) {
        showError(elements.loginError, 'Минимум 3 символа');
        return;
    }
    if (username.length > 15) {
        showError(elements.loginError, 'Максимум 15 символов');
        return;
    }
    
    showLoading(true);
    try {
        const snapshot = await db.collection('users').where('username', '==', username).get();
        const now = new Date().toISOString();
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            currentUser = {
                uid: doc.id,
                username: doc.data().username
            };
            await db.collection('users').doc(currentUser.uid).update({
                is_online: true,
                last_seen: now
            });
        } else {
            const uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            await db.collection('users').doc(uid).set({
                uid: uid,
                username: username,
                is_online: true,
                last_seen: now,
                created_at: now
            });
            currentUser = { uid, username };
        }
        
        localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
        showChats();
        loadChats();
        startOnlineTracking();
        
    } catch (e) {
        showError(elements.loginError, 'Ошибка при входе');
    } finally {
        showLoading(false);
    }
}

async function setOnline(online) {
    if (!currentUser) return;
    await db.collection('users').doc(currentUser.uid).update({
        is_online: online,
        last_seen: new Date().toISOString()
    });
}

function startOnlineTracking() {
    db.collection('users').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const user = change.doc.data();
            onlineUsers[change.doc.id] = {
                online: user.is_online || false,
                username: user.username
            };
            
            if (currentChatUser && currentChatUser.uid === change.doc.id) {
                updateChatStatus(user.is_online);
            }
            
            displayChats();
            updateSearchResults();
        });
    });
}

function cleanupOfflineUsers() {
    const fiveMinAgo = new Date(Date.now() - 300000).toISOString();
    db.collection('users').where('last_seen', '<', fiveMinAgo).get().then(snapshot => {
        snapshot.forEach(doc => {
            if (doc.id !== currentUser?.uid) {
                doc.ref.update({ is_online: false });
            }
        });
    });
}

async function loadChats() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.collection('messages')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('created_at', 'desc')
            .get();
        
        const chatsMap = new Map();
        
        for (const doc of snapshot.docs) {
            const msg = doc.data();
            const otherId = msg.sender === currentUser.uid ? msg.receiver : msg.sender;
            
            if (!chatsMap.has(otherId)) {
                let username = otherId;
                try {
                    const userDoc = await db.collection('users').doc(otherId).get();
                    username = userDoc.data()?.username || otherId;
                } catch (e) {}
                
                chatsMap.set(otherId, {
                    userId: otherId,
                    username: username,
                    lastMessage: msg.message,
                    lastTime: msg.created_at,
                    isMyMessage: msg.sender === currentUser.uid
                });
            }
        }
        
        chats = Array.from(chatsMap.values());
        displayChats();
    } catch (e) {}
}

async function displayChats() {
    if (!elements.chatsList || !currentUser) return;
    
    const search = elements.searchChats.value.toLowerCase();
    let filtered = chats.filter(c => c.username.toLowerCase().includes(search));
    filtered.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    
    elements.chatsList.innerHTML = '';
    
    for (const chat of filtered) {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => openChat(chat.userId, chat.username);
        
        let avatarHtml = chat.username.charAt(0).toUpperCase();
        try {
            const userDoc = await db.collection('users').doc(chat.userId).get();
            if (userDoc.data()?.avatar) {
                avatarHtml = `<img src="${userDoc.data().avatar}" alt="avatar">`;
            }
        } catch (e) {}
        
        const isOnline = onlineUsers[chat.userId]?.online ? 'online' : '';
        
        div.innerHTML = `
            <div class="chat-avatar ${isOnline}">${avatarHtml}</div>
            <div class="chat-info">
                <div class="chat-name">${escapeHtml(chat.username)}</div>
                <div class="chat-last-message">${escapeHtml(chat.lastMessage)}</div>
                <div class="chat-time">${formatTime(chat.lastTime)}</div>
            </div>
        `;
        
        elements.chatsList.appendChild(div);
    }
}

function filterChats() {
    displayChats();
}

async function openChat(userId, username) {
    currentChatUser = { uid: userId, username };
    
    elements.chatWithUser.textContent = username;
    elements.chatsScreen.style.display = 'none';
    elements.chatScreen.style.display = 'flex';
    elements.privateMessages.innerHTML = '';
    
    await loadMessages(userId);
    
    if (messagesListener) messagesListener();
    
    messagesListener = db.collection('messages')
        .where('chat_id', '==', [currentUser.uid, userId].sort().join('_'))
        .orderBy('created_at')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    displayMessage(msg, msg.sender === currentUser.uid);
                    if (msg.receiver === currentUser.uid && !msg.read) {
                        markAsRead(userId);
                    }
                }
            });
            scrollToBottom();
        });
    
    if (typingListener) typingListener();
    
    typingListener = db.collection('typing')
        .where('chat_id', '==', [currentUser.uid, userId].sort().join('_'))
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data();
                    if (data.userId !== currentUser.uid) {
                        showTypingIndicator();
                    }
                } else if (change.type === 'removed') {
                    hideTypingIndicator();
                }
            });
        });
    
    updateChatStatus(onlineUsers[userId]?.online);
    markAsRead(userId);
}

function updateChatStatus(online) {
    if (online) {
        elements.chatStatus.textContent = 'на связи';
        elements.chatStatus.style.color = '#4CAF50';
    } else {
        elements.chatStatus.textContent = 'был(а) недавно';
        elements.chatStatus.style.color = 'rgba(255,255,255,0.5)';
    }
}

function showTypingIndicator() {
    elements.chatStatus.innerHTML = '<span class="typing-animation">что-то пишет<span>.</span><span>.</span><span>.</span></span>';
    elements.chatStatus.style.color = '#b19cd9';
}

function hideTypingIndicator() {
    updateChatStatus(onlineUsers[currentChatUser?.uid]?.online);
}

async function loadMessages(userId) {
    const snapshot = await db.collection('messages')
        .where('chat_id', '==', [currentUser.uid, userId].sort().join('_'))
        .orderBy('created_at')
        .get();
    
    snapshot.forEach(doc => {
        const msg = doc.data();
        displayMessage(msg, msg.sender === currentUser.uid);
    });
    
    scrollToBottom();
}

function displayMessage(msg, isMe) {
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'me' : 'other'}`;
    
    const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit'
    });
    
    div.innerHTML = `
        <div class="message-content">
            <div class="text">${escapeHtml(msg.message)}</div>
            <div class="time">${time}</div>
        </div>
    `;
    
    elements.privateMessages.appendChild(div);
}

function scrollToBottom() {
    elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
}

async function sendMessage() {
    if (!currentChatUser || !elements.messageInput.value.trim()) return;
    
    const text = elements.messageInput.value.trim();
    elements.messageInput.value = '';
    
    const chatId = [currentUser.uid, currentChatUser.uid].sort().join('_');
    
    await db.collection('messages').add({
        chat_id: chatId,
        participants: [currentUser.uid, currentChatUser.uid],
        sender: currentUser.uid,
        receiver: currentChatUser.uid,
        message: text,
        read: false,
        created_at: new Date().toISOString()
    });
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        await db.collection('typing').doc(chatId + '_' + currentUser.uid).delete();
    }
}

function handleTyping() {
    if (!currentChatUser) return;
    
    const chatId = [currentUser.uid, currentChatUser.uid].sort().join('_');
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    } else {
        db.collection('typing').doc(chatId + '_' + currentUser.uid).set({
            userId: currentUser.uid,
            chatId: chatId,
            timestamp: new Date().toISOString()
        });
    }
    
    typingTimeout = setTimeout(async () => {
        await db.collection('typing').doc(chatId + '_' + currentUser.uid).delete();
        typingTimeout = null;
    }, 3000);
}

async function markAsRead(userId) {
    const snapshot = await db.collection('messages')
        .where('receiver', '==', currentUser.uid)
        .where('sender', '==', userId)
        .where('read', '==', false)
        .get();
    
    if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.forEach(doc => batch.update(doc.ref, { read: true }));
        await batch.commit();
    }
}

async function updateUI() {
    if (!currentUser) return;
    
    elements.currentUsernameDisplay.textContent = currentUser.username;
    elements.userStatusDisplay.textContent = 'на связи';
    elements.chatsTitle.textContent = `Чаты (${currentUser.username})`;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const avatarUrl = userDoc.data()?.avatar;
        
        if (avatarUrl) {
            elements.userAvatar.innerHTML = `<img src="${avatarUrl}" alt="avatar">`;
        } else {
            elements.userAvatar.innerHTML = currentUser.username.charAt(0).toUpperCase();
        }
    } catch (e) {
        elements.userAvatar.innerHTML = currentUser.username.charAt(0).toUpperCase();
    }
}

async function loadAvatarPreview() {
    const previewText = document.getElementById('avatarPreviewText');
    const previewImg = document.getElementById('avatarPreviewImage');
    const removeBtn = document.getElementById('removeAvatarBtn');
    
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const avatarUrl = userDoc.data()?.avatar;
        
        if (avatarUrl) {
            previewImg.src = avatarUrl;
            previewImg.style.display = 'block';
            previewText.style.display = 'none';
            removeBtn.style.display = 'block';
        } else {
            previewText.textContent = currentUser.username.charAt(0).toUpperCase();
            previewImg.style.display = 'none';
            previewText.style.display = 'block';
            removeBtn.style.display = 'none';
        }
    } catch (e) {
        previewText.textContent = currentUser.username.charAt(0).toUpperCase();
    }
}

function handleAvatarSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const previewText = document.getElementById('avatarPreviewText');
    const previewImg = document.getElementById('avatarPreviewImage');
    const removeBtn = document.getElementById('removeAvatarBtn');
    
    if (file.size > 2 * 1024 * 1024) {
        alert('Файл слишком большой. Максимум 2MB');
        e.target.value = '';
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        previewText.style.display = 'none';
        removeBtn.style.display = 'block';
        currentAvatarFile = file;
    };
    reader.readAsDataURL(file);
}

async function removeAvatar() {
    const upload = document.getElementById('avatarUpload');
    const previewText = document.getElementById('avatarPreviewText');
    const previewImg = document.getElementById('avatarPreviewImage');
    const removeBtn = document.getElementById('removeAvatarBtn');
    
    upload.value = '';
    previewImg.src = '#';
    previewImg.style.display = 'none';
    previewText.style.display = 'block';
    previewText.textContent = currentUser.username.charAt(0).toUpperCase();
    removeBtn.style.display = 'none';
    currentAvatarFile = null;
    
    await db.collection('users').doc(currentUser.uid).update({ avatar: null });
    updateUI();
    showToast('Аватар удален');
}

async function uploadAvatar(file) {
    const fileName = `avatars/${currentUser.uid}_${Date.now()}.jpg`;
    const ref = storage.ref().child(fileName);
    await ref.put(file);
    return await ref.getDownloadURL();
}

async function editProfile() {
    const newUsername = elements.editUsername.value.trim();
    const file = document.getElementById('avatarUpload').files[0];
    
    showLoading(true);
    try {
        const updates = {};
        
        if (newUsername && newUsername !== currentUser.username) {
            if (newUsername.length < 3) {
                showError(elements.editUsernameError, 'Минимум 3 символа');
                return;
            }
            if (newUsername.length > 15) {
                showError(elements.editUsernameError, 'Максимум 15 символов');
                return;
            }
            
            const existing = await db.collection('users').where('username', '==', newUsername).get();
            if (!existing.empty && existing.docs[0].id !== currentUser.uid) {
                showError(elements.editUsernameError, 'Имя уже занято');
                return;
            }
            
            updates.username = newUsername;
            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
        }
        
        if (file) {
            const url = await uploadAvatar(file);
            updates.avatar = url;
        }
        
        if (Object.keys(updates).length > 0) {
            await db.collection('users').doc(currentUser.uid).update(updates);
        }
        
        elements.editProfileModal.style.display = 'none';
        updateUI();
        loadChats();
        showToast('Профиль обновлен');
        
    } catch (e) {
        showError(elements.editUsernameError, 'Ошибка сохранения');
    } finally {
        showLoading(false);
    }
}

async function searchUsers() {
    const term = elements.searchUsername.value.toLowerCase();
    
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.username.toLowerCase().includes(term) && user.uid !== currentUser?.uid) {
                users.push(user);
            }
        });
        
        elements.searchResults.innerHTML = '';
        
        if (users.length === 0) {
            elements.searchResults.innerHTML = '<div style="text-align:center;padding:20px;">Пользователи не найдены</div>';
            return;
        }
        
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-result';
            div.onclick = () => {
                elements.findFriendsModal.style.display = 'none';
                openChat(user.uid, user.username);
            };
            
            const isOnline = onlineUsers[user.uid]?.online ? 'online' : '';
            let avatarHtml = user.username.charAt(0).toUpperCase();
            if (user.avatar) {
                avatarHtml = `<img src="${user.avatar}" alt="avatar">`;
            }
            
            div.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar ${isOnline}">${avatarHtml}</div>
                    <div>
                        <div class="user-result-name">${escapeHtml(user.username)}</div>
                    </div>
                </div>
            `;
            
            elements.searchResults.appendChild(div);
        });
    } catch (e) {}
}

function updateSearchResults() {
    const results = document.querySelectorAll('.user-result');
    results.forEach(result => {
        const nameEl = result.querySelector('.user-result-name');
        if (nameEl) {
            const username = nameEl.textContent;
            db.collection('users').where('username', '==', username).get().then(snapshot => {
                if (!snapshot.empty) {
                    const user = snapshot.docs[0].data();
                    const isOnline = onlineUsers[snapshot.docs[0].id]?.online ? 'online' : '';
                    const avatarEl = result.querySelector('.user-result-avatar');
                    if (avatarEl) {
                        avatarEl.className = `user-result-avatar ${isOnline}`;
                    }
                }
            });
        }
    });
}

function loadContacts() {
    elements.contactsList.innerHTML = '<div style="text-align:center;padding:20px;">Функция скоро будет</div>';
}

async function logout() {
    showLoading(true);
    await setOnline(false);
    localStorage.removeItem('speednexus_user');
    if (messagesListener) messagesListener();
    if (typingListener) typingListener();
    currentUser = null;
    currentChatUser = null;
    showLogin();
    showLoading(false);
}

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
    `;
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

function debounce(fn, delay) {
    let timer;
    return function() {
        clearTimeout(timer);
        timer = setTimeout(fn, delay);
    };
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' мин';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч';
        if (diff < 172800000) return 'вчера';
        return date.toLocaleDateString();
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
