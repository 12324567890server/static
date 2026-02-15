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
    let lastHeartbeat = Date.now();
    const HEARTBEAT_INTERVAL = 5000; // 5 секунд
    const STALE_CONNECTION_TIMEOUT = 10000; // 10 секунд - убиваем все, что старше

    init();

    function init() {
        checkUser();
        setupEventListeners();
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('online', handleNetworkOnline);
        window.addEventListener('offline', handleNetworkOffline);
        
        // Запускаем убийцу мертвых подключений каждые 3 секунды
        setInterval(killAllStaleConnections, 3000);

        if (isMobile) {
            document.addEventListener('touchstart', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    elements.messageInput.blur();
                }
            });
        }
    }

    // Агрессивная очистка всех мертвых подключений
    async function killAllStaleConnections() {
        if (!currentUser) return;
        
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            const connectionsSnapshot = await userRef.collection('connections').get();
            const now = Date.now();
            let killed = false;
            
            // Проходим по ВСЕМ подключениям
            connectionsSnapshot.forEach(doc => {
                const conn = doc.data();
                const lastSeen = new Date(conn.last_seen || conn.created_at || conn.last_heartbeat || 0).getTime();
                
                // Если подключение не обновлялось больше 10 секунд - это МЕРТВОЕ подключение
                if (now - lastSeen > STALE_CONNECTION_TIMEOUT) {
                    // Удаляем нафиг
                    doc.ref.delete();
                    killed = true;
                    console.log('💀 Убито мертвое подключение:', doc.id, 'возраст:', Math.round((now - lastSeen)/1000) + 'сек');
                }
            });
            
            if (killed) {
                // Пересчитываем реальный статус
                const remainingSnapshot = await userRef.collection('connections').get();
                const isAnyOnline = remainingSnapshot.docs.some(doc => doc.data().is_online === true);
                
                // Принудительно обновляем статус пользователя
                await userRef.set({
                    uid: currentUser.uid,
                    username: currentUser.username,
                    is_online: isAnyOnline,
                    last_seen: new Date().toISOString()
                }, { merge: true });
                
                console.log('✅ Статус обновлен. Онлайн:', isAnyOnline);
            }
        } catch (e) {}
    }

    function handleVisibilityChange() {
        isPageVisible = !document.hidden;
        if (isPageVisible) {
            updateOnlineStatus(true);
            if (currentChatWith && isChatActive) {
                setTimeout(() => markMessagesAsRead(currentChatUserId), 1000);
            }
        } else {
            updateOnlineStatus(false);
        }
    }

    function handleBeforeUnload() {
        if (currentUser && connectionId) {
            forceRemoveConnection();
        }
    }

    function handleNetworkOnline() {
        if (currentUser) {
            updateOnlineStatus(true);
        }
    }

    function handleNetworkOffline() {
        if (currentUser) {
            updateOnlineStatus(false);
        }
    }

    async function updateOnlineStatus(isOnline) {
        if (!currentUser || !connectionId) return;
        
        try {
            lastHeartbeat = Date.now();
            
            const userRef = db.collection('users').doc(currentUser.uid);
            const connectionsRef = userRef.collection('connections').doc(connectionId);
            
            await connectionsRef.set({
                connection_id: connectionId,
                is_online: isOnline,
                last_seen: new Date().toISOString(),
                last_heartbeat: new Date().toISOString(),
                user_agent: navigator.userAgent,
                device: isMobile ? 'mobile' : 'desktop'
            }, { merge: true });
            
            await updateOverallUserStatus();
        } catch (e) {}
    }

    async function updateOverallUserStatus() {
        if (!currentUser) return;
        
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            const connectionsSnapshot = await userRef.collection('connections').get();
            
            let isAnyOnline = false;
            let latestSeen = null;
            
            connectionsSnapshot.forEach(doc => {
                const conn = doc.data();
                if (conn.is_online === true) {
                    isAnyOnline = true;
                }
                const lastSeen = new Date(conn.last_seen || conn.created_at);
                if (!latestSeen || lastSeen > latestSeen) {
                    latestSeen = lastSeen;
                }
            });
            
            await userRef.set({
                uid: currentUser.uid,
                username: currentUser.username,
                is_online: isAnyOnline,
                last_seen: latestSeen ? latestSeen.toISOString() : new Date().toISOString()
            }, { merge: true });
        } catch (e) {}
    }

    async function forceRemoveConnection() {
        if (!currentUser || !connectionId) return;
        
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            await userRef.collection('connections').doc(connectionId).delete();
            
            // Сразу пересчитываем статус
            const connectionsSnapshot = await userRef.collection('connections').get();
            const isAnyOnline = connectionsSnapshot.docs.some(doc => doc.data().is_online === true);
            
            await userRef.set({
                uid: currentUser.uid,
                username: currentUser.username,
                is_online: isAnyOnline,
                last_seen: new Date().toISOString()
            }, { merge: true });
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
        
        const userRef = db.collection('users').doc(currentUser.uid);
        const connectionsRef = userRef.collection('connections').doc(connectionId);
        
        await connectionsRef.set({
            connection_id: connectionId,
            created_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            user_agent: navigator.userAgent,
            device: isMobile ? 'mobile' : 'desktop',
            is_online: true
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
        
        if (currentChatWith && scrollPositions[currentChatWith]) {
            setTimeout(() => {
                elements.privateMessages.scrollTop = scrollPositions[currentChatWith];
            }, 100);
        }
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
            
            if (scrollPositions[username]) {
                elements.privateMessages.scrollTop = scrollPositions[username];
            } else {
                scrollToBottom();
            }
            
            setTimeout(() => elements.messageInput.focus(), 300);
            
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
                                if (isMyMessage) {
                                    scrollToBottom();
                                } else {
                                    const shouldScroll = isUserNearBottom();
                                    if (shouldScroll) {
                                        scrollToBottom();
                                    }
                                }
                                
                                if (!isMyMessage && !msg.read) {
                                    markMessagesAsRead(userId);
                                }
                            }
                        }
                    } else if (change.type === 'modified') {
                        const msg = change.doc.data();
                        const msgId = change.doc.id;
                        const msgElement = document.querySelector(`[data-message-id="${msgId}"]`);
                        
                        if (msgElement && msg.read) {
                            const timeDiv = msgElement.querySelector('.time');
                            if (timeDiv && !timeDiv.textContent.includes('✓✓')) {
                                timeDiv.textContent = timeDiv.textContent.replace('✓', '✓✓');
                            }
                        }
                    }
                });
            });
    }

    function isUserNearBottom() {
        const container = elements.privateMessages;
        if (!container) return true;
        const threshold = 100;
        const position = container.scrollTop + container.clientHeight;
        const height = container.scrollHeight;
        return position > height - threshold;
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
                scrollPositions[currentChatWith] = elements.privateMessages.scrollTop;
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

        elements.messageInput.addEventListener('focus', () => {
            setTimeout(() => scrollToBottom(), 300);
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

        elements.privateMessages.addEventListener('scroll', () => {
            if (currentChatWith) {
                scrollPositions[currentChatWith] = elements.privateMessages.scrollTop;
            }
        });
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
            let needsUpdate = false;
            
            snapshot.docChanges().forEach(change => {
                const userData = change.doc.data();
                
                if (change.type === 'modified' || change.type === 'added') {
                    const oldStatus = onlineUsers.get(change.doc.id)?.is_online;
                    const newStatus = userData.is_online === true;
                    
                    if (oldStatus !== newStatus) {
                        needsUpdate = true;
                    }
                    
                    onlineUsers.set(change.doc.id, {
                        username: userData.username,
                        is_online: newStatus,
                        last_seen: userData.last_seen
                    });
                } else if (change.type === 'removed') {
                    onlineUsers.delete(change.doc.id);
                    needsUpdate = true;
                }
            });
            
            if (needsUpdate) {
                if (currentChatWith) {
                    updateChatStatus();
                }
                displayChats();
                updateSearchResultsWithStatus();
                updateContactsWithStatus();
            }
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
            if (currentUser && connectionId) {
                if (isPageVisible && navigator.onLine) {
                    updateOnlineStatus(true);
                }
            }
        }, HEARTBEAT_INTERVAL);
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
            elements.chatStatus.textContent = 'был(а) ' + formatLastSeen(user?.last_seen);
            elements.chatStatus.style.color = 'rgba(255,255,255,0.5)';
        }
    }

    function formatLastSeen(timestamp) {
        if (!timestamp) return 'давно';
        
        try {
            const lastSeen = new Date(timestamp);
            const now = new Date();
            const diffMs = now - lastSeen;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'только что';
            if (diffMins < 60) return `${diffMins} мин назад`;
            if (diffHours < 24) return `${diffHours} ч назад`;
            if (diffDays === 1) return 'вчера';
            if (diffDays < 7) return `${diffDays} дн назад`;
            
            return lastSeen.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        } catch (e) {
            return 'давно';
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
            
            setTimeout(() => scrollToBottom(), 100);
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
        
        const senderInfo = onlineUsers.get(msg.sender);
        const senderName = !isMyMessage ? senderInfo?.username || msg.sender : '';
        const statusSymbol = isMyMessage ? (msg.read ? '✓✓' : '✓') : '';
        
        messageElement.innerHTML = `
            <div class="message-content">
                ${senderName ? `<div class="sender-name">${escapeHtml(senderName)}</div>` : ''}
                <div class="text">${escapeHtml(msg.message)}</div>
                <div class="time">${timeString} ${statusSymbol}</div>
            </div>
        `;
        
        elements.privateMessages.appendChild(messageElement);
    }

    function scrollToBottom() {
        if (elements.privateMessages) {
            elements.privateMessages.scrollTo({
                top: elements.privateMessages.scrollHeight,
                behavior: 'smooth'
            });
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
            
            if (isMobile) {
                setTimeout(() => {
                    elements.messageInput.focus();
                }, 100);
            }
        } catch (e) {}
    }

    async function markMessagesAsRead(userId) {
        if (!userId || !currentUser || !isChatActive || !isPageVisible) return;
        
        const now = Date.now();
        if (lastReadTime[userId] && now - lastReadTime[userId] < 2000) return;
        lastReadTime[userId] = now;
        
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
                    is_online: false,
                    last_seen: new Date().toISOString()
                });

                currentUser = { uid, username };
            }

            connectionId = 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            await createConnection();
            
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            await updateOnlineStatus(true);

            showChats();
            updateUI();
            setupRealtimeSubscriptions();
            loadChats();
            startHeartbeat();
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

            const oldUsername = currentUser.username;
            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUI();
            hideModal('editProfileModal');
            
            if (currentChatWith === oldUsername) {
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

    function logout() {
        showLoading(true);
        
        forceRemoveConnection().finally(() => {
            localStorage.removeItem('speednexus_user');
            stopHeartbeat();
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
        });
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
