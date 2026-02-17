(function() {
const firebaseConfig = {
apiKey: "AIzaSyCVdthLC_AX8EI5lKsL-6UOpP7B01dIjQ8",
authDomain: "speednexusrus.firebaseapp.com",
projectId: "speednexusrus",
storageBucket: "speednexusrus.firebasestorage.app",
messagingSenderId: "524449944041",
appId: "1:524449944041:web:362f4343ed1507ec2d3b78"
};

firebase.initializeApp(firebaseConfig);  
const db = firebase.firestore();  

const elements = {  
    loginScreen: document.getElementById('loginScreen'),  
    chatsScreen: document.getElementById('chatsScreen'),  
    chatScreen: document.getElementById('chatScreen'),  
    chatsList: document.getElementById('chatsList'),  
    searchChats: document.getElementById('searchChats'),  
    chatsMenuBtn: document.getElementById('chatsMenuBtn'),  
    newChatBtn: document.getElementById('newChatBtn'),  
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
    findFriendsBtn: document.getElementById('findFriendsBtn'),  
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
let messagesUnsubscribe = null;  
let chatsUnsubscribe = null;  
let usersUnsubscribe = null;  
let heartbeatInterval = null;  
let lastReadTime = {};  
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);  
let messageListener = null;  
let scrollPositions = {};  
let connectionId = null;  

init();  

function init() {  
    checkUser();  
    setupEventListeners();  
      
    document.addEventListener('visibilitychange', handleVisibilityChange);  
    window.addEventListener('beforeunload', handleBeforeUnload);  
      
    setInterval(cleanupOldConnections, 10000);  
}  

async function cleanupOldConnections() {  
    try {  
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();  
        const connectionsSnapshot = await db.collectionGroup('connections')  
            .where('last_seen', '<', tenSecondsAgo)  
            .where('is_online', '==', true)  
            .get();  

        for (const doc of connectionsSnapshot.docs) {  
            await doc.ref.update({  
                is_online: false,  
                last_seen: new Date().toISOString()  
            });  
              
            const userId = doc.ref.parent.parent.id;  
            await updateUserStatus(userId);  
        }  
    } catch (e) {}  
}  

async function updateUserStatus(userId) {  
    try {  
        const connectionsSnapshot = await db.collection('users')  
            .doc(userId)  
            .collection('connections')  
            .where('is_online', '==', true)  
            .where('last_seen', '>', new Date(Date.now() - 15000).toISOString())  
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
}  

async function updateOnlineStatus(isOnline) {  
    if (!currentUser || !connectionId) return;  
      
    try {  
        const connectionRef = db.collection('users')  
            .doc(currentUser.uid)  
            .collection('connections')  
            .doc(connectionId);  
          
        await connectionRef.set({  
            connection_id: connectionId,  
            is_online: isOnline,  
            last_seen: new Date().toISOString(),  
            device: isMobile ? 'mobile' : 'desktop'  
        }, { merge: true });  
          
        await updateUserStatus(currentUser.uid);  
          
    } catch (e) {}  
}  

async function removeConnection() {  
    if (!currentUser || !connectionId) return;  
      
    try {  
        const connectionRef = db.collection('users')  
            .doc(currentUser.uid)  
            .collection('connections')  
            .doc(connectionId);  
          
        await connectionRef.update({  
            is_online: false,  
            last_seen: new Date().toISOString()  
        });  
          
        await updateUserStatus(currentUser.uid);  
          
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

async function createConnection() {  
    if (!currentUser) return;  
      
    const connectionRef = db.collection('users')  
        .doc(currentUser.uid)  
        .collection('connections')  
        .doc(connectionId);  
      
    await connectionRef.set({  
        connection_id: connectionId,  
        created_at: new Date().toISOString(),  
        last_seen: new Date().toISOString(),  
        is_online: true,  
        device: isMobile ? 'mobile' : 'desktop'  
    });  
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
          
        await loadMessages(user.uid);  
          
        setTimeout(() => {  
            if (isChatActive && isPageVisible) {  
                markMessagesAsRead(user.uid);  
            }  
        }, 1500);  
          
        updateChatStatus();  
        scrollToBottom();  
        setupMessageListener(user.uid);  
          
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

    elements.backToChats.addEventListener('click', () => {  
        if (messageListener) {  
            messageListener();  
            messageListener = null;  
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

    elements.findFriendsBtn.addEventListener('click', () => {  
        elements.searchUsername.value = '';  
        elements.searchResults.innerHTML = '';  
        showModal('findFriendsModal');  
        setTimeout(() => searchUsers(), 100);  
    });  

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
                const userDoc = await db.collection('users').doc(otherUserId).get();  
                if (userDoc.exists) {  
                    otherUsername = userDoc.data().username;  
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
        const unreadCount = unreadCounts[chat.userId] || 0;  
        const timeString = formatMessageTime(chat.lastTime);  
        const messagePrefix = chat.isMyMessage ? 'Вы: ' : '';  
        const displayMessage = chat.lastMessage.length > 30 ? chat.lastMessage.substring(0, 30) + '...' : chat.lastMessage;  
          
        div.innerHTML = `  
            <div class="chat-avatar ${isOnline ? 'online' : ''}">${escapeHtml(chat.username.charAt(0).toUpperCase())}</div>  
            <div class="chat-info">  
                <div class="chat-name">  
                    ${escapeHtml(chat.username)}  
                    <span class="chat-status-text ${isOnline ? 'online' : ''}">${isOnline ? 'на связи' : 'без связи'}</span>  
                </div>  
                <div class="chat-last-message">${escapeHtml(messagePrefix + displayMessage)}</div>  
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
      
    const messageText = elements.messageInput.value.trim();  
    elements.messageInput.value = '';  
      
    const chatId = [currentUser.uid, currentChatUserId].sort().join('_');  
      
    try {  
        await db.collection('messages').add({  
            chat_id: chatId,  
            participants: [currentUser.uid, currentChatUserId],  
            sender: currentUser.uid,  
            receiver: currentChatUserId,  
            message: messageText,  
            read: false,  
            created_at: new Date().toISOString()  
        });  
          
    } catch (e) {}  
}  

async function markMessagesAs
