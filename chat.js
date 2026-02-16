(function() {
    const firebaseConfig = {
        apiKey: "AIzaSyCVdthLC_AX8EI5lKsL-6UOpP7B01dIjQ8",
        authDomain: "speednexusrus.firebaseapp.com",
        databaseURL: "https://speednexusrus-default-rtdb.firebaseio.com",
        projectId: "speednexusrus",
        storageBucket: "speednexusrus.firebasestorage.app",
        messagingSenderId: "524449944041",
        appId: "1:524449944041:web:362f4343ed1507ec2d3b78"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const rtdb = firebase.database();

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
    let messageListener = null;
    let scrollPositions = {};
    let statusListeners = new Map();

    init();

    function init() {
        checkUser();
        setupEventListeners();
        
        document.addEventListener('visibilitychange', () => {
            isPageVisible = !document.hidden;
        });
        
        window.addEventListener('beforeunload', () => {
            if (currentUser) {
                const statusRef = rtdb.ref('/status/' + currentUser.username);
                statusRef.set({
                    state: 'offline',
                    last_changed: firebase.database.ServerValue.TIMESTAMP
                });
            }
        });
    }

    async function setupUserStatus() {
        if (!currentUser) return;
        const statusRef = rtdb.ref('/status/' + currentUser.username);
        statusRef.onDisconnect().set({
            state: 'offline',
            last_changed: firebase.database.ServerValue.TIMESTAMP
        });
        statusRef.set({
            state: 'online',
            last_changed: firebase.database.ServerValue.TIMESTAMP
        });
    }

    function listenToUserStatus(username, callback) {
        if (statusListeners.has(username)) return;
        const statusRef = rtdb.ref('/status/' + username);
        const listener = statusRef.on('value', (snapshot) => {
            callback(snapshot.val());
        });
        statusListeners.set(username, { ref: statusRef, listener });
    }

    function stopListeningToUserStatus(username) {
        if (statusListeners.has(username)) {
            const { ref, listener } = statusListeners.get(username);
            ref.off('value', listener);
            statusListeners.delete(username);
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
                    
                    await setupUserStatus();
                    showChats();
                    updateUI();
                    setupRealtimeSubscriptions();
                    loadChats();
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
        elements.chatsTitle.textContent = `Чаты (${currentUser?.username || ''})`;
    }

    async function showChat(username) {
        showLoading(true);
        try {
            const user = await findUserByUsername(username);
            if (!user) return;

            currentChatWith = username;
            currentChatUserId = user.uid;
            isChatActive = true;
            
            elements.chatWithUser.textContent = username;
            elements.chatsScreen.style.display = 'none';
            elements.chatScreen.style.display = 'flex';
            elements.privateMessages.innerHTML = '';
            elements.messageInput.value = '';
            
            await loadMessages(user.uid);
            setupMessageListener(user.uid);
            
            listenToUserStatus(username, (status) => {
                if (status && status.state === 'online') {
                    elements.chatStatus.textContent = 'на связи';
                    elements.chatStatus.style.color = '#4CAF50';
                } else {
                    elements.chatStatus.textContent = 'без связи';
                    elements.chatStatus.style.color = 'rgba(255,255,255,0.5)';
                }
            });
            
            scrollToBottom();
            
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
            if (currentChatWith) {
                stopListeningToUserStatus(currentChatWith);
            }
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
        statusListeners.forEach((value, username) => {
            stopListeningToUserStatus(username);
        });
    }

    function setupRealtimeSubscriptions() {
        cleanupSubscriptions();

        if (!currentUser) return;

        usersUnsubscribe = db.collection('users').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified' || change.type === 'added') {
                    const userData = change.doc.data();
                    onlineUsers.set(change.doc.id, {
                        username: userData.username
                    });
                } else if (change.type === 'removed') {
                    onlineUsers.delete(change.doc.id);
                }
            });
            
            displayChats();
        });

        chatsUnsubscribe = db.collection('messages')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('created_at', 'desc')
            .onSnapshot(() => {
                loadChats();
            });
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
            
            const unreadCount = unreadCounts[chat.userId] || 0;
            const timeString = formatMessageTime(chat.lastTime);
            const messagePrefix = chat.isMyMessage ? 'Вы: ' : '';
            const displayMessage = chat.lastMessage.length > 30 ? chat.lastMessage.substring(0, 30) + '...' : chat.lastMessage;
            
            div.innerHTML = `
                <div class="chat-avatar" id="avatar-${chat.username}">${escapeHtml(chat.username.charAt(0).toUpperCase())}</div>
                <div class="chat-info">
                    <div class="chat-name">
                        ${escapeHtml(chat.username)}
                        <span class="chat-status-text" id="status-${chat.username}">загрузка...</span>
                    </div>
                    <div class="chat-last-message">${escapeHtml(messagePrefix + displayMessage)}</div>
                    <div class="chat-time">${timeString}</div>
                </div>
                ${unreadCount ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            `;
            
            elements.chatsList.appendChild(div);
            
            listenToUserStatus(chat.username, (status) => {
                const statusSpan = document.getElementById(`status-${chat.username}`);
                const avatarDiv = document.getElementById(`avatar-${chat.username}`);
                if (statusSpan && avatarDiv) {
                    if (status && status.state === 'online') {
                        statusSpan.textContent = 'на связи';
                        statusSpan.style.color = '#4CAF50';
                        avatarDiv.classList.add('online');
                    } else {
                        statusSpan.textContent = 'без связи';
                        statusSpan.style.color = 'rgba(255,255,255,0.5)';
                        avatarDiv.classList.remove('online');
                    }
                }
            });
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

    async function markMessagesAsRead(userId) {
        if (!userId || !currentUser || !isChatActive) return;
        
        try {
            const snapshot = await db.collection('messages')
                .where('receiver', '==', currentUser.uid)
                .where('sender', '==', userId)
                .where('read', '==', false)
                .get();

            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.update(doc.ref, { read: true });
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

        if (!/^[A-Za-z0-9_]+$/.test(username)) {
            showError(elements.loginError, 'Только буквы, цифры и _');
            return;
        }

        showLoading(true);
        try {
            const existingUser = await findUserByUsername(username);
            
            if (existingUser) {
                currentUser = {
                    uid: existingUser.uid,
                    username: existingUser.username
                };
            } else {
                const uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                await db.collection('users').doc(uid).set({
                    uid: uid,
                    username: username,
                    created_at: new Date().toISOString()
                });

                currentUser = { uid, username };
            }

            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            await setupUserStatus();

            showChats();
            updateUI();
            setupRealtimeSubscriptions();
            loadChats();
            
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
        
        if (!/^[A-Za-z0-9_]+$/.test(newUsername)) {
            showError(elements.editUsernameError, 'Только буквы, цифры и _');
            return;
        }
        
        if (newUsername === currentUser.username) {
            hideModal('editProfileModal');
            return;
        }

        showLoading(true);
        try {
            const existingUser = await findUserByUsername(newUsername);

            if (existingUser) {
                showError(elements.editUsernameError, 'Имя пользователя уже занято');
                return;
            }

            await db.collection('users').doc(currentUser.uid).update({
                username: newUsername
            });

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUI();
            hideModal('editProfileModal');
            
            if (currentChatWith) {
                currentChatWith = newUsername;
                elements.chatWithUser.textContent = newUsername;
            }
            
            loadChats();
            elements.chatsTitle.textContent = `Чаты (${currentUser.username})`;
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
                
                userElement.innerHTML = `
                    <div class="user-result-info">
                        <div class="user-result-avatar" id="search-avatar-${user.username}">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
                        <div>
                            <div class="user-result-name">${escapeHtml(user.username)}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 12px;" id="search-status-${user.username}">загрузка...</div>
                        </div>
                    </div>
                `;
                
                elements.searchResults.appendChild(userElement);
                
                listenToUserStatus(user.username, (status) => {
                    const statusDiv = document.getElementById(`search-status-${user.username}`);
                    const avatarDiv = document.getElementById(`search-avatar-${user.username}`);
                    if (statusDiv && avatarDiv) {
                        if (status && status.state === 'online') {
                            statusDiv.textContent = 'на связи';
                            avatarDiv.classList.add('online');
                        } else {
                            statusDiv.textContent = 'без связи';
                            avatarDiv.classList.remove('online');
                        }
                    }
                });
            });
        } catch (e) {
            elements.searchResults.innerHTML = '<div style="color: #ff7d7d; text-align: center;">Ошибка при поиске</div>';
        }
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
            
            contactElement.innerHTML = `
                <div class="contact-info">
                    <div class="contact-avatar" id="contact-avatar-${contact.username}">${escapeHtml(contact.username.charAt(0).toUpperCase())}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;" id="contact-status-${contact.username}">загрузка...</div>
                    </div>
                </div>
            `;
            
            elements.contactsList.appendChild(contactElement);
            
            listenToUserStatus(contact.username, (status) => {
                const statusDiv = document.getElementById(`contact-status-${contact.username}`);
                const avatarDiv = document.getElementById(`contact-avatar-${contact.username}`);
                if (statusDiv && avatarDiv) {
                    if (status && status.state === 'online') {
                        statusDiv.textContent = 'на связи';
                        avatarDiv.classList.add('online');
                    } else {
                        statusDiv.textContent = 'без связи';
                        avatarDiv.classList.remove('online');
                    }
                }
            });
        });
        
        showModal('contactsModal');
    }

    async function logout() {
        showLoading(true);
        
        try {
            if (currentUser) {
                const statusRef = rtdb.ref('/status/' + currentUser.username);
                await statusRef.set({
                    state: 'offline',
                    last_changed: firebase.database.ServerValue.TIMESTAMP
                });
            }
        } catch (e) {}
        
        localStorage.removeItem('speednexus_user');
        cleanupSubscriptions();
        currentUser = null;
        currentChatWith = null;
        currentChatUserId = null;
        isChatActive = false;
        onlineUsers.clear();
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
})();
