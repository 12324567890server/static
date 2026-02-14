(function() {
    const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuY3lzZ25xc2dwZHB1dXB6Z3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDQ3ODUsImV4cCI6MjA4MjMyMDc4NX0.5MRgyFqLvk6NiBBvY2u-_BOhsBkjYCfkis5BM1QIBoc";
    
    if (!window.supabase) {
        console.error('Supabase не загружен!');
        return;
    }
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const elements = {};
    
    function initElements() {
        const ids = [
            'loginScreen', 'chatsScreen', 'chatScreen', 'chatsList', 'searchChats',
            'chatsMenuBtn', 'newChatBtn', 'backToChats', 'chatWithUser', 'chatStatus',
            'privateMessages', 'messageInput', 'sendMessageBtn', 'loginUsername',
            'loginButton', 'loginError', 'sideMenu', 'closeMenu', 'currentUsernameDisplay',
            'editProfileBtn', 'findFriendsBtn', 'contactsBtn', 'logoutBtn',
            'editProfileModal', 'editUsername', 'saveProfileBtn', 'editUsernameError',
            'findFriendsModal', 'searchUsername', 'searchBtn', 'searchResults',
            'contactsModal', 'contactsList', 'newChatModal', 'newChatUsername',
            'startChatBtn', 'newChatError', 'chatsTitle', 'userAvatar',
            'userStatusDisplay', 'loadingOverlay'
        ];
        
        ids.forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }

    let currentUser = null;
    let currentChatWith = null;
    let chats = [];
    let unreadMessages = new Map();
    let onlineUsers = new Map();
    let userStatusChannel = null;
    let messagesChannel = null;
    let heartbeatInterval = null;
    let isSending = false;
    let messageCache = new Map();
    let searchTimeout = null;

    function init() {
        initElements();
        checkUser();
        setupEventListeners();
        setupKeyboardListeners();
    }

    function checkUser() {
        const savedUser = localStorage.getItem('speednexus_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                validateUserInDB();
            } catch (e) {
                handleLogout();
            }
        } else {
            showLogin();
        }
    }

    async function validateUserInDB() {
        try {
            showLoading();
            const { data, error } = await supabase
                .from('users')
                .select('username')
                .eq('username', currentUser.username)
                .single();
            
            if (error || !data) {
                handleLogout();
            } else {
                showChats();
                updateUserDisplay();
                setupRealtime();
                loadChats();
                checkOnlineStatuses();
            }
        } catch (error) {
            console.error('Ошибка валидации:', error);
            showLogin();
        } finally {
            hideLoading();
        }
    }

    function showLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'flex';
        }
    }

    function hideLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }

    function showLogin() {
        cleanupRealtime();
        if (elements.loginScreen) elements.loginScreen.style.display = 'flex';
        if (elements.chatsScreen) elements.chatsScreen.style.display = 'none';
        if (elements.chatScreen) elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        if (elements.loginUsername) elements.loginUsername.focus();
    }

    function showChats() {
        if (elements.loginScreen) elements.loginScreen.style.display = 'none';
        if (elements.chatsScreen) elements.chatsScreen.style.display = 'flex';
        if (elements.chatScreen) elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        if (elements.chatsTitle && currentUser) {
            elements.chatsTitle.textContent = 'Чаты (' + currentUser.username + ')';
        }
    }

    async function showChat(username) {
        if (!username) return;
        
        currentChatWith = username;
        if (elements.chatWithUser) elements.chatWithUser.textContent = username;
        if (elements.chatsScreen) elements.chatsScreen.style.display = 'none';
        if (elements.chatScreen) elements.chatScreen.style.display = 'flex';
        closeAllModals();
        hideSideMenu();
        
        if (elements.privateMessages) elements.privateMessages.innerHTML = '';
        
        await loadMessages(username);
        updateChatStatus();
        if (elements.messageInput) {
            elements.messageInput.focus();
            elements.messageInput.disabled = false;
        }
        
        await markChatAsRead(username);
    }

    function updateUserDisplay() {
        if (currentUser) {
            if (elements.currentUsernameDisplay) {
                elements.currentUsernameDisplay.textContent = currentUser.username;
            }
            if (elements.userAvatar) {
                elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
            }
        }
    }

    function setupEventListeners() {
        if (elements.loginButton) {
            elements.loginButton.onclick = handleLogin;
        }
        
        if (elements.loginUsername) {
            elements.loginUsername.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin();
            });
        }

        if (elements.chatsMenuBtn) {
            elements.chatsMenuBtn.onclick = toggleSideMenu;
        }

        if (elements.closeMenu) {
            elements.closeMenu.onclick = hideSideMenu;
        }

        document.addEventListener('click', function(event) {
            if (elements.sideMenu && 
                !elements.sideMenu.contains(event.target) && 
                elements.chatsMenuBtn && 
                !elements.chatsMenuBtn.contains(event.target) &&
                elements.sideMenu.classList.contains('show')) {
                hideSideMenu();
            }
        });

        if (elements.newChatBtn) {
            elements.newChatBtn.onclick = function() {
                if (elements.newChatUsername) elements.newChatUsername.value = '';
                showModal('newChatModal');
            };
        }

        if (elements.backToChats) {
            elements.backToChats.onclick = function() {
                showChats();
            };
        }

        if (elements.editProfileBtn) {
            elements.editProfileBtn.onclick = () => {
                if (elements.editUsername) {
                    elements.editUsername.value = currentUser ? currentUser.username : '';
                }
                showModal('editProfileModal');
            };
        }
        
        if (elements.saveProfileBtn) {
            elements.saveProfileBtn.onclick = handleEditProfile;
        }

        if (elements.findFriendsBtn) {
            elements.findFriendsBtn.onclick = () => showModal('findFriendsModal');
        }
        
        if (elements.searchBtn) {
            elements.searchBtn.onclick = handleSearch;
        }
        
        if (elements.searchUsername) {
            elements.searchUsername.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSearch();
            });

            elements.searchUsername.addEventListener('input', (e) => {
                if (searchTimeout) clearTimeout(searchTimeout);
                const value = e.target.value.trim();
                if (value.length > 0) {
                    searchTimeout = setTimeout(handleSearch, 300);
                } else if (elements.searchResults) {
                    elements.searchResults.innerHTML = '';
                }
            });
        }

        if (elements.contactsBtn) {
            elements.contactsBtn.onclick = () => {
                showModal('contactsModal');
                loadContacts();
            };
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.onclick = () => {
                if (confirm('Вы уверены, что хотите выйти?')) {
                    handleLogout();
                }
            };
        }

        if (elements.sendMessageBtn) {
            elements.sendMessageBtn.onclick = handleSendMessage;
        }
        
        if (elements.messageInput) {
            elements.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            });
        }

        if (elements.startChatBtn) {
            elements.startChatBtn.onclick = handleStartNewChat;
        }

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = (e) => {
                const modal = e.target.closest('.modal');
                if (modal) hideModal(modal.id);
            };
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.onclick = (e) => {
                if (e.target === modal) hideModal(modal.id);
            };
        });

        if (elements.searchChats) {
            elements.searchChats.addEventListener('input', function() {
                filterChats(this.value);
            });
        }

        window.addEventListener('online', () => {
            if (currentUser) updateUserOnline();
        });

        window.addEventListener('offline', () => {
            if (elements.chatStatus) {
                elements.chatStatus.textContent = 'нет соединения';
            }
        });
    }

    function setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllModals();
                hideSideMenu();
            }
        });
    }

    function toggleSideMenu() {
        if (!elements.sideMenu) return;
        
        if (elements.sideMenu.classList.contains('show')) {
            hideSideMenu();
        } else {
            elements.sideMenu.style.display = 'block';
            setTimeout(() => {
                elements.sideMenu.classList.add('show');
            }, 10);
        }
    }

    function hideSideMenu() {
        if (!elements.sideMenu) return;
        
        elements.sideMenu.classList.remove('show');
        setTimeout(() => {
            elements.sideMenu.style.display = 'none';
        }, 300);
    }

    function setupRealtime() {
        cleanupRealtime();
        
        try {
            userStatusChannel = supabase
                .channel('user_status')
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'users'
                    }, 
                    (payload) => {
                        if (payload.new && payload.new.username !== currentUser.username) {
                            onlineUsers.set(payload.new.username, payload.new.is_online);
                            updateAllStatuses();
                        }
                    }
                )
                .subscribe();

            messagesChannel = supabase
                .channel('private_messages')
                .on('postgres_changes', 
                    { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'private_messages'
                    }, 
                    (payload) => {
                        const message = payload.new;
                        if (message.receiver === currentUser.username || 
                            message.sender === currentUser.username) {
                            handleNewMessage(message);
                        }
                    }
                )
                .subscribe();

            startHeartbeat();
        } catch (error) {
            console.error('Ошибка realtime:', error);
        }
    }

    function cleanupRealtime() {
        if (userStatusChannel) {
            supabase.removeChannel(userStatusChannel);
            userStatusChannel = null;
        }
        if (messagesChannel) {
            supabase.removeChannel(messagesChannel);
            messagesChannel = null;
        }
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        
        heartbeatInterval = setInterval(async () => {
            if (currentUser && navigator.onLine) {
                await updateUserOnline();
                await checkOnlineStatuses();
            }
        }, 30000);
    }

    async function updateUserOnline() {
        try {
            const now = new Date().toISOString();
            await supabase
                .from('users')
                .upsert({
                    username: currentUser.username,
                    is_online: true,
                    last_seen: now
                }, {
                    onConflict: 'username'
                });
        } catch (error) {
            console.error('Ошибка обновления онлайн:', error);
        }
    }

    async function setUserOffline() {
        try {
            if (!currentUser) return;
            
            const payload = {
                username: currentUser.username,
                is_online: false,
                last_seen: new Date().toISOString()
            };
            
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(`${SUPABASE_URL}/rest/v1/users?username=eq.${currentUser.username}`, blob);
            } else {
                await supabase
                    .from('users')
                    .update({
                        is_online: false,
                        last_seen: new Date().toISOString()
                    })
                    .eq('username', currentUser.username);
            }
        } catch (error) {
            console.error('Ошибка установки оффлайн:', error);
        }
    }

    async function checkOnlineStatuses() {
        if (!currentUser) return;
        
        try {
            const usernamesToCheck = new Set();
            
            if (currentChatWith) {
                usernamesToCheck.add(currentChatWith);
            }
            
            chats.forEach(chat => {
                usernamesToCheck.add(chat.username);
            });
            
            const contacts = getContacts();
            contacts.forEach(contact => {
                usernamesToCheck.add(contact.username);
            });
            
            const usernamesArray = Array.from(usernamesToCheck);
            
            if (usernamesArray.length === 0) return;
            
            const { data: users } = await supabase
                .from('users')
                .select('username, is_online')
                .in('username', usernamesArray);

            if (users) {
                users.forEach(user => {
                    onlineUsers.set(user.username, user.is_online);
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
        if (!message) return;
        
        if (currentChatWith === message.sender) {
            if (!document.querySelector(`[data-message-id="${message.id}"]`)) {
                addMessageToDisplay(message, false);
                markChatAsRead(message.sender);
            }
        } else if (message.receiver === currentUser.username) {
            const count = unreadMessages.get(message.sender) || 0;
            unreadMessages.set(message.sender, count + 1);
            updateUnreadNotifications();
            loadChats();
            
            if (document.hidden && Notification.permission === 'granted') {
                new Notification('Новое сообщение', {
                    body: `${message.sender}: ${message.message.substring(0, 50)}`,
                    icon: '/favicon.ico'
                });
            }
        }
    }

    function updateChatStatus() {
        if (!currentChatWith || !elements.chatStatus) return;
        
        if (!navigator.onLine) {
            elements.chatStatus.textContent = 'нет соединения';
            elements.chatStatus.style.color = '#ff7d7d';
            return;
        }
        
        const isOnline = onlineUsers.get(currentChatWith);
        if (isOnline === true) {
            elements.chatStatus.textContent = 'на связи';
            elements.chatStatus.style.color = '#b19cd9';
        } else {
            elements.chatStatus.textContent = 'без связи';
            elements.chatStatus.style.color = 'rgba(255, 255, 255, 0.7)';
        }
    }

    async function loadChats() {
        if (!currentUser) return;
        
        try {
            showLoading();
            
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
            if (elements.chatsList) {
                elements.chatsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px;">Ошибка загрузки чатов</div>';
            }
        } finally {
            hideLoading();
        }
    }

    function displayChats(chatList) {
        if (!elements.chatsList) return;
        
        elements.chatsList.innerHTML = '';
        
        if (chatList.length === 0) {
            elements.chatsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px;">Нет чатов. Начните новый чат!</div>';
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
            const isOnline = onlineUsers.get(chat.username) === true;
            
            let lastMessagePrefix = chat.isMyMessage ? 'Вы: ' : '';
            let lastMessage = chat.lastMessage || '';
            if (lastMessage.length > 25) {
                lastMessage = lastMessage.substring(0, 25) + '...';
            }
            
            div.innerHTML = `
                <div class="chat-avatar ${isOnline ? 'online' : ''}">${escapeHtml(getAvatarLetter(chat.username))}</div>
                <div class="chat-info">
                    <div class="chat-name">
                        ${escapeHtml(chat.username)}
                        <span class="chat-status-text ${isOnline ? 'online' : ''}">
                            ${isOnline ? 'на связи' : 'без связи'}
                        </span>
                    </div>
                    <div class="chat-last-message">
                        ${escapeHtml(lastMessagePrefix + lastMessage)}
                    </div>
                    <div class="chat-time">${escapeHtml(time)}</div>
                </div>
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            `;
            
            elements.chatsList.appendChild(div);
        });
    }

    async function loadMessages(username) {
        if (!username || !currentUser) return;
        
        const cacheKey = `${currentUser.username}_${username}`;
        if (messageCache.has(cacheKey)) {
            displayMessages(messageCache.get(cacheKey));
            return;
        }
        
        try {
            showLoading();
            
            const usernames = [currentUser.username, username].sort();
            const chatId = usernames.join('_');
            
            const { data: messages, error } = await supabase
                .from('private_messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true })
                .limit(200);
            
            if (error) throw error;
            
            messageCache.set(cacheKey, messages || []);
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
        } finally {
            hideLoading();
        }
    }

    function addMessageToDisplay(message, isMyMessage) {
        if (!elements.privateMessages) return;
        
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
                    ${escapeHtml(time)}
                    ${status}
                </div>
            </div>
        `;
        
        elements.privateMessages.appendChild(div);
        scrollToBottom();
    }

    function displayMessages(messages) {
        if (!elements.privateMessages) return;
        
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
                        ${escapeHtml(time)}
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
        if (!elements.privateMessages) return;
        
        requestAnimationFrame(() => {
            elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
        });
    }

    function getMessageStatus(msg) {
        if (msg.read) {
            return '<span class="message-status read">✓✓</span>';
        } else if (msg.sender === currentUser.username) {
            return '<span class="message-status delivered">✓</span>';
        }
        return '';
    }

    async function handleSendMessage() {
        if (!currentChatWith || !currentUser || isSending) return;
        
        if (!elements.messageInput) return;
        
        const message = elements.messageInput.value.trim();
        if (!message) return;
        
        if (message.length > 1000) {
            alert('Сообщение слишком длинное (макс. 1000 символов)');
            return;
        }
        
        if (!navigator.onLine) {
            alert('Нет соединения с интернетом');
            return;
        }
        
        try {
            isSending = true;
            if (elements.sendMessageBtn) {
                elements.sendMessageBtn.disabled = true;
            }
            
            const usernames = [currentUser.username, currentChatWith].sort();
            const chatId = usernames.join('_');
            
            const { data, error } = await supabase
                .from('private_messages')
                .insert({
                    chat_id: chatId,
                    sender: currentUser.username,
                    receiver: currentChatWith,
                    message: message,
                    read: false,
                    created_at: new Date().toISOString()
                })
                .select();
            
            if (error) throw error;
            
            elements.messageInput.value = '';
            
            if (data && data[0]) {
                addMessageToDisplay(data[0], true);
                
                const cacheKey = `${currentUser.username}_${currentChatWith}`;
                if (messageCache.has(cacheKey)) {
                    const cached = messageCache.get(cacheKey);
                    cached.push(data[0]);
                    messageCache.set(cacheKey, cached);
                }
                
                loadChats();
            }
            
        } catch (error) {
            console.error('Ошибка отправки:', error);
            alert('Не удалось отправить сообщение');
        } finally {
            isSending = false;
            if (elements.sendMessageBtn) {
                elements.sendMessageBtn.disabled = false;
            }
            if (elements.messageInput) {
                elements.messageInput.focus();
            }
        }
    }

    async function markChatAsRead(username) {
        if (!username || !currentUser) return;
        
        try {
            await supabase
                .from('private_messages')
                .update({ read: true })
                .eq('receiver', currentUser.username)
                .eq('sender', username)
                .eq('read', false);
            
            unreadMessages.delete(username);
            updateUnreadNotifications();
            updateChatsList();
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
        if (!elements.newChatUsername || !elements.newChatError) return;
        
        const username = elements.newChatUsername.value.trim();
        
        if (!username) {
            showError(elements.newChatError, 'Введите имя пользователя');
            return;
        }
        
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
            showError(elements.newChatError, 'Только буквы, цифры и _ (3-20 символов)');
            return;
        }
        
        if (username === currentUser.username) {
            showError(elements.newChatError, 'Нельзя начать чат с самим собой');
            return;
        }

        try {
            showLoading();
            
            const { data: existingUser, error } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

            if (error || !existingUser) {
                showError(elements.newChatError, 'Пользователь не найден');
                return;
            }

            hideModal('newChatModal');
            await showChat(username);
            
        } catch (error) {
            console.error('Ошибка:', error);
            showError(elements.newChatError, 'Ошибка поиска пользователя');
        } finally {
            hideLoading();
        }
    }

    async function handleLogin() {
        if (!elements.loginUsername || !elements.loginError) return;
        
        const username = elements.loginUsername.value.trim();
        
        if (!username) {
            showError(elements.loginError, 'Введите имя пользователя');
            return;
        }
        
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
            showError(elements.loginError, 'Только буквы, цифры и _ (3-20 символов)');
            return;
        }

        try {
            showLoading();
            
            currentUser = {
                username: username,
                createdAt: new Date().toISOString()
            };
            
            const { error } = await supabase
                .from('users')
                .upsert({
                    username: username,
                    is_online: true,
                    last_seen: new Date().toISOString()
                }, {
                    onConflict: 'username'
                });

            if (error) throw error;
            
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));

            showChats();
            updateUserDisplay();
            setupRealtime();
            loadChats();
            checkOnlineStatuses();
            
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            showError(elements.loginError, 'Ошибка входа');
            currentUser = null;
        } finally {
            hideLoading();
        }
    }

    async function handleEditProfile() {
        if (!elements.editUsername || !elements.editUsernameError) return;
        
        const newUsername = elements.editUsername.value.trim();
        
        if (!newUsername) {
            showError(elements.editUsernameError, 'Введите новое имя');
            return;
        }
        
        if (!/^[A-Za-z0-9_]{3,20}$/.test(newUsername)) {
            showError(elements.editUsernameError, 'Только буквы, цифры и _ (3-20 символов)');
            return;
        }
        
        if (newUsername === currentUser.username) {
            hideModal('editProfileModal');
            return;
        }

        try {
            showLoading();
            
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('username')
                .eq('username', newUsername)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingUser) {
                showError(elements.editUsernameError, 'Этот никнейм уже используется');
                return;
            }

            await setUserOffline();
            
            const { error: upsertError } = await supabase
                .from('users')
                .upsert({
                    username: newUsername,
                    is_online: true,
                    last_seen: new Date().toISOString()
                }, {
                    onConflict: 'username'
                });

            if (upsertError) throw upsertError;

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUserDisplay();
            hideModal('editProfileModal');
            if (elements.chatsTitle) {
                elements.chatsTitle.textContent = 'Чаты (' + newUsername + ')';
            }
            
            await updateUserOnline();
            loadChats();
            if (currentChatWith) {
                showChat(currentChatWith);
            }
        } catch (error) {
            console.error('Ошибка изменения имени:', error);
            showError(elements.editUsernameError, 'Ошибка изменения имени');
        } finally {
            hideLoading();
        }
    }

    async function handleSearch() {
        if (!elements.searchUsername || !elements.searchResults) return;
        
        const searchTerm = elements.searchUsername.value.trim();
        
        if (!searchTerm) {
            elements.searchResults.innerHTML = '';
            return;
        }

        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('username, is_online')
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
        if (!elements.searchResults) return;
        
        elements.searchResults.innerHTML = '';
        
        if (users.length === 0) {
            elements.searchResults.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">Пользователи не найдены</p>';
            return;
        }

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-result';
            div.onclick = () => {
                hideModal('findFriendsModal');
                showChat(user.username);
            };
            
            const isOnline = user.is_online === true;
            
            div.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar ${isOnline ? 'online' : ''}">${escapeHtml(getAvatarLetter(user.username))}</div>
                    <div>
                        <div class="user-result-name">${escapeHtml(user.username)}</div>
                        <div class="user-result-status" style="color: rgba(255,255,255,0.7); font-size: 12px;">
                            ${isOnline ? 'на связи' : 'без связи'}
                        </div>
                    </div>
                </div>
            `;
            
            elements.searchResults.appendChild(div);
        });
    }

    function updateSearchResults() {
        if (!elements.searchResults) return;
        
        const userResults = elements.searchResults.querySelectorAll('.user-result');
        userResults.forEach(result => {
            const usernameElement = result.querySelector('.user-result-name');
            if (usernameElement) {
                const username = usernameElement.textContent;
                const isOnline = onlineUsers.get(username) === true;
                const avatar = result.querySelector('.user-result-avatar');
                const status = result.querySelector('.user-result-status');
                
                if (avatar) {
                    avatar.className = `user-result-avatar ${isOnline ? 'online' : ''}`;
                }
                if (status) {
                    status.textContent = isOnline ? 'на связи' : 'без связи';
                }
            }
        });
    }

    function getContacts() {
        try {
            const contacts = localStorage.getItem('speednexus_contacts');
            return contacts ? JSON.parse(contacts) : [];
        } catch {
            return [];
        }
    }

    function loadContacts() {
        if (!elements.contactsList) return;
        
        const contacts = getContacts();
        elements.contactsList.innerHTML = '';
        
        if (contacts.length === 0) {
            elements.contactsList.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">Контакты не найдены</p>';
            return;
        }

        contacts.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            div.onclick = () => {
                hideModal('contactsModal');
                showChat(contact.username);
            };
            
            const isOnline = onlineUsers.get(contact.username) === true;
            
            div.innerHTML = `
                <div class="contact-info">
                    <div class="contact-avatar ${isOnline ? 'online' : ''}">${escapeHtml(getAvatarLetter(contact.username))}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div class="contact-status" style="color: rgba(255,255,255,0.7); font-size: 12px;">
                            ${isOnline ? 'на связи' : 'без связи'}
                        </div>
                    </div>
                </div>
            `;
            
            elements.contactsList.appendChild(div);
        });
    }

    function updateContactsList() {
        if (!elements.contactsList) return;
        
        const contactItems = elements.contactsList.querySelectorAll('.contact-item');
        contactItems.forEach(item => {
            const usernameElement = item.querySelector('.contact-name');
            if (usernameElement) {
                const username = usernameElement.textContent;
                const isOnline = onlineUsers.get(username) === true;
                const avatar = item.querySelector('.contact-avatar');
                const status = item.querySelector('.contact-status');
                
                if (avatar) {
                    avatar.className = `contact-avatar ${isOnline ? 'online' : ''}`;
                }
                if (status) {
                    status.textContent = isOnline ? 'на связи' : 'без связи';
                }
            }
        });
    }

    async function handleLogout() {
        await setUserOffline();
        localStorage.removeItem('speednexus_user');
        
        cleanupRealtime();
        
        currentUser = null;
        currentChatWith = null;
        chats = [];
        unreadMessages.clear();
        onlineUsers.clear();
        messageCache.clear();
        
        showLogin();
        if (elements.loginUsername) {
            elements.loginUsername.value = '';
        }
        
        if (elements.sideMenu) {
            elements.sideMenu.classList.remove('show');
            elements.sideMenu.style.display = 'none';
        }
    }

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            hideSideMenu();
            
            const input = modal.querySelector('input');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    function showError(element, message) {
        if (!element) return;
        
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }

    function getAvatarLetter(username) {
        return username ? username.charAt(0).toUpperCase() : '?';
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
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === yesterday.toDateString()) {
            return 'вчера';
        }
        
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }

    function filterChats(searchTerm) {
        if (!searchTerm || !chats) {
            displayChats(chats);
            return;
        }
        
        const filtered = chats.filter(chat => 
            chat.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        displayChats(filtered);
    }

    function updateChatsList() {
        if (!elements.chatsList) return;
        
        const chatItems = elements.chatsList.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const nameElement = item.querySelector('.chat-name');
            if (!nameElement) return;
            
            const text = nameElement.childNodes[0]?.textContent || '';
            const username = text.trim();
            
            if (!username) return;
            
            const isOnline = onlineUsers.get(username) === true;
            
            const avatar = item.querySelector('.chat-avatar');
            if (avatar) {
                avatar.className = `chat-avatar ${isOnline ? 'online' : ''}`;
            }
            
            const statusText = item.querySelector('.chat-status-text');
            if (statusText) {
                statusText.textContent = isOnline ? 'на связи' : 'без связи';
                statusText.className = `chat-status-text ${isOnline ? 'online' : ''}`;
            }
        });
    }

    init();

    window.addEventListener('beforeunload', () => {
        setUserOffline();
    });
})();
