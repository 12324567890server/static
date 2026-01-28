(function() {
    const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuY3lzZ25xc2dwZHB1dXB6Z3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDQ3ODUsImV4cCI6MjA4MjMyMDc4NX0.5MRgyFqLvk6NiBBvY2u-_BOhsBkjYCfkis5BM1QIBoc";
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
        chatsTitle: document.getElementById('chatsTitle'),
        userAvatar: document.getElementById('userAvatar'),
        userStatusText: document.getElementById('userStatusText')
    };

    let currentUser = null;
    let currentChatWith = null;
    let chats = [];
    let unreadMessages = new Map();
    let onlineUsers = new Map();
    let lastSeenTimes = new Map();
    let userStatusSubscription = null;
    let messagesSubscription = null;
    let isOnline = true;
    let onlineCheckInterval = null;
    let typingTimeout = null;
    let lastOnlineUpdate = 0;

    function init() {
        checkUser();
        setupEventListeners();
        setupNetworkListeners();
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);
    }

    function setupNetworkListeners() {
        window.addEventListener('online', () => {
            isOnline = true;
            console.log('Сеть восстановлена');
            if (currentUser) {
                updateUserOnline();
                setupSubscriptions();
                updateAllStatuses();
            }
        });

        window.addEventListener('offline', () => {
            isOnline = false;
            console.log('Нет сети');
            updateUserOfflineStatus();
        });
    }

    function handleBeforeUnload() {
        if (currentUser) {
            updateUserOffline();
        }
    }

    async function updateUserOnline() {
        if (!currentUser || !isOnline) return;
        
        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('users')
                .upsert({
                    username: currentUser.username,
                    is_online: true,
                    last_seen: now,
                    online_at: now
                }, {
                    onConflict: 'username'
                });

            if (error) throw error;
            
            elements.userStatusText.textContent = 'в сети';
            elements.userStatusText.style.color = '#b19cd9';
            lastOnlineUpdate = Date.now();
            
        } catch (error) {
            console.error('Ошибка обновления онлайн статуса:', error);
        }
    }

    async function updateUserOffline() {
        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('users')
                .update({
                    is_online: false,
                    last_seen: now
                })
                .eq('username', currentUser.username);

            if (error) throw error;
        } catch (error) {
            console.error('Ошибка установки оффлайн:', error);
        }
    }

    function updateUserOfflineStatus() {
        elements.userStatusText.textContent = 'без сети';
        elements.userStatusText.style.color = '#ff6b6b';
        updateAllStatuses();
    }

    function setupSubscriptions() {
        setupUserStatusSubscription();
        setupMessagesSubscription();
        startOnlineCheck();
    }

    function setupUserStatusSubscription() {
        if (userStatusSubscription) {
            supabase.removeChannel(userStatusSubscription);
        }

        userStatusSubscription = supabase
            .channel('online_users')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'users'
                }, 
                (payload) => {
                    handleUserStatusUpdate(payload);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Подписался на статусы пользователей');
                }
            });
    }

    function handleUserStatusUpdate(payload) {
        const user = payload.new;
        if (!user || user.username === currentUser.username) return;

        const username = user.username;
        const isUserOnline = user.is_online;
        const lastSeen = user.last_seen;
        
        onlineUsers.set(username, isUserOnline);
        lastSeenTimes.set(username, lastSeen);
        
        updateChatStatus();
        updateChatsList();
        
        if (currentChatWith === username) {
            showStatusNotification(username, isUserOnline);
        }
    }

    function showStatusNotification(username, isOnline) {
        if (document.hidden) return;
        
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.textContent = `${username} ${isOnline ? 'в сети' : 'без связи'}`;
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${isOnline ? '#4CAF50' : '#ff6b6b'};
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function setupMessagesSubscription() {
        if (messagesSubscription) {
            supabase.removeChannel(messagesSubscription);
        }

        messagesSubscription = supabase
            .channel('private_messages')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'private_messages',
                    filter: `receiver=eq.${currentUser.username}`
                }, 
                (payload) => {
                    handleNewMessage(payload.new);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Подписался на сообщения');
                }
            });
    }

    function startOnlineCheck() {
        if (onlineCheckInterval) clearInterval(onlineCheckInterval);
        
        onlineCheckInterval = setInterval(async () => {
            if (!currentUser || !isOnline) return;
            
            const now = Date.now();
            if (now - lastOnlineUpdate > 30000) {
                await updateUserOnline();
            }
            
            await checkOnlineStatuses();
        }, 10000);
    }

    async function checkOnlineStatuses() {
        try {
            const usernamesToCheck = new Set();
            
            if (currentChatWith) {
                usernamesToCheck.add(currentChatWith);
            }
            
            chats.forEach(chat => {
                usernamesToCheck.add(chat.username);
            });
            
            const usernamesArray = Array.from(usernamesToCheck);
            
            if (usernamesArray.length === 0) return;
            
            const { data: users, error } = await supabase
                .from('users')
                .select('username, is_online, last_seen')
                .in('username', usernamesArray);

            if (error) throw error;

            if (users) {
                users.forEach(user => {
                    onlineUsers.set(user.username, user.is_online);
                    lastSeenTimes.set(user.username, user.last_seen);
                });
                
                updateAllStatuses();
            }
        } catch (error) {
            console.error('Ошибка проверки онлайн:', error);
        }
    }

    function updateAllStatuses() {
        updateChatStatus();
        updateChatsList();
        updateSearchResults();
        updateContactsList();
    }

    function handleNewMessage(message) {
        if (message.receiver !== currentUser.username) return;
        
        if (currentChatWith === message.sender) {
            addMessageToDisplay(message, false);
            markChatAsRead(message.sender);
        } else {
            const count = unreadMessages.get(message.sender) || 0;
            unreadMessages.set(message.sender, count + 1);
            updateUnreadNotifications();
            loadChats();
            
            if (Notification.permission === 'granted' && document.hidden) {
                showDesktopNotification(message);
            }
        }
    }

    function showDesktopNotification(message) {
        const notification = new Notification('Новое сообщение', {
            body: `${message.sender}: ${message.message.substring(0, 50)}...`,
            icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
            tag: 'message'
        });

        notification.onclick = function() {
            window.focus();
            showChat(message.sender);
            notification.close();
        };
    }

    function checkUser() {
        const savedUser = localStorage.getItem('speednexus_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                showChats();
                updateUserDisplay();
                setupSubscriptions();
                loadChats();
                checkOnlineStatuses();
                
                if (Notification.permission === 'default') {
                    Notification.requestPermission();
                }
            } catch (e) {
                localStorage.removeItem('speednexus_user');
                showLogin();
            }
        } else {
            showLogin();
        }
    }

    function showLogin() {
        cleanupSubscriptions();
        
        elements.loginScreen.style.display = 'flex';
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        elements.loginUsername.focus();
    }

    function cleanupSubscriptions() {
        if (userStatusSubscription) {
            supabase.removeChannel(userStatusSubscription);
            userStatusSubscription = null;
        }
        if (messagesSubscription) {
            supabase.removeChannel(messagesSubscription);
            messagesSubscription = null;
        }
        if (onlineCheckInterval) {
            clearInterval(onlineCheckInterval);
            onlineCheckInterval = null;
        }
    }

    function showChats() {
        elements.loginScreen.style.display = 'none';
        elements.chatsScreen.style.display = 'flex';
        elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        elements.chatsTitle.textContent = 'Чаты (' + currentUser.username + ')';
        loadChats();
        checkOnlineStatuses();
    }

    async function showChat(username) {
        currentChatWith = username;
        elements.chatWithUser.textContent = username;
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'flex';
        closeAllModals();
        hideSideMenu();
        
        elements.privateMessages.innerHTML = '';
        
        await loadMessages(username);
        updateChatStatus();
        elements.messageInput.focus();
        
        await markChatAsRead(username);
        
        unreadMessages.delete(username);
        updateUnreadNotifications();
    }

    function updateUserDisplay() {
        if (currentUser) {
            elements.currentUsernameDisplay.textContent = currentUser.username;
            elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
            elements.userStatusText.textContent = 'в сети';
            elements.userStatusText.style.color = '#b19cd9';
        }
    }

    function updateChatStatus() {
        if (!currentChatWith || !elements.chatStatus) return;
        
        const isUserOnline = onlineUsers.get(currentChatWith);
        if (isUserOnline === true) {
            elements.chatStatus.textContent = 'на связи';
            elements.chatStatus.style.color = '#b19cd9';
        } else if (isUserOnline === false) {
            elements.chatStatus.textContent = 'без связи';
            elements.chatStatus.style.color = 'rgba(255, 255, 255, 0.7)';
        } else {
            elements.chatStatus.textContent = 'без связи';
            elements.chatStatus.style.color = 'rgba(255, 255, 255, 0.7)';
        }
    }

    function setupEventListeners() {
        elements.loginButton.onclick = handleLogin;
        elements.loginUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });

        elements.chatsMenuBtn.onclick = function() {
            elements.sideMenu.style.display = 'block';
            setTimeout(() => {
                elements.sideMenu.classList.add('show');
            }, 10);
        };

        elements.closeMenu.onclick = hideSideMenu;

        document.addEventListener('click', function(event) {
            if (!elements.sideMenu.contains(event.target) && 
                !elements.chatsMenuBtn.contains(event.target) &&
                elements.sideMenu.classList.contains('show')) {
                hideSideMenu();
            }
        });

        elements.newChatBtn.onclick = function() {
            elements.newChatUsername.value = '';
            showModal('newChatModal');
        };

        elements.backToChats.onclick = function() {
            showChats();
        };

        elements.editProfileBtn.onclick = () => showModal('editProfileModal');
        elements.saveProfileBtn.onclick = handleEditProfile;

        elements.findFriendsBtn.onclick = () => showModal('findFriendsModal');
        elements.searchBtn.onclick = handleSearch;
        elements.searchUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        let searchTimeout;
        elements.searchUsername.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            
            if (searchTerm.length === 0) {
                elements.searchResults.innerHTML = '';
                return;
            }
            
            if (searchTerm.length < 2) return;
            
            searchTimeout = setTimeout(() => {
                handleSearch();
            }, 300);
        });

        elements.contactsBtn.onclick = () => {
            showModal('contactsModal');
            loadContacts();
        };

        elements.logoutBtn.onclick = handleLogout;

        elements.sendMessageBtn.onclick = handleSendMessage;
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        elements.startChatBtn.onclick = handleStartNewChat;

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = (e) => {
                const modalId = e.target.closest('.close-modal').dataset.modal;
                hideModal(modalId);
            };
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.onclick = (e) => {
                if (e.target === modal) hideModal(modal.id);
            };
        });

        if (elements.searchChats) {
            let chatSearchTimeout;
            elements.searchChats.addEventListener('input', function() {
                clearTimeout(chatSearchTimeout);
                const searchTerm = this.value;
                chatSearchTimeout = setTimeout(() => {
                    filterChats(searchTerm);
                }, 200);
            });
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && currentChatWith) {
                markChatAsRead(currentChatWith);
            }
        });
    }

    function hideSideMenu() {
        elements.sideMenu.classList.remove('show');
        setTimeout(() => {
            elements.sideMenu.style.display = 'none';
        }, 300);
    }

    async function loadChats() {
        if (!currentUser) return;
        
        try {
            const { data: messages, error } = await supabase
                .from('private_messages')
                .select('*')
                .or(`sender.eq.${currentUser.username},receiver.eq.${currentUser.username}`)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            const chatMap = new Map();
            unreadMessages.clear();
            
            if (messages) {
                for (const msg of messages) {
                    const otherUser = msg.sender === currentUser.username ? msg.receiver : msg.sender;
                    
                    if (!chatMap.has(otherUser)) {
                        chatMap.set(otherUser, {
                            username: otherUser,
                            lastMessage: msg.message,
                            lastTime: msg.created_at,
                            isMyMessage: msg.sender === currentUser.username
                        });
                    }
                    
                    if (msg.receiver === currentUser.username && !msg.read) {
                        const count = unreadMessages.get(otherUser) || 0;
                        unreadMessages.set(otherUser, count + 1);
                    }
                }
            }

            chats = Array.from(chatMap.values());
            displayChats(chats);
            
            updateUnreadNotifications();
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
            showMessage('Ошибка загрузки чатов');
        }
    }

    function displayChats(chatList) {
        elements.chatsList.innerHTML = '';
        
        if (chatList.length === 0) {
            elements.chatsList.innerHTML = '<div class="empty-state">Нет чатов. Начните новый чат!</div>';
            return;
        }

        chatList.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

        chatList.forEach(chat => {
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.onclick = () => showChat(chat.username);
            
            const date = new Date(chat.lastTime);
            const time = formatTime(date);
            const unreadCount = unreadMessages.get(chat.username) || 0;
            const isUserOnline = onlineUsers.get(chat.username);
            const lastSeen = lastSeenTimes.get(chat.username);
            
            let lastMessagePrefix = chat.isMyMessage ? 'Вы: ' : '';
            let lastMessage = chat.lastMessage || '';
            if (lastMessage.length > 25) {
                lastMessage = lastMessage.substring(0, 25) + '...';
            }
            
            div.innerHTML = `
                <div class="chat-avatar ${isUserOnline ? 'online' : ''}">${getAvatarLetter(chat.username)}</div>
                <div class="chat-info">
                    <div class="chat-name">
                        ${escapeHtml(chat.username)}
                        <span class="chat-status-text ${isUserOnline ? 'online' : ''}">
                            ${isUserOnline === true ? 'на связи' : 'без связи'}
                        </span>
                    </div>
                    <div class="chat-last-message">
                        ${lastMessagePrefix}${escapeHtml(lastMessage)}
                    </div>
                    <div class="chat-time">${time}</div>
                </div>
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            `;
            
            elements.chatsList.appendChild(div);
        });
    }

    async function loadMessages(username) {
        if (!username) return;
        
        try {
            const usernames = [currentUser.username, username].sort();
            const chatId = usernames.join('_');
            
            const { data: messages, error } = await supabase
                .from('private_messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true })
                .limit(200);
            
            if (error) throw error;
            
            displayMessages(messages || []);
            
            if (messages && messages.length > 0) {
                const unreadIds = messages
                    .filter(msg => msg.receiver === currentUser.username && !msg.read)
                    .map(msg => msg.id);
                
                if (unreadIds.length > 0) {
                    await supabase
                        .from('private_messages')
                        .update({ read: true })
                        .in('id', unreadIds);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            showMessage('Ошибка загрузки сообщений');
        }
    }

    function addMessageToDisplay(message, isMyMessage) {
        const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
        if (existingMessage) return;
        
        const div = document.createElement('div');
        div.className = `message ${isMyMessage ? 'me' : 'other'}`;
        div.dataset.messageId = message.id;
        
        const date = new Date(message.created_at);
        const time = date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
        const status = isMyMessage ? getMessageStatus(message) : '';
        
        div.innerHTML = `
            <div class="message-content">
                <div class="text">${escapeHtml(message.message)}</div>
                <div class="time">
                    ${time}
                    ${status}
                </div>
            </div>
        `;
        
        elements.privateMessages.appendChild(div);
        scrollToBottom();
    }

    function displayMessages(messages) {
        elements.privateMessages.innerHTML = '';
        
        messages.forEach(msg => {
            const div = document.createElement('div');
            const isMyMessage = msg.sender === currentUser.username;
            div.className = `message ${isMyMessage ? 'me' : 'other'}`;
            div.dataset.messageId = msg.id;
            
            const date = new Date(msg.created_at);
            const time = date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
            const status = isMyMessage ? getMessageStatus(msg) : '';
            
            div.innerHTML = `
                <div class="message-content">
                    <div class="text">${escapeHtml(msg.message)}</div>
                    <div class="time">
                        ${time}
                        ${status}
                    </div>
                </div>
            `;
            
            elements.privateMessages.appendChild(div);
        });
        
        scrollToBottom();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function scrollToBottom() {
        setTimeout(() => {
            elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
        }, 100);
    }

    function getMessageStatus(msg) {
        if (msg.read) {
            return '<span class="message-status read">✓✓</span>';
        } else {
            return '<span class="message-status delivered">✓</span>';
        }
    }

    async function handleSendMessage() {
        if (!currentChatWith || !currentUser) return;
        
        const message = elements.messageInput.value.trim();
        if (!message) return;
        
        try {
            const usernames = [currentUser.username, currentChatWith].sort();
            const chatId = usernames.join('_');
            
            const { data, error } = await supabase
                .from('private_messages')
                .insert({
                    chat_id: chatId,
                    sender: currentUser.username,
                    receiver: currentChatWith,
                    message: message,
                    read: false
                })
                .select();
            
            if (error) throw error;
            
            elements.messageInput.value = '';
            
            if (data && data[0]) {
                addMessageToDisplay(data[0], true);
                loadChats();
            }
            
        } catch (error) {
            console.error('Ошибка отправки:', error);
            showMessage('Ошибка отправки сообщения');
        }
    }

    async function markChatAsRead(username) {
        if (!username) return;
        
        try {
            await supabase
                .from('private_messages')
                .update({ read: true })
                .eq('receiver', currentUser.username)
                .eq('sender', username)
                .eq('read', false);
            
            unreadMessages.delete(username);
            updateUnreadNotifications();
        } catch (error) {
            console.error('Ошибка пометки чата как прочитанного:', error);
        }
    }

    function updateUnreadNotifications() {
        let totalUnread = 0;
        for (const count of unreadMessages.values()) {
            totalUnread += count;
        }
        
        if (totalUnread > 0) {
            document.title = `(${totalUnread}) SpeedNexus`;
        } else {
            document.title = 'SpeedNexus';
        }
    }

    async function handleStartNewChat() {
        const username = elements.newChatUsername.value.trim();
        
        if (!username) {
            showError(elements.newChatError, 'Введите имя пользователя');
            return;
        }
        
        if (username === currentUser.username) {
            showError(elements.newChatError, 'Нельзя начать чат с самим собой');
            return;
        }

        try {
            const { data: existingUser, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .maybeSingle();

            if (error) throw error;

            if (!existingUser) {
                showError(elements.newChatError, 'Пользователь не найден');
                return;
            }

            hideModal('newChatModal');
            showChat(username);
            
        } catch (error) {
            console.error('Ошибка:', error);
            showError(elements.newChatError, 'Ошибка поиска пользователя');
        }
    }

    async function handleLogin() {
        const username = elements.loginUsername.value.trim();
        
        if (!username) {
            showError(elements.loginError, 'Введите имя пользователя');
            return;
        }
        
        if (username.length < 3) {
            showError(elements.loginError, 'Имя должно быть не менее 3 символов');
            return;
        }

        try {
            currentUser = {
                username: username,
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            await supabase
                .from('users')
                .upsert({
                    username: username,
                    is_online: true,
                    last_seen: new Date().toISOString(),
                    online_at: new Date().toISOString()
                }, {
                    onConflict: 'username'
                });

            showChats();
            updateUserDisplay();
            setupSubscriptions();
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            showError(elements.loginError, 'Ошибка входа');
        }
    }

    async function handleEditProfile() {
        const newUsername = elements.editUsername.value.trim();
        
        if (!newUsername) {
            showError(elements.editUsernameError, 'Введите новое имя');
            return;
        }
        
        if (newUsername === currentUser.username) {
            hideModal('editProfileModal');
            return;
        }

        try {
            const { data: existingUser, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', newUsername)
                .maybeSingle();

            if (error) throw error;

            if (existingUser) {
                showError(elements.editUsernameError, 'Этот никнейм уже используется');
                return;
            }

            await updateUserOffline();
            
            await supabase
                .from('users')
                .upsert({
                    username: newUsername,
                    is_online: true,
                    last_seen: new Date().toISOString(),
                    online_at: new Date().toISOString()
                }, {
                    onConflict: 'username'
                });

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUserDisplay();
            hideModal('editProfileModal');
            elements.chatsTitle.textContent = 'Чаты (' + newUsername + ')';
            
            loadChats();
            if (currentChatWith) {
                showChat(currentChatWith);
            }
        } catch (error) {
            console.error('Ошибка изменения имени:', error);
            showError(elements.editUsernameError, 'Ошибка изменения имени');
        }
    }

    async function handleSearch() {
        const searchTerm = elements.searchUsername.value.trim();
        
        if (!searchTerm || searchTerm.length < 2) {
            showSearchResults([]);
            return;
        }

        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('username, is_online, last_seen')
                .ilike('username', `%${searchTerm}%`)
                .neq('username', currentUser.username)
                .limit(10);

            if (error) throw error;

            showSearchResults(users || []);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }

    function showSearchResults(users) {
        elements.searchResults.innerHTML = '';
        
        if (users.length === 0) {
            elements.searchResults.innerHTML = '<p class="no-results">Пользователи не найдены</p>';
            return;
        }

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-result';
            div.onclick = () => {
                hideModal('findFriendsModal');
                showChat(user.username);
            };
            
            div.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar ${user.is_online ? 'online' : ''}">${getAvatarLetter(user.username)}</div>
                    <div>
                        <div class="user-result-name">${escapeHtml(user.username)}</div>
                        <div class="user-result-status">
                            ${user.is_online ? 'на связи' : 'без связи'}
                        </div>
                    </div>
                </div>
            `;
            
            elements.searchResults.appendChild(div);
        });
    }

    function updateSearchResults() {
        const userResults = elements.searchResults.querySelectorAll('.user-result');
        userResults.forEach(result => {
            const usernameElement = result.querySelector('.user-result-name');
            if (usernameElement) {
                const username = usernameElement.textContent;
                const isUserOnline = onlineUsers.get(username);
                const avatar = result.querySelector('.user-result-avatar');
                const status = result.querySelector('.user-result-status');
                
                if (avatar) {
                    avatar.className = `user-result-avatar ${isUserOnline ? 'online' : ''}`;
                }
                if (status) {
                    status.textContent = isUserOnline ? 'на связи' : 'без связи';
                }
            }
        });
    }

    function getContacts() {
        const contacts = localStorage.getItem('speednexus_contacts');
        return contacts ? JSON.parse(contacts) : [];
    }

    function saveContacts(contacts) {
        localStorage.setItem('speednexus_contacts', JSON.stringify(contacts));
    }

    function addToContacts(username) {
        const contacts = getContacts();
        if (!contacts.some(c => c.username === username)) {
            contacts.push({
                username: username,
                addedAt: new Date().toISOString()
            });
            saveContacts(contacts);
        }
    }

    function loadContacts() {
        const contacts = getContacts();
        elements.contactsList.innerHTML = '';
        
        if (contacts.length === 0) {
            elements.contactsList.innerHTML = '<p class="no-contacts">Контакты не найдены</p>';
            return;
        }

        contacts.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            div.onclick = () => {
                hideModal('contactsModal');
                showChat(contact.username);
            };
            
            const isUserOnline = onlineUsers.get(contact.username);
            
            div.innerHTML = `
                <div class="contact-info">
                    <div class="contact-avatar ${isUserOnline ? 'online' : ''}">${getAvatarLetter(contact.username)}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div class="contact-status">
                            ${isUserOnline ? 'на связи' : 'без связи'}
                        </div>
                    </div>
                </div>
            `;
            
            elements.contactsList.appendChild(div);
        });
    }

    function updateContactsList() {
        const contactItems = elements.contactsList.querySelectorAll('.contact-item');
        contactItems.forEach(item => {
            const usernameElement = item.querySelector('.contact-name');
            if (usernameElement) {
                const username = usernameElement.textContent;
                const isUserOnline = onlineUsers.get(username);
                const avatar = item.querySelector('.contact-avatar');
                const status = item.querySelector('.contact-status');
                
                if (avatar) {
                    avatar.className = `contact-avatar ${isUserOnline ? 'online' : ''}`;
                }
                if (status) {
                    status.textContent = isUserOnline ? 'на связи' : 'без связи';
                }
            }
        });
    }

    async function handleLogout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            await updateUserOffline();
            localStorage.removeItem('speednexus_user');
            
            cleanupSubscriptions();
            
            currentUser = null;
            showLogin();
            elements.loginUsername.value = '';
        }
    }

    function showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
        document.body.style.overflow = 'hidden';
        hideSideMenu();
    }

    function hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = '';
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = '';
    }

    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => element.style.display = 'none', 3000);
    }

    function showMessage(message) {
        const div = document.createElement('div');
        div.className = 'error-message';
        div.textContent = message;
        div.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 125, 125, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(div);
        
        setTimeout(() => {
            div.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    function getAvatarLetter(username) {
        return username.charAt(0).toUpperCase();
    }

    function formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'только что';
        }
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} мин`;
        }
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} ч`;
        }
        
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }

    function filterChats(searchTerm) {
        if (!searchTerm) {
            displayChats(chats);
            return;
        }
        
        const filtered = chats.filter(chat => 
            chat.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        displayChats(filtered);
    }

    function updateChatsList() {
        const chatItems = elements.chatsList.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const usernameElement = item.querySelector('.chat-name');
            if (usernameElement) {
                const text = usernameElement.textContent;
                const username = text.replace(/на связи|без связи/g, '').trim();
                const isUserOnline = onlineUsers.get(username);
                
                const avatar = item.querySelector('.chat-avatar');
                if (avatar) {
                    avatar.className = `chat-avatar ${isUserOnline ? 'online' : ''}`;
                }
                
                const statusText = item.querySelector('.chat-status-text');
                if (statusText) {
                    statusText.textContent = isUserOnline ? 'на связи' : 'без связи';
                    statusText.className = `chat-status-text ${isUserOnline ? 'online' : ''}`;
                }
            }
        });
    }

    init();
})();
