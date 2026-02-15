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
    let chats = [];
    let unreadCounts = {};
    let onlineUsers = {};
    let messagesUnsubscribe = null;
    let chatsUnsubscribe = null;
    let usersUnsubscribe = null;
    let heartbeatInterval = null;

    init();

    function init() {
        checkUser();
        setupEventListeners();
    }

    async function checkUser() {
        showLoading(true);
        try {
            const saved = localStorage.getItem('speednexus_user');
            if (saved) {
                currentUser = JSON.parse(saved);
                const userDoc = await db.collection('users').doc(currentUser.username).get();
                
                if (userDoc.exists) {
                    await setOnline(true);
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
            currentChatWith = username;
            elements.chatWithUser.textContent = username;
            elements.chatsScreen.style.display = 'none';
            elements.chatScreen.style.display = 'flex';
            elements.privateMessages.innerHTML = '';
            elements.messageInput.value = '';
            
            await loadMessages(username);
            await markMessagesAsRead(username);
            updateChatStatus();
            scrollToBottom();
            elements.messageInput.focus();
            
            setupRealtimeSubscriptions();
        } catch (e) {
        } finally {
            showLoading(false);
        }
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
            currentChatWith = null;
            showChats();
            setupRealtimeSubscriptions();
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
    }

    function setupRealtimeSubscriptions() {
        cleanupSubscriptions();

        if (!currentUser) return;

        if (currentChatWith) {
            messagesUnsubscribe = db.collection('messages')
                .where('chat_id', '==', [currentUser.username, currentChatWith].sort().join('_'))
                .orderBy('created_at')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const msg = change.doc.data();
                            const msgId = change.doc.id;
                            
                            if (!document.querySelector(`[data-message-id="${msgId}"]`)) {
                                displayMessage(msg, msg.sender === currentUser.username, msgId);
                                scrollToBottom();
                                
                                if (msg.sender === currentChatWith) {
                                    markMessagesAsRead(currentChatWith);
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

        chatsUnsubscribe = db.collection('messages')
            .where('participants', 'array-contains', currentUser.username)
            .orderBy('created_at', 'desc')
            .onSnapshot(() => {
                loadChats();
            });

        usersUnsubscribe = db.collection('users')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified' || change.type === 'added') {
                        const user = change.doc.data();
                        if (user.username !== currentUser?.username) {
                            const wasOnline = onlineUsers[user.username];
                            onlineUsers[user.username] = user.is_online;
                            
                            if (currentChatWith === user.username) {
                                updateChatStatus();
                                if (user.is_online && !wasOnline && currentChatWith) {
                                    markMessagesAsRead(currentChatWith);
                                }
                            }
                            updateChatsList();
                            updateSearchResults();
                        }
                    } else if (change.type === 'removed') {
                        const user = change.doc.data();
                        if (user.username !== currentUser?.username) {
                            delete onlineUsers[user.username];
                            if (currentChatWith === user.username) {
                                updateChatStatus();
                            }
                            updateChatsList();
                            updateSearchResults();
                        }
                    }
                });
            });
    }

    function startHeartbeat() {
        stopHeartbeat();
        setOnline(true);
        heartbeatInterval = setInterval(() => setOnline(true), 25000);
    }

    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    async function setOnline(status) {
        if (!currentUser) return;
        try {
            await db.collection('users').doc(currentUser.username).set({
                username: currentUser.username,
                is_online: status,
                last_seen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {}
    }

    function updateChatStatus() {
        if (!currentChatWith || !elements.chatStatus) return;
        const isOnline = onlineUsers[currentChatWith] === true;
        elements.chatStatus.textContent = isOnline ? 'на связи' : 'без связи';
    }

    async function loadChats() {
        if (!currentUser) return;
        
        try {
            const snapshot = await db.collection('messages')
                .where('participants', 'array-contains', currentUser.username)
                .orderBy('created_at', 'desc')
                .get();

            const chatsMap = new Map();
            const newUnreadCounts = {};

            snapshot.forEach(doc => {
                const msg = doc.data();
                const otherUser = msg.sender === currentUser.username ? msg.receiver : msg.sender;
                
                if (!chatsMap.has(otherUser) || new Date(msg.created_at) > new Date(chatsMap.get(otherUser).lastTime)) {
                    chatsMap.set(otherUser, {
                        username: otherUser,
                        lastMessage: msg.message,
                        lastTime: msg.created_at,
                        isMyMessage: msg.sender === currentUser.username
                    });
                }
                
                if (msg.receiver === currentUser.username && !msg.read) {
                    newUnreadCounts[otherUser] = (newUnreadCounts[otherUser] || 0) + 1;
                }
            });

            chats = Array.from(chatsMap.values());
            unreadCounts = newUnreadCounts;
            displayChats();
            updateTitle();
            loadOnlineStatuses();
        } catch (e) {
            console.error("Load chats error:", e);
        }
    }

    function displayChats(chatsToDisplay = chats) {
        if (!elements.chatsList) return;
        elements.chatsList.innerHTML = '';
        
        if (chatsToDisplay.length === 0) {
            elements.chatsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px;">Нет чатов</div>';
            return;
        }

        const sortedChats = [...chatsToDisplay].sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

        sortedChats.forEach(chat => {
            const chatElement = createChatElement(chat);
            elements.chatsList.appendChild(chatElement);
        });
    }

    function createChatElement(chat) {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => showChat(chat.username);
        
        const isOnline = onlineUsers[chat.username] === true;
        const unreadCount = unreadCounts[chat.username] || 0;
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
        
        return div;
    }

    function updateChatsList() {
        const chatItems = elements.chatsList.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const nameElement = item.querySelector('.chat-name');
            if (!nameElement) return;
            
            const username = nameElement.childNodes[0]?.textContent?.trim() || '';
            if (!username) return;
            
            const isOnline = onlineUsers[username] === true;
            const avatarElement = item.querySelector('.chat-avatar');
            const statusElement = item.querySelector('.chat-status-text');
            
            if (avatarElement) {
                avatarElement.className = `chat-avatar ${isOnline ? 'online' : ''}`;
            }
            if (statusElement) {
                statusElement.textContent = isOnline ? 'на связи' : 'без связи';
                statusElement.className = `chat-status-text ${isOnline ? 'online' : ''}`;
            }
        });
    }

    function updateSearchResults() {
        const resultItems = elements.searchResults.querySelectorAll('.user-result');
        resultItems.forEach(item => {
            const nameElement = item.querySelector('.user-result-name');
            if (!nameElement) return;
            
            const username = nameElement.textContent;
            const isOnline = onlineUsers[username] === true;
            const avatarElement = item.querySelector('.user-result-avatar');
            
            if (avatarElement) {
                avatarElement.className = `user-result-avatar ${isOnline ? 'online' : ''}`;
            }
        });
    }

    async function loadMessages(username) {
        if (!username || !currentUser) return;
        
        try {
            const snapshot = await db.collection('messages')
                .where('chat_id', '==', [currentUser.username, username].sort().join('_'))
                .orderBy('created_at')
                .get();

            elements.privateMessages.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                displayMessage(msg, msg.sender === currentUser.username, doc.id);
            });
        } catch (e) {
            console.error("Load messages error:", e);
        }
    }

    function displayMessage(msg, isMyMessage, msgId) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isMyMessage ? 'me' : 'other'}`;
        messageElement.dataset.messageId = msgId;
        
        const messageTime = msg.created_at?.toDate ? msg.created_at.toDate() : new Date(msg.created_at);
        const timeString = messageTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
        setTimeout(() => {
            if (elements.privateMessages) {
                elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
            }
        }, 100);
    }

    async function sendMessage() {
        if (!currentChatWith || !currentUser || !elements.messageInput.value.trim()) return;
        
        const messageText = elements.messageInput.value.trim();
        elements.messageInput.value = '';
        
        const chatId = [currentUser.username, currentChatWith].sort().join('_');
        
        try {
            await db.collection('messages').add({
                chat_id: chatId,
                participants: [currentUser.username, currentChatWith],
                sender: currentUser.username,
                receiver: currentChatWith,
                message: messageText,
                read: false,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (onlineUsers[currentChatWith]) {
                setTimeout(() => markMessagesAsRead(currentChatWith), 1000);
            }
        } catch (e) {
            console.error("Send message error:", e);
        }
    }

    async function markMessagesAsRead(username) {
        if (!username || !currentUser) return;
        
        try {
            const snapshot = await db.collection('messages')
                .where('receiver', '==', currentUser.username)
                .where('sender', '==', username)
                .where('read', '==', false)
                .get();

            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.update(doc.ref, { read: true });
                });
                await batch.commit();
                
                delete unreadCounts[username];
                updateTitle();
                loadChats();
                
                const messageElements = document.querySelectorAll(`.message.other[data-message-id]`);
                messageElements.forEach(el => {
                    const timeDiv = el.querySelector('.time');
                    if (timeDiv && !timeDiv.textContent.includes('✓✓')) {
                        timeDiv.textContent = timeDiv.textContent.replace('✓', '✓✓');
                    }
                });
            }
        } catch (e) {
            console.error("Mark as read error:", e);
        }
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
            const userDoc = await db.collection('users').doc(username).get();

            if (!userDoc.exists) {
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
            await db.collection('users').doc(username).set({
                username: username,
                is_online: true,
                last_seen: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentUser = { username };
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));

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
            const userDoc = await db.collection('users').doc(newUsername).get();

            if (userDoc.exists) {
                showError(elements.editUsernameError, 'Имя пользователя уже занято');
                return;
            }

            await db.collection('users').doc(currentUser.username).delete();
            
            await db.collection('users').doc(newUsername).set({
                username: newUsername,
                is_online: true,
                last_seen: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUI();
            hideModal('editProfileModal');
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
                
                const isOnline = user.is_online === true;
                
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
            
            const isOnline = onlineUsers[contact.username] === true;
            
            contactElement.innerHTML = `
                <div class="contact-info">
                    <div class="contact-avatar ${isOnline ? 'online' : ''}">${escapeHtml(contact.username.charAt(0).toUpperCase())}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                    </div>
                </div>
            `;
            
            elements.contactsList.appendChild(contactElement);
        });
    }

    async function loadOnlineStatuses() {
        const usernames = chats.map(chat => chat.username);
        if (currentChatWith && !usernames.includes(currentChatWith)) {
            usernames.push(currentChatWith);
        }
        
        if (usernames.length === 0) return;

        for (const username of usernames) {
            try {
                const userDoc = await db.collection('users').doc(username).get();
                if (userDoc.exists) {
                    const user = userDoc.data();
                    onlineUsers[user.username] = user.is_online;
                }
            } catch (e) {}
        }
        
        updateChatStatus();
        updateChatsList();
    }

    function filterChats(searchTerm) {
        if (!searchTerm) {
            displayChats(chats);
            return;
        }
        
        const filteredChats = chats.filter(chat => 
            chat.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        displayChats(filteredChats);
    }

    function logout() {
        showLoading(true);
        setOnline(false).finally(() => {
            localStorage.removeItem('speednexus_user');
            stopHeartbeat();
            cleanupSubscriptions();
            currentUser = null;
            currentChatWith = null;
            onlineUsers = {};
            showLogin();
            showLoading(false);
        });
    }

    function formatMessageTime(timestamp) {
        if (!timestamp) return '';
        
        const messageDate = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
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
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    window.addEventListener('beforeunload', () => {
        if (currentUser) {
            setOnline(false);
        }
    });
})();
