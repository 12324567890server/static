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

try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    document.addEventListener('DOMContentLoaded', function() {
        alert('Ошибка подключения к серверу. Пожалуйста, обновите страницу.');
    });
    return;
}

const db = firebase.firestore();

const elements = {
    loginScreen: document.getElementById('loginScreen'),
    chatsScreen: document.getElementById('chatsScreen'),
    chatScreen: document.getElementById('chatScreen'),
    chatsList: document.getElementById('chatsList'),
    searchChats: document.getElementById('searchChats'),
    chatsMenuBtn: document.getElementById('chatsMenuBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
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
    newChatModal: document.getElementById('newChatModal'),
    newChatUsername: document.getElementById('newChatUsername'),
    startChatBtn: document.getElementById('startChatBtn'),
    newChatError: document.getElementById('newChatError'),
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
let typingTimeouts = new Map();
let messagesUnsubscribe = null;
let chatsUnsubscribe = null;
let usersUnsubscribe = null;
let typingUnsubscribe = null;
let heartbeatInterval = null;
let lastReadTime = {};
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let messageListener = null;
let scrollPositions = {};
let connectionId = null;

let localStream = null;
let peerConnection = null;
let currentCallId = null;
let callTimer = null;
let callSeconds = 0;
let incomingCallListener = null;
let isMuted = false;
let isVideoEnabled = true;
let ringtoneInterval = null;
let vibrationInterval = null;

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
    ],
    iceCandidatePoolSize: 10
};

document.addEventListener('DOMContentLoaded', function() {
    init();
});

async function createCallsCollection() {
    try {
        await db.collection('calls').doc('_init').set({
            initialized: true,
            timestamp: new Date().toISOString()
        });
    } catch (error) {}
}

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

async function updateUserStatus(userId) {
    try {
        const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();
        const connectionsSnapshot = await db.collection('users')
            .doc(userId)
            .collection('connections')
            .where('is_online', '==', true)
            .where('last_seen', '>', threeSecondsAgo)
            .get();

        const isOnline = !connectionsSnapshot.empty;
          
        await db.collection('users').doc(userId).update({
            is_online: isOnline,
            last_check: new Date().toISOString()
        });
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
    if (peerConnection) {
        peerConnection.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    stopRingtone();
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
                  
                connectionId = 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                  
                await createConnection();
                await updateOnlineStatus(true);
                  
                showChats();
                updateUI();
                setupRealtimeSubscriptions();
                loadChats();
                startHeartbeat();
                setupTypingListener();
                listenForIncomingCalls();
                createCallsCollection();
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

let typingTimer = null;

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

async function showChat(username) {
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
        
        const callButtons = document.querySelector('.call-header-buttons');
        if (callButtons) {
            callButtons.style.display = 'flex';
        }
          
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

function setupEventListeners() {
    elements.loginButton.addEventListener('click', login);
    elements.loginUsername.addEventListener('keypress', e => e.key === 'Enter' && login());

    elements.chatsMenuBtn.addEventListener('click', () => {
        elements.sideMenu.style.display = 'block';
        setTimeout(() => elements.sideMenu.classList.add('show'), 10);
    });

    elements.closeMenu.addEventListener('click', closeMenu);

    document.addEventListener('click', e => {
        if (!elements.sideMenu.contains(e.target) &&   
            !elements.chatsMenuBtn.contains(e.target) &&
            elements.sideMenu.classList.contains('show')) {
            closeMenu();
        }
    });

    elements.newChatBtn.addEventListener('click', () => {
        elements.newChatUsername.value = '';
        elements.newChatError.style.display = 'none';
        showModal('newChatModal');
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
        
        const callButtons = document.querySelector('.call-header-buttons');
        if (callButtons) {
            callButtons.style.display = 'none';
        }
        
        if (peerConnection) {
            endCall();
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
      
    elements.messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    elements.startChatBtn.addEventListener('click', startNewChat);

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
    if (incomingCallListener) {
        incomingCallListener();
        incomingCallListener = null;
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
                    lastMessage: msg.message,
                    lastTime: msg.created_at,
                    isMyMessage: msg.sender === currentUser.uid
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
      
    const searchTerm = elements.searchChats.value.toLowerCase();
    let filteredChats = chats;
      
    if (searchTerm) {
        filteredChats = chats.filter(chat =>   
            chat.username.toLowerCase().includes(searchTerm)
        );
    }
      
    const sortedChats = [...filteredChats].sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
      
    elements.chatsList.innerHTML = '';
      
    if (sortedChats.length === 0) {
        elements.chatsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px;">Нет чатов</div>';
        return;
    }

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
    if (msg.created_at) {
        try {
            const messageDate = new Date(msg.created_at);
            if (!isNaN(messageDate.getTime())) {
                timeString = messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            } else {
                timeString = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {
            timeString = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
    } else {
        timeString = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
      
    const statusSymbol = isMyMessage ? (msg.read ? '✓✓' : '✓') : '';
      
    messageElement.innerHTML = `
        <div class="message-content">
            <div class="text">${escapeHtml(msg.message)}</div>
            <div class="time">${timeString} ${statusSymbol}</div>
        </div>
    `;
      
    elements.privateMessages.appendChild(messageElement);
}

function scrollToBottom() {
    if (elements.privateMessages) {
        elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
    }
}

async function sendMessage() {
    if (!currentChatUserId || !currentUser || !elements.messageInput.value.trim()) return;
    
    if (typingTimer) {
        clearTimeout(typingTimer);
        const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
        await db.collection('typing').doc(chatId + '_' + currentUser.uid).delete();
        typingTimer = null;
    }
      
    const messageText = elements.messageInput.value.trim();
    elements.messageInput.value = '';
    
    const participantsArray = [currentUser.uid, currentChatUserId].sort();
    const chatId = participantsArray.join('_');
      
    try {
        await db.collection('messages').add({
            chat_id: chatId,
            participants: participantsArray,
            sender: currentUser.uid,
            receiver: currentChatUserId,
            message: messageText,
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

async function startNewChat() {
    const username = elements.newChatUsername.value.trim();
    if (!username) {
        showError(elements.newChatError, 'Введите имя пользователя');
        return;
    }
      
    if (username === currentUser.username) {
        showError(elements.newChatError, 'Нельзя начать чат с самим собой');
        return;
    }

    showLoading(true);
    try {
        const user = await findUserByUsername(username);

        if (!user) {
            showError(elements.newChatError, 'Пользователь не найден');
            return;
        }

        hideModal('newChatModal');
        await showChat(username);
    } catch (e) {
        showError(elements.newChatError, 'Ошибка при поиске пользователя');
    } finally {
        showLoading(false);
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

        connectionId = 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
        await createConnection();
          
        localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
          
        showChats();
        updateUI();
        setupRealtimeSubscriptions();
        loadChats();
        startHeartbeat();
        setupTypingListener();
        listenForIncomingCalls();
        createCallsCollection();
          
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
                <div class="contact-info">
                    <div class="contact-avatar ${isOnline ? 'online' : ''}">${escapeHtml(contact.username.charAt(0).toUpperCase())}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                    </div>
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
    
    if (peerConnection) {
        await endCall();
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
    scrollPositions = {};
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

function playRingtone() {
    try {
        if (navigator.vibrate) {
            vibrationInterval = setInterval(() => {
                navigator.vibrate([1000, 500, 1000]);
            }, 2500);
        }
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = () => {
            if (document.getElementById('incomingCallModal').style.display !== 'flex') {
                if (vibrationInterval) {
                    clearInterval(vibrationInterval);
                    vibrationInterval = null;
                }
                return;
            }
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.2;
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 1);
            
            setTimeout(playBeep, 2000);
        };
        
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(playBeep);
        } else {
            playBeep();
        }
    } catch (e) {}
}

function stopRingtone() {
    if (vibrationInterval) {
        clearInterval(vibrationInterval);
        vibrationInterval = null;
    }
}

function listenForIncomingCalls() {
    if (!currentUser) return;
    
    incomingCallListener = db.collection('calls')
        .where('calleeId', '==', currentUser.uid)
        .where('status', '==', 'ringing')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const callData = change.doc.data();
                    showIncomingCall(callData, change.doc.id);
                }
            });
        });
}

function showIncomingCall(callData, callId) {
    currentCallId = callId;
    
    document.getElementById('callerName').textContent = callData.callerName || 'Неизвестно';
    document.getElementById('callerAvatar').textContent = (callData.callerName || 'U').charAt(0).toUpperCase();
    document.getElementById('callType').textContent = callData.type === 'video' ? 'видеозвонок' : 'аудиозвонок';
    
    document.getElementById('incomingCallModal').style.display = 'flex';
    playRingtone();
}

async function initiateCall(isVideo) {
    if (!currentChatUserId) {
        alert('Сначала выберите чат');
        return;
    }

    try {
        showLoading(true);
        
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo
            });
        } catch (mediaError) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });
                isVideo = false;
            } catch (audioError) {
                showLoading(false);
                alert('Нет доступа к микрофону');
                return;
            }
        }

        currentCallId = [currentUser.uid, currentChatUserId].sort().join('_') + '_' + Date.now();

        await db.collection('calls').doc(currentCallId).set({
            callerId: currentUser.uid,
            callerName: currentUser.username,
            calleeId: currentChatUserId,
            status: 'ringing',
            type: isVideo ? 'video' : 'audio',
            createdAt: new Date().toISOString()
        });

        setupCallListener(currentCallId);
        showLoading(false);
        
        setTimeout(() => {
            if (currentCallId) {
                db.collection('calls').doc(currentCallId).get().then(doc => {
                    if (doc.exists && doc.data().status === 'ringing') {
                        endCall();
                        alert('Абонент не ответил');
                    }
                });
            }
        }, 30000);
        
    } catch (error) {
        showLoading(false);
        alert('Ошибка при звонке');
    }
}

function setupCallListener(callId) {
    db.collection('calls').doc(callId).onSnapshot(snapshot => {
        const data = snapshot.data();
        if (!data) return;
        
        if (data.status === 'answered') {
            stopRingtone();
            document.getElementById('incomingCallModal').style.display = 'none';
            startCall(callId, data.type === 'video');
        } else if (data.status === 'declined' || data.status === 'ended') {
            stopRingtone();
            endCall();
        }
    });
}

async function answerCall() {
    if (!currentCallId) return;
    
    try {
        stopRingtone();
        await db.collection('calls').doc(currentCallId).update({
            status: 'answered',
            answeredAt: new Date().toISOString()
        });
        
        document.getElementById('incomingCallModal').style.display = 'none';
        
        const callDoc = await db.collection('calls').doc(currentCallId).get();
        const callData = callDoc.data();
        
        await startCall(currentCallId, callData.type === 'video');
        
    } catch (error) {
        alert('Ошибка при ответе на звонок');
    }
}

async function declineCall() {
    if (!currentCallId) return;
    
    try {
        stopRingtone();
        await db.collection('calls').doc(currentCallId).update({
            status: 'declined'
        });
        
        document.getElementById('incomingCallModal').style.display = 'none';
        currentCallId = null;
        
    } catch (error) {
        alert('Ошибка при отклонении звонка');
    }
}

async function startCall(callId, isVideo) {
    currentCallId = callId;
    
    try {
        const callDoc = await db.collection('calls').doc(callId).get();
        const callData = callDoc.data();
        
        const isCaller = callData.callerId === currentUser.uid;
        const otherUserId = isCaller ? callData.calleeId : callData.callerId;
        
        const otherUser = await findUserById(otherUserId);
        document.getElementById('callParticipant').textContent = otherUser.username;
        
        if (!localStream) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: isVideo
                });
            } catch (mediaError) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                    isVideo = false;
                } catch (audioError) {
                    alert('Нет доступа к микрофону');
                    return;
                }
            }
        }

        peerConnection = new RTCPeerConnection(STUN_SERVERS);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        if (isVideo) {
            document.getElementById('activeCallContainer').style.display = 'block';
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
            }
        } else {
            document.getElementById('activeCallContainer').style.display = 'block';
            document.getElementById('audioOnlyContainer').style.display = 'flex';
            document.getElementById('audioAvatar').textContent = otherUser.username.charAt(0).toUpperCase();
        }

        peerConnection.ontrack = (event) => {
            if (event.track.kind === 'video') {
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = event.streams[0];
                }
            }
        };

        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await db.collection('calls').doc(callId).collection('ice').add({
                    candidate: event.candidate.toJSON(),
                    sender: currentUser.uid,
                    timestamp: new Date().toISOString()
                });
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'failed') {
                setTimeout(() => {
                    if (peerConnection) {
                        peerConnection.restartIce();
                    }
                }, 2000);
            }
        };

        if (isCaller) {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: isVideo
            });
            await peerConnection.setLocalDescription(offer);
            
            await db.collection('calls').doc(callId).update({
                offer: {
                    type: offer.type,
                    sdp: offer.sdp
                }
            });
        } else {
            if (callData.offer) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                await db.collection('calls').doc(callId).update({
                    answer: {
                        type: answer.type,
                        sdp: answer.sdp
                    }
                });
            }
        }

        listenForIceCandidates(callId, isCaller ? callData.calleeId : callData.callerId);
        
        if (!isCaller && callData.offer) {
            listenForAnswer(callId);
        }

        startCallTimer();
        
    } catch (error) {
        alert('Ошибка при начале звонка');
    }
}

function listenForIceCandidates(callId, otherUserId) {
    db.collection('calls').doc(callId).collection('ice')
        .where('sender', '==', otherUserId)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data().candidate);
                    peerConnection.addIceCandidate(candidate);
                }
            });
        });
}

function listenForAnswer(callId) {
    db.collection('calls').doc(callId).onSnapshot(snapshot => {
        const data = snapshot.data();
        if (data && data.answer && !peerConnection.currentRemoteDescription) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });
}

async function endCall() {
    stopRingtone();
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (currentCallId) {
        try {
            await db.collection('calls').doc(currentCallId).update({
                status: 'ended',
                endedAt: new Date().toISOString()
            });
        } catch (e) {}
        currentCallId = null;
    }
    
    document.getElementById('activeCallContainer').style.display = 'none';
    document.getElementById('incomingCallModal').style.display = 'none';
    
    stopCallTimer();
}

function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isMuted = !isMuted;
            audioTrack.enabled = !isMuted;
            document.getElementById('muteButton').style.opacity = isMuted ? '0.5' : '1';
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isVideoEnabled = !isVideoEnabled;
            videoTrack.enabled = isVideoEnabled;
            document.getElementById('videoToggleButton').style.opacity = isVideoEnabled ? '1' : '0.5';
        }
    }
}

function startCallTimer() {
    callSeconds = 0;
    updateCallTimer();
    callTimer = setInterval(updateCallTimer, 1000);
}

function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
}

function updateCallTimer() {
    const minutes = Math.floor(callSeconds / 60);
    const seconds = callSeconds % 60;
    document.getElementById('callTimer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    callSeconds++;
}

window.initiateCall = initiateCall;
window.answerCall = answerCall;
window.declineCall = declineCall;
window.endCall = endCall;
window.toggleMute = toggleMute;
window.toggleVideo = toggleVideo;

window.fixStatus = async function() {
    if (!currentUser) {
        alert('Сначала войдите');
        return;
    }
    
    try {
        await db.collection('users')
            .doc(currentUser.uid)
            .set({
                uid: currentUser.uid,
                username: currentUser.username,
                is_online: true,
                last_seen: new Date().toISOString()
            }, { merge: true });
        
        alert('Статус обновлен! Проверь Firebase');
    } catch (e) {}
};

})();
