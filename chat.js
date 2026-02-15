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
    let chats = [];
    let unreadCounts = {};
    let onlineUsers = {};
    let messagesUnsubscribe = null;
    let messageListener = null;
    let currentConnectionId = null;

    init();

    function init() {
        checkUser();
        setupEventListeners();
        setInterval(cleanupStaleConnections, 10000);
    }

    async function cleanupStaleConnections() {
        try {
            const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
            const snapshot = await db.collection('connections')
                .where('last_seen', '<', tenSecondsAgo)
                .where('online', '==', true)
                .get();
            
            snapshot.forEach(doc => {
                doc.ref.update({ online: false });
            });
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
                    
                    await goOnline();
                    showChats();
                    updateUI();
                    loadChats();
                    listenUsers();
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

    async function goOnline() {
        if (!currentUser) return;
        
        currentConnectionId = 'conn_' + Date.now();
        
        await db.collection('connections').doc(currentConnectionId).set({
            userId: currentUser.uid,
            username: currentUser.username,
            online: true,
            last_seen: new Date().toISOString(),
            device: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        });
        
        await db.collection('users').doc(currentUser.uid).update({
            online: true,
            last_seen: new Date().toISOString()
        });
        
        startHeartbeat();
    }

    async function goOffline() {
        if (!currentUser || !currentConnectionId) return;
        
        try {
            await db.collection('connections').doc(currentConnectionId).update({
                online: false,
                last_seen: new Date().toISOString()
            });
            
            const snapshot = await db.collection('connections')
                .where('userId', '==', currentUser.uid)
                .where('online', '==', true)
                .get();
            
            if (snapshot.empty) {
                await db.collection('users').doc(currentUser.uid).update({
                    online: false,
                    last_seen: new Date().toISOString()
                });
            }
        } catch (e) {}
    }

    function startHeartbeat() {
        setInterval(async () => {
            if (currentUser && currentConnectionId) {
                try {
                    await db.collection('connections').doc(currentConnectionId).update({
                        last_seen: new Date().toISOString(),
                        online: true
                    });
                    
                    await db.collection('users').doc(currentUser.uid).update({
                        online: true,
                        last_seen: new Date().toISOString()
                    });
                } catch (e) {}
            }
        }, 5000);
    }

    window.addEventListener('beforeunload', function() {
        if (currentConnectionId) {
            db.collection('connections').doc(currentConnectionId).update({
                online: false
            });
        }
    });

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (currentConnectionId) {
                db.collection('connections').doc(currentConnectionId).update({
                    online: false
                });
            }
        } else {
            if (currentConnectionId) {
                db.collection('connections').doc(currentConnectionId).update({
                    online: true,
                    last_seen: new Date().toISOString()
                });
            }
        }
    });

    function listenUsers() {
        db.collection('users').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' || change.type === 'modified') {
                    const user = change.doc.data();
                    onlineUsers[change.doc.id] = {
                        username: user.username,
                        online: user.online || false
                    };
                }
            });
            displayChats();
            if (currentChatUserId) {
                updateChatStatus();
            }
        });
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
            updateChatStatus();
            scrollToBottom();
            listenMessages(user.uid);
            
        } catch (e) {} finally {
            showLoading(false);
        }
    }

    function listenMessages(userId) {
        if (messageListener) messageListener();
        
        messageListener = db.collection('messages')
            .where('chat_id', '==', [currentUser.uid, userId].sort().join('_'))
            .orderBy('created_at')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const msg = change.doc.data();
                        const isMyMessage = msg.sender === currentUser.uid;
                        displayMessage(msg, isMyMessage);
                        scrollToBottom();
                        
                        if (!isMyMessage && !msg.read) {
                            markAsRead(userId, change.doc.id);
                        }
                    }
                });
            });
    }

    async function markAsRead(userId, msgId) {
        await db.collection('messages').doc(msgId).update({ read: true });
    }

    function updateUI() {
        if (currentUser) {
            elements.currentUsernameDisplay.textContent = currentUser.username;
            elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
        }
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
        elements.newChatBtn.addEventListener('click', () => {
            elements.newChatUsername.value = '';
            elements.newChatError.style.display = 'none';
            document.getElementById('newChatModal').style.display = 'flex';
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
            document.getElementById('editProfileModal').style.display = 'flex';
        });
        elements.saveProfileBtn.addEventListener('click', editProfile);
        elements.findFriendsBtn.addEventListener('click', () => {
            elements.searchUsername.value = '';
            elements.searchResults.innerHTML = '';
            document.getElementById('findFriendsModal').style.display = 'flex';
            setTimeout(() => searchUsers(), 100);
        });
        elements.searchBtn.addEventListener('click', searchUsers);
        elements.contactsBtn.addEventListener('click', loadContacts);
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
                if (modal) modal.style.display = 'none';
            });
        });
        
        elements.searchChats.addEventListener('input', () => displayChats());
    }

    function showLoading(show) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    function updateChatStatus() {
        if (!currentChatUserId || !elements.chatStatus) return;
        const user = onlineUsers[currentChatUserId];
        
        if (user?.online) {
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
            return { uid: doc.id, username: doc.data().username };
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

            for (const doc of snapshot.docs) {
                const msg = doc.data();
                const otherUserId = msg.sender === currentUser.uid ? msg.receiver : msg.sender;
                
                let otherUsername = onlineUsers[otherUserId]?.username;
                if (!otherUsername) {
                    const userDoc = await db.collection('users').doc(otherUserId).get();
                    otherUsername = userDoc.exists ? userDoc.data().username : otherUserId;
                }
                
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
            }

            chats = Array.from(chatsMap.values());
            unreadCounts = newUnreadCounts;
            displayChats();
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
            
            const isOnline = onlineUsers[chat.userId]?.online || false;
            const unreadCount = unreadCounts[chat.userId] || 0;
            const timeString = formatTime(chat.lastTime);
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
                displayMessage(msg, isMyMessage);
            });
            
            scrollToBottom();
        } catch (e) {}
    }

    function displayMessage(msg, isMyMessage) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isMyMessage ? 'me' : 'other'}`;
        
        let timeString = '';
        if (msg.created_at) {
            const d = new Date(msg.created_at);
            timeString = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
        elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
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

    async function startNewChat() {
        const username = elements.newChatUsername.value.trim();
        if (!username) {
            elements.newChatError.textContent = 'Введите имя пользователя';
            elements.newChatError.style.display = 'block';
            return;
        }
        
        if (username === currentUser.username) {
            elements.newChatError.textContent = 'Нельзя начать чат с самим собой';
            elements.newChatError.style.display = 'block';
            return;
        }

        showLoading(true);
        try {
            const user = await findUserByUsername(username);
            if (!user) {
                elements.newChatError.textContent = 'Пользователь не найден';
                elements.newChatError.style.display = 'block';
                return;
            }

            document.getElementById('newChatModal').style.display = 'none';
            await showChat(username);
        } catch (e) {
            elements.newChatError.textContent = 'Ошибка при поиске';
            elements.newChatError.style.display = 'block';
        } finally {
            showLoading(false);
        }
    }

    async function login() {
        const username = elements.loginUsername.value.trim();
        if (!username || username.length < 3) {
            elements.loginError.textContent = 'Минимум 3 символа';
            elements.loginError.style.display = 'block';
            return;
        }

        if (!/^[A-Za-z0-9_]+$/.test(username)) {
            elements.loginError.textContent = 'Только буквы, цифры и _';
            elements.loginError.style.display = 'block';
            return;
        }

        showLoading(true);
        try {
            const existingUser = await findUserByUsername(username);
            
            if (existingUser) {
                currentUser = existingUser;
            } else {
                const uid = 'user_' + Date.now();
                await db.collection('users').doc(uid).set({
                    uid: uid,
                    username: username,
                    online: false,
                    created_at: new Date().toISOString()
                });
                currentUser = { uid, username };
            }

            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            await goOnline();
            showChats();
            updateUI();
            loadChats();
            listenUsers();
            
        } catch (e) {
            elements.loginError.textContent = 'Ошибка при входе';
            elements.loginError.style.display = 'block';
        } finally {
            showLoading(false);
        }
    }

    async function editProfile() {
        const newUsername = elements.editUsername.value.trim();
        if (!newUsername || newUsername.length < 3) {
            elements.editUsernameError.textContent = 'Минимум 3 символа';
            elements.editUsernameError.style.display = 'block';
            return;
        }
        
        if (!/^[A-Za-z0-9_]+$/.test(newUsername)) {
            elements.editUsernameError.textContent = 'Только буквы, цифры и _';
            elements.editUsernameError.style.display = 'block';
            return;
        }

        showLoading(true);
        try {
            const existingUser = await findUserByUsername(newUsername);
            if (existingUser) {
                elements.editUsernameError.textContent = 'Имя уже занято';
                elements.editUsernameError.style.display = 'block';
                return;
            }

            await db.collection('users').doc(currentUser.uid).update({
                username: newUsername
            });

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUI();
            document.getElementById('editProfileModal').style.display = 'none';
            elements.chatsTitle.textContent = `Чаты (${currentUser.username})`;
            
        } catch (e) {
            elements.editUsernameError.textContent = 'Ошибка';
            elements.editUsernameError.style.display = 'block';
        } finally {
            showLoading(false);
        }
    }

    async function searchUsers() {
        const searchTerm = elements.searchUsername.value.trim().toLowerCase();
        
        try {
            const snapshot = await db.collection('users').get();
            const users = [];
            
            snapshot.forEach(doc => {
                const user = doc.data();
                if (!searchTerm || user.username.toLowerCase().includes(searchTerm)) {
                    if (user.username !== currentUser?.username) {
                        users.push(user);
                    }
                }
            });

            elements.searchResults.innerHTML = '';
            
            if (users.length === 0) {
                elements.searchResults.innerHTML = '<div style="color: rgba(255,255,255,0.5); padding: 20px;">Ничего не найдено</div>';
                return;
            }

            users.forEach(user => {
                const div = document.createElement('div');
                div.className = 'user-result';
                div.onclick = () => {
                    document.getElementById('findFriendsModal').style.display = 'none';
                    showChat(user.username);
                };
                
                const isOnline = onlineUsers[user.uid]?.online || false;
                
                div.innerHTML = `
                    <div class="user-result-info">
                        <div class="user-result-avatar ${isOnline ? 'online' : ''}">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
                        <div>
                            <div class="user-result-name">${escapeHtml(user.username)}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                        </div>
                    </div>
                `;
                
                elements.searchResults.appendChild(div);
            });
        } catch (e) {}
    }

    function loadContacts() {
        const contacts = JSON.parse(localStorage.getItem('speednexus_contacts') || '[]');
        elements.contactsList.innerHTML = '';
        
        if (contacts.length === 0) {
            elements.contactsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); padding: 20px;">Нет контактов</div>';
            document.getElementById('contactsModal').style.display = 'flex';
            return;
        }

        contacts.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            div.onclick = () => {
                document.getElementById('contactsModal').style.display = 'none';
                showChat(contact.username);
            };
            
            findUserByUsername(contact.username).then(user => {
                const isOnline = user ? onlineUsers[user.uid]?.online || false : false;
                
                div.innerHTML = `
                    <div class="contact-info">
                        <div class="contact-avatar ${isOnline ? 'online' : ''}">${escapeHtml(contact.username.charAt(0).toUpperCase())}</div>
                        <div>
                            <div class="contact-name">${escapeHtml(contact.username)}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                        </div>
                    </div>
                `;
            });
            
            elements.contactsList.appendChild(div);
        });
        
        document.getElementById('contactsModal').style.display = 'flex';
    }

    async function logout() {
        showLoading(true);
        await goOffline();
        localStorage.removeItem('speednexus_user');
        currentUser = null;
        currentChatWith = null;
        currentChatUserId = null;
        onlineUsers = {};
        showLogin();
        showLoading(false);
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - d) / 60000);
        
        if (diff < 1) return 'сейчас';
        if (diff < 60) return diff + ' мин';
        if (diff < 1440) return Math.floor(diff / 60) + ' ч';
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
})();
