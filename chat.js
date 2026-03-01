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

try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch (error) {
    document.addEventListener('DOMContentLoaded', function() {
        alert('Ошибка подключения к серверу. Пожалуйста, обновите страницу.');
    });
    return;
}

const elements = {
    loginScreen: document.getElementById('loginScreen'),
    chatsScreen: document.getElementById('chatsScreen'),
    chatScreen: document.getElementById('chatScreen'),
    chatsList: document.getElementById('chatsList'),
    searchChats: document.getElementById('searchChats'),
    findFriendsCircleBtn: document.getElementById('findFriendsCircleBtn'),
    attachMediaBtn: document.getElementById('attachMediaBtn'),
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
    chatsTitle: document.getElementById('chatsTitle'),
    chatHeaderAvatar: document.getElementById('chatHeaderAvatar'),
    settingsProfileBtn: document.getElementById('settingsProfileBtn')
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
let pendingTransfers = new Map();

function initMediaDB() {
    const request = indexedDB.open('SpeedNexusMedia', 3);
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('media')) {
            const store = db.createObjectStore('media', { keyPath: 'id' });
            store.createIndex('by_chat', 'chatId');
            store.createIndex('by_timestamp', 'timestamp');
            store.createIndex('by_sender', 'sender');
        }
    };
}

initMediaDB();

function saveMediaToIndexedDB(mediaObj) {
    return new Promise((resolve) => {
        const request = indexedDB.open('SpeedNexusMedia', 3);
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');
            store.put(mediaObj);
            resolve();
        };
        request.onerror = () => resolve();
    });
}

function getMediaFromIndexedDB(mediaId) {
    return new Promise((resolve) => {
        const request = indexedDB.open('SpeedNexusMedia', 3);
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['media'], 'readonly');
            const store = transaction.objectStore('media');
            const getRequest = store.get(mediaId);
            getRequest.onsuccess = () => {
                resolve(getRequest.result);
            };
            getRequest.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
    });
}

function getAllMediaFromIndexedDB(chatId) {
    return new Promise((resolve) => {
        const request = indexedDB.open('SpeedNexusMedia', 3);
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['media'], 'readonly');
            const store = transaction.objectStore('media');
            const index = store.index('by_chat');
            const getRequest = index.getAll(chatId);
            getRequest.onsuccess = () => {
                resolve(getRequest.result);
            };
            getRequest.onerror = () => resolve([]);
        };
        request.onerror = () => resolve([]);
    });
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
    setupMediaTransferListeners();
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

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                const maxSize = 1280;
                
                if (width > height && width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/webp', 0.85);
                URL.revokeObjectURL(img.src);
                
                resolve(compressedDataUrl);
            };
            
            img.onerror = reject;
        };
        
        reader.onerror = reject;
    });
}

async function sendMediaMessage(file) {
    if (!currentChatUserId || !currentUser) {
        showToast('Сначала выберите чат');
        return;
    }
    
    if (currentChatUserId.startsWith('saved_')) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const saved = JSON.parse(localStorage.getItem(`saved_${currentUser.uid}`) || '[]');
            saved.push({
                text: '📷 Фото',
                mediaData: e.target.result,
                type: 'image',
                time: new Date().toISOString()
            });
            localStorage.setItem(`saved_${currentUser.uid}`, JSON.stringify(saved));
            loadSavedMessages();
            displayChats();
        };
        reader.readAsDataURL(file);
        return;
    }
    
    showLoading(true);
    
    try {
        const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
        
        let mediaData;
        if (file.type.startsWith('image/')) {
            mediaData = await compressImage(file);
        } else {
            const reader = new FileReader();
            mediaData = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        }
        
        await saveMediaToIndexedDB({
            id: mediaId,
            chatId: chatId,
            data: mediaData,
            type: file.type.startsWith('image/') ? 'image' : 'video',
            timestamp: new Date().toISOString(),
            sender: currentUser.uid,
            receiver: currentChatUserId
        });
        
        const messageRef = await db.collection('messages').add({
            chat_id: chatId,
            participants: [currentUser.uid, currentChatUserId],
            sender: currentUser.uid,
            receiver: currentChatUserId,
            type: 'media',
            mediaId: mediaId,
            mediaType: file.type.startsWith('image/') ? 'image' : 'video',
            delivered: false,
            read: false,
            created_at: new Date().toISOString()
        });
        
        await db.collection('media_transfers').doc(mediaId).set({
            mediaId: mediaId,
            sender: currentUser.uid,
            receiver: currentChatUserId,
            data: mediaData,
            type: file.type.startsWith('image/') ? 'image' : 'video',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60000).toISOString()
        });
        
        setTimeout(async () => {
            try {
                await db.collection('media_transfers').doc(mediaId).delete();
            } catch (e) {}
        }, 60000);
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
        showToast('Ошибка при отправке фото');
    }
}

function setupMediaTransferListeners() {
    db.collection('media_transfers')
        .where('receiver', '==', currentUser?.uid || '')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const transfer = change.doc.data();
                    handleIncomingMedia(transfer);
                }
            });
        });
}

async function handleIncomingMedia(transfer) {
    const mediaId = transfer.mediaId;
    const existing = await getMediaFromIndexedDB(mediaId);
    
    if (existing) return;
    
    await saveMediaToIndexedDB({
        id: mediaId,
        chatId: [transfer.sender, transfer.receiver].sort().join('_'),
        data: transfer.data,
        type: transfer.type,
        timestamp: transfer.created_at,
        sender: transfer.sender,
        receiver: transfer.receiver
    });
    
    await db.collection('messages')
        .where('mediaId', '==', mediaId)
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                doc.ref.update({ delivered: true });
            });
        });
    
    if (currentChatUserId === transfer.sender) {
        updateMessageWithMedia(mediaId, transfer.data, transfer.type);
    }
}

function updateMessageWithMedia(mediaId, mediaData, mediaType) {
    const messageElement = document.querySelector(`[data-media-id="${mediaId}"]`);
    if (!messageElement) return;
    
    const timeElement = messageElement.querySelector('.time');
    const timeText = timeElement ? timeElement.textContent : '';
    
    if (mediaType === 'image') {
        messageElement.innerHTML = `
            <div class="message-content">
                <img src="${mediaData}" class="media-content" 
                     style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer;"
                     onclick="window.open('${mediaData}')">
                <div class="time">${timeText}</div>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="message-content">
                <video src="${mediaData}" controls 
                       style="max-width: 200px; max-height: 200px; border-radius: 8px;"></video>
                <div class="time">${timeText}</div>
            </div>
        `;
    }
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

function setupTypingListener() {
    if (typingUnsubscribe) {
        typingUnsubscribe();
    }
    
    typingUnsubscribe = db.collection('typing').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                if (data.userId !== currentUser?.uid) {
                    typingUsers.set(data.userId, {
                        isTyping: true,
                        chatId: data.chatId
                    });
                    
                    if (currentChatUserId === data.userId && data.chatId.includes(currentUser.uid)) {
                        showTypingIndicator();
                    }
                    
                    displayChats();
                }
            } else if (change.type === 'removed') {
                const data = change.doc.data();
                typingUsers.delete(data.userId);
                
                if (currentChatUserId === data.userId) {
                    hideTypingIndicator();
                }
                
                displayChats();
            }
        });
    });
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

function showLogin() {
    stopHeartbeat();
    cleanupSubscriptions();
    elements.loginScreen.style.display = 'flex';
    elements.chatsScreen.style.display = 'none';
    elements.chatScreen.style.display = 'none';
}

function showChats() {
    elements.loginScreen.style.display = 'none';
    elements.chatsScreen.style.display = 'flex';
    elements.chatScreen.style.display = 'none';
    elements.chatsTitle.textContent = `Чаты (${currentUser?.username || ''})`;
}

function openSavedMessages() {
    if (!currentUser) return;
    
    currentChatWith = 'Заметки';
    currentChatUserId = 'saved_' + currentUser.uid;
    isChatActive = true;
    
    elements.chatWithUser.textContent = 'Заметки';
    elements.chatHeaderAvatar.textContent = '📌';
    elements.chatHeaderAvatar.classList.remove('online');
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
        
        if (msg.mediaData) {
            messageElement.innerHTML = `
                <div class="message-content">
                    <img src="${msg.mediaData}" style="max-width:200px; border-radius:8px;" 
                         onclick="window.open('${msg.mediaData}')">
                    <div class="time">${timeString}</div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="text">${escapeHtml(msg.text)}</div>
                    <div class="time">${timeString}</div>
                </div>
            `;
        }
        
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
        elements.chatHeaderAvatar.textContent = username.charAt(0).toUpperCase();
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'flex';
        elements.privateMessages.innerHTML = '';
        elements.messageInput.value = '';
        
        updateChatHeaderStatus();
          
        await loadMessages(user.uid);
        setupTypingDetection();
        
        setTimeout(() => {
            if (isChatActive && isPageVisible) {
                markMessagesAsRead(user.uid);
            }
        }, 1000);
          
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

function updateChatHeaderStatus() {
    if (!currentChatUserId || !elements.chatHeaderAvatar) return;
    
    if (currentChatUserId.startsWith('saved_')) {
        elements.chatHeaderAvatar.classList.remove('online');
        return;
    }
    
    const user = onlineUsers.get(currentChatUserId);
    const isOnline = user?.is_online === true;
    
    if (isOnline) {
        elements.chatHeaderAvatar.classList.add('online');
    } else {
        elements.chatHeaderAvatar.classList.remove('online');
    }
}

function setupMessageListener(userId) {
    if (messageListener) {
        messageListener();
    }

    const processedIds = new Set();
    
    document.querySelectorAll('[data-message-id]').forEach(el => {
        processedIds.add(el.dataset.messageId);
    });

    messageListener = db.collection('messages')
        .where('chat_id', '==', [currentUser.uid, userId].sort().join('_'))
        .orderBy('created_at')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const msg = change.doc.data();
                const msgId = change.doc.id;
                
                if (change.type === 'added') {
                    if (!processedIds.has(msgId) && !document.querySelector(`[data-message-id="${msgId}"]`)) {
                        processedIds.add(msgId);
                        
                        const isMyMessage = (msg.sender === currentUser.uid);
                        
                        if (msg.type === 'media') {
                            displayMediaMessage(msg, isMyMessage, msgId);
                        } else {
                            displayMessage(msg, isMyMessage, msgId);
                        }
                        
                        if (isChatActive && currentChatUserId === userId && msg.receiver === currentUser.uid && !msg.read) {
                            setTimeout(() => {
                                change.doc.ref.update({ 
                                    read: true,
                                    read_at: new Date().toISOString()
                                });
                            }, 500);
                        }
                        
                        scrollToBottom();
                    }
                } else if (change.type === 'modified') {
                    const messageElement = document.querySelector(`[data-message-id="${msgId}"]`);
                    if (messageElement && msg.read) {
                        const timeElement = messageElement.querySelector('.time');
                        if (timeElement && messageElement.classList.contains('me')) {
                            let timeText = timeElement.textContent.replace('✓', '').replace('✓✓', '').trim();
                            timeElement.textContent = timeText + ' ✓✓';
                        }
                    }
                }
            });
        });
}

function openMediaPicker() {
    if (!currentChatUserId) {
        showToast('Сначала выберите чат');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = false;
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            sendMediaMessage(file);
        }
    };
    input.click();
}

async function displayMediaMessage(msg, isMyMessage, msgId) {
    if (document.querySelector(`[data-message-id="${msgId}"]`)) {
        return;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isMyMessage ? 'me' : 'other'} media-message`;
    messageElement.dataset.messageId = msgId;
    messageElement.dataset.mediaId = msg.mediaId;
    
    const media = await getMediaFromIndexedDB(msg.mediaId);
    const timeString = formatMessageTime(msg.created_at);
    const statusSymbol = isMyMessage ? (msg.read ? ' ✓✓' : (msg.delivered ? ' ✓' : '')) : '';
    
    if (media) {
        if (msg.mediaType === 'image') {
            messageElement.innerHTML = `
                <div class="message-content">
                    <img src="${media.data}" class="media-content" 
                         style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer;"
                         onclick="window.open('${media.data}')">
                    <div class="time">${timeString}${statusSymbol}</div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-content">
                    <video src="${media.data}" controls 
                           style="max-width: 200px; max-height: 200px; border-radius: 8px;"></video>
                    <div class="time">${timeString}${statusSymbol}</div>
                </div>
            `;
        }
    } else {
        messageElement.innerHTML = `
            <div class="message-content">
                <div style="width: 200px; height: 200px; background: rgba(74,44,140,0.5); 
                            border-radius: 8px; display: flex; align-items: center; 
                            justify-content: center;">
                    <div class="spinner-small"></div>
                    <div style="margin-left: 10px;">Загрузка...</div>
                </div>
                <div class="time">${timeString}${statusSymbol}</div>
            </div>
        `;
        
        if (!isMyMessage) {
            requestMediaFromSender(msg.mediaId, msg.sender);
        }
    }
    
    elements.privateMessages.appendChild(messageElement);
}

async function requestMediaFromSender(mediaId, senderId) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36)}`;
    await db.collection('media_requests').doc(requestId).set({
        mediaId: mediaId,
        requester: currentUser.uid,
        sender: senderId,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30000).toISOString()
    });
    
    setTimeout(async () => {
        try {
            await db.collection('media_requests').doc(requestId).delete();
        } catch (e) {}
    }, 30000);
}

function setupMediaRequestListener() {
    db.collection('media_requests')
        .where('sender', '==', currentUser?.uid || '')
        .where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    const request = change.doc.data();
                    const media = await getMediaFromIndexedDB(request.mediaId);
                    
                    if (media) {
                        await db.collection('media_transfers').doc(request.mediaId).set({
                            mediaId: request.mediaId,
                            sender: currentUser.uid,
                            receiver: request.requester,
                            data: media.data,
                            type: media.type,
                            created_at: new Date().toISOString(),
                            expires_at: new Date(Date.now() + 60000).toISOString()
                        });
                        
                        await change.doc.ref.update({ status: 'completed' });
                        
                        setTimeout(async () => {
                            try {
                                await db.collection('media_transfers').doc(request.mediaId).delete();
                            } catch (e) {}
                        }, 60000);
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

function setupEventListeners() {
    elements.loginButton.addEventListener('click', login);
    elements.loginUsername.addEventListener('keypress', e => e.key === 'Enter' && login());

    elements.findFriendsCircleBtn.addEventListener('click', () => {
        elements.searchUsername.value = '';
        elements.searchResults.innerHTML = '';
        showModal('findFriendsModal');
        setTimeout(() => searchUsers(), 100);
    });
    
    elements.settingsProfileBtn.addEventListener('click', () => {
        elements.editUsername.value = currentUser?.username || '';
        elements.editUsernameError.style.display = 'none';
        showModal('editProfileModal');
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

    elements.editProfileBtn.addEventListener('click', () => {
        elements.editUsername.value = currentUser?.username || '';
        elements.editUsernameError.style.display = 'none';
        showModal('editProfileModal');
    });

    elements.saveProfileBtn.addEventListener('click', editProfile);
    elements.searchBtn.addEventListener('click', searchUsers);
    elements.searchUsername.addEventListener('input', debounce(searchUsers, 300));
    elements.contactsBtn.addEventListener('click', () => {
        loadContacts();
        showModal('contactsModal');
    });

    elements.logoutBtn.addEventListener('click', logout);
    elements.sendMessageBtn.addEventListener('click', sendMessage);
    
    if (elements.attachMediaBtn) {
        elements.attachMediaBtn.addEventListener('click', openMediaPicker);
    }
      
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
                    is_online: userData.is_online === true
                });
                
                if (currentChatUserId === change.doc.id) {
                    currentChatWith = userData.username;
                    elements.chatWithUser.textContent = userData.username;
                    updateChatHeaderStatus();
                }
                
                if (currentUser && change.doc.id === currentUser.uid) {
                    currentUser.username = userData.username;
                    localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
                    updateUI();
                    elements.chatsTitle.textContent = `Чаты (${currentUser.username})`;
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
    
    setupMediaRequestListener();
    setupMediaTransferListeners();
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
            username: doc.data().username
        };
    }
    return null;
}

async function findUserById(userId) {
    const doc = await db.collection('users').doc(userId).get();
    if (doc.exists) {
        return {
            uid: doc.id,
            username: doc.data().username
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
                    lastMessage: msg.type === 'media' ? '📷 Фото' : msg.message,
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
    const lastMessage = lastSaved ? (lastSaved.mediaData ? '📷 Фото' : lastSaved.text) : 'Нет заметок';
    const lastTime = lastSaved ? lastSaved.time : null;
    
    savedElement.innerHTML = `
        <div class="chat-avatar">📌</div>
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
        let displayMessage = chat.lastMessage;
        
        if (chat.type === 'media') {
            displayMessage = '📷 Фото';
        } else {
            displayMessage = displayMessage.length > 30 ? displayMessage.substring(0, 30) + '...' : displayMessage;
        }
        
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
        const processedIds = new Set();
        
        for (const doc of snapshot.docs) {
            const msg = doc.data();
            const msgId = doc.id;
            
            if (!processedIds.has(msgId)) {
                processedIds.add(msgId);
                const isMyMessage = (msg.sender === currentUser.uid);
                
                if (msg.type === 'media') {
                    await displayMediaMessage(msg, isMyMessage, msgId);
                } else {
                    displayMessage(msg, isMyMessage, msgId);
                }
            }
        }
          
        scrollToBottom();
    } catch (e) {}
}

function displayMessage(msg, isMyMessage, msgId) {
    if (document.querySelector(`[data-message-id="${msgId}"]`)) {
        return;
    }
    
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
    
    const statusSymbol = isMyMessage ? (msg.read ? ' ✓✓' : ' ✓') : '';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `
        <div class="text">${escapeHtml(msg.message)}</div>
        <div class="time" data-fulltime="${msg.created_at || ''}">${timeString}${statusSymbol}</div>
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
        const existingUser = await findUserByUsername(username);
        const now = new Date().toISOString();
          
        if (existingUser) {
            currentUser = {
                uid: existingUser.uid,
                username: existingUser.username
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

        await createConnection();
          
        localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
          
        showChats();
        updateUI();
        setupRealtimeSubscriptions();
        loadChats();
        startHeartbeat();
        setupTypingListener();
          
    } catch (e) {
        showError(elements.loginError, 'Ошибка при входе');
        localStorage.removeItem('speednexus_user');
        currentUser = null;
    } finally {
        showLoading(false);
    }
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
            userElement.onclick = () => {
                hideModal('findFriendsModal');
                showChat(user.username);
            };
              
            const isOnline = onlineUsers.get(user.uid)?.is_online === true;
              
            userElement.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar ${isOnline ? 'online' : ''}">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
                    <div>
                        <div class="user-result-name">${escapeHtml(user.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                    </div>
                </div>
            `;
              
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
        contactElement.onclick = () => {
            hideModal('contactsModal');
            showChat(contact.username);
        };
          
        findUserByUsername(contact.username).then(user => {
            const isOnline = user ? onlineUsers.get(user.uid)?.is_online === true : false;
              
            contactElement.innerHTML = `
                <div class="contact-avatar ${isOnline ? 'online' : ''}">${escapeHtml(contact.username.charAt(0).toUpperCase())}</div>
                <div>
                    <div class="contact-name">${escapeHtml(contact.username)}</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                </div>
            `;
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
      
    try {
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
    showLogin();
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
