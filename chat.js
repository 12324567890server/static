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
        archiveAccountBtn: document.getElementById('archiveAccountBtn'),
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
        restoreSection: document.getElementById('restoreSection'),
        restoreAccountBtn: document.getElementById('restoreAccountBtn')
    };

    let currentUser = null;
    let userDeviceId = null;
    let currentChatWith = null;
    let chats = [];
    let unreadMessages = new Map();
    let onlineUsers = new Map();
    let typingUsers = new Set();
    let realtimeChannel = null;
    let onlineInterval = null;
    let chatUpdateInterval = null;
    let messageUpdateInterval = null;
    let presenceInterval = null;
    let typingTimeout = null;
    let isAppVisible = true;
    let lastTypingSent = 0;
    let lastPresenceUpdate = 0;
    let isTypingActive = false;
    let typingCheckInterval = null;

    function init() {
        checkUser();
        setupEventListeners();
        
        userDeviceId = localStorage.getItem('device_id');
        if (!userDeviceId) {
            userDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_id', userDeviceId);
        }
        
        document.addEventListener('visibilitychange', () => {
            isAppVisible = !document.hidden;
            if (isAppVisible && currentUser) {
                updateUserPresence(true);
                if (currentChatWith) {
                    loadMessages(currentChatWith);
                }
                loadChats();
            }
        });
        
        window.addEventListener('beforeunload', async () => {
            if (currentUser) {
                try {
                    await supabase
                        .from('users')
                        .update({
                            is_online: false,
                            last_seen: new Date().toISOString()
                        })
                        .eq('username', currentUser.username);
                } catch (error) {
                    console.error('Ошибка при выходе:', error);
                }
            }
        });
    }

    function startIntervals() {
        stopIntervals();
        
        chatUpdateInterval = setInterval(() => {
            if (currentUser) {
                loadChats();
            }
        }, 1500);
        
        messageUpdateInterval = setInterval(() => {
            if (currentUser && currentChatWith) {
                loadMessages(currentChatWith);
            }
        }, 1000);
        
        onlineInterval = setInterval(() => {
            if (currentUser) {
                checkOnlineStatuses();
            }
        }, 1500);
        
        presenceInterval = setInterval(() => {
            if (currentUser && isAppVisible) {
                updateUserPresence(true);
            }
        }, 5000);
        
        setupRealtime();
        
        setTimeout(() => {
            if (currentUser) {
                checkOnlineStatuses();
                loadChats();
            }
        }, 300);
    }

    function setupRealtime() {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
        
        if (!currentUser) return;
        
        realtimeChannel = supabase
            .channel('speednexus_live')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'private_messages',
                    filter: `receiver=eq.${currentUser.username}`
                }, 
                (payload) => {
                    const message = payload.new;
                    
                    if (currentChatWith && message.sender === currentChatWith) {
                        loadMessages(currentChatWith);
                        markMessageAsRead(message.id);
                    } else {
                        const count = unreadMessages.get(message.sender) || 0;
                        unreadMessages.set(message.sender, count + 1);
                        updateUnreadNotifications();
                    }
                    
                    loadChats();
                }
            )
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'private_messages'
                },
                (payload) => {
                    const message = payload.new;
                    if (message.read && message.sender === currentUser.username && currentChatWith === message.receiver) {
                        updateMessageStatus(message.id);
                    }
                }
            )
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'typing_indicators'
                },
                (payload) => {
                    const typing = payload.new;
                    if (typing.receiver === currentUser.username && typing.sender === currentChatWith) {
                        showTypingIndicator(typing.sender);
                    }
                }
            )
            .on('postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'typing_indicators',
                    filter: `receiver=eq.${currentUser.username}`
                },
                (payload) => {
                    hideTypingIndicator();
                }
            )
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'users'
                },
                (payload) => {
                    if (payload.new && payload.new.username !== currentUser.username) {
                        const user = payload.new;
                        const lastSeen = new Date(user.last_seen).getTime();
                        const now = Date.now();
                        
                        onlineUsers.set(user.username, {
                            isOnline: now - lastSeen < 10000,
                            lastSeen: user.last_seen
                        });
                        
                        updateChatStatus();
                        updateChatsList();
                    }
                }
            )
            .subscribe();
    }

    async function sendTypingIndicator() {
        if (!currentChatWith || !currentUser) return;
        
        const now = Date.now();
        if (now - lastTypingSent < 1000) return;
        
        lastTypingSent = now;
        
        try {
            await supabase
                .from('typing_indicators')
                .upsert({
                    sender: currentUser.username,
                    receiver: currentChatWith,
                    timestamp: new Date().toISOString()
                }, {
                    onConflict: 'sender,receiver'
                });
            
            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => stopTypingIndicator(), 3000);
            
            if (!typingCheckInterval) {
                typingCheckInterval = setInterval(() => {
                    if (isTypingActive) {
                        sendTypingIndicator();
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Ошибка отправки индикатора:', error);
        }
    }

    async function stopTypingIndicator() {
        if (!currentChatWith || !currentUser) return;
        
        try {
            await supabase
                .from('typing_indicators')
                .delete()
                .eq('sender', currentUser.username)
                .eq('receiver', currentChatWith);
            
            if (typingCheckInterval) {
                clearInterval(typingCheckInterval);
                typingCheckInterval = null;
            }
            isTypingActive = false;
        } catch (error) {
            console.error('Ошибка остановки индикатора:', error);
        }
    }

    function showTypingIndicator(username) {
        if (currentChatWith === username && elements.chatStatus) {
            elements.chatStatus.innerHTML = '<span class="typing-indicator">печатает...</span>';
            elements.chatStatus.style.color = '#4ade80';
            
            setTimeout(() => {
                if (elements.chatStatus && elements.chatStatus.innerHTML.includes('печатает')) {
                    hideTypingIndicator();
                }
            }, 4000);
        }
    }

    function hideTypingIndicator() {
        if (elements.chatStatus) {
            updateChatStatus();
        }
    }

    function updateMessageStatus(messageId) {
        const messageElements = document.querySelectorAll('.message');
        messageElements.forEach(el => {
            if (el.dataset.messageId === messageId) {
                const timeEl = el.querySelector('.time');
                if (timeEl) {
                    const statusSpan = timeEl.querySelector('.message-status');
                    if (statusSpan) {
                        statusSpan.innerHTML = '✓✓';
                        statusSpan.className = 'message-status read';
                    }
                }
            }
        });
    }

    function stopIntervals() {
        if (chatUpdateInterval) clearInterval(chatUpdateInterval);
        if (messageUpdateInterval) clearInterval(messageUpdateInterval);
        if (onlineInterval) clearInterval(onlineInterval);
        if (presenceInterval) clearInterval(presenceInterval);
        if (typingTimeout) clearTimeout(typingTimeout);
        if (typingCheckInterval) clearInterval(typingCheckInterval);
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
        chatUpdateInterval = null;
        messageUpdateInterval = null;
        onlineInterval = null;
        presenceInterval = null;
        typingCheckInterval = null;
    }

    function checkUser() {
        const savedUser = localStorage.getItem('speednexus_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                showChats();
                updateUserDisplay();
                startIntervals();
                updateUserPresence(true);
            } catch (e) {
                localStorage.removeItem('speednexus_user');
                showLogin();
            }
        } else {
            showLogin();
        }
    }

    async function updateUserPresence(isOnline) {
        if (!currentUser) return;
        
        const now = Date.now();
        if (now - lastPresenceUpdate < 1000) return;
        lastPresenceUpdate = now;
        
        try {
            await supabase
                .from('users')
                .upsert({
                    username: currentUser.username,
                    last_seen: new Date().toISOString(),
                    device_id: userDeviceId,
                    is_online: isOnline,
                    deleted: false
                }, {
                    onConflict: 'username'
                });
            
            onlineUsers.set(currentUser.username, {
                isOnline: isOnline,
                lastSeen: new Date().toISOString()
            });
        } catch (error) {
            console.error('Ошибка обновления присутствия:', error);
        }
    }

    async function checkOnlineStatuses() {
        if (!currentUser) return;
        
        try {
            const now = Date.now();
            const { data: users } = await supabase
                .from('users')
                .select('username, last_seen, is_online')
                .eq('deleted', false)
                .neq('username', currentUser.username)
                .limit(100);

            if (users) {
                users.forEach(user => {
                    if (user.last_seen) {
                        const lastSeen = new Date(user.last_seen).getTime();
                        const diff = now - lastSeen;
                        
                        onlineUsers.set(user.username, {
                            isOnline: diff < 10000,
                            lastSeen: user.last_seen
                        });
                    }
                });
                
                updateChatStatus();
                updateChatsList();
            }
        } catch (error) {
            console.error('Ошибка проверки онлайн:', error);
        }
    }

    function showLogin() {
        stopIntervals();
        elements.loginScreen.style.display = 'flex';
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        
        const hasArchived = localStorage.getItem('speednexus_archived_user');
        if (hasArchived) {
            elements.restoreSection.style.display = 'block';
        } else {
            elements.restoreSection.style.display = 'none';
        }
        
        elements.loginUsername.focus();
    }

    function showChats() {
        elements.loginScreen.style.display = 'none';
        elements.chatsScreen.style.display = 'flex';
        elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        elements.chatsTitle.textContent = 'Чаты (' + currentUser.username + ')';
    }

    async function showChat(username) {
        currentChatWith = username;
        elements.chatWithUser.textContent = username;
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'flex';
        closeAllModals();
        hideSideMenu();
        
        await loadMessages(username);
        updateChatStatus();
        elements.messageInput.focus();
        
        await markChatAsRead(username);
        
        unreadMessages.delete(username);
        updateUnreadNotifications();
        updateChatsList();
    }

    function updateUserDisplay() {
        if (currentUser) {
            elements.currentUsernameDisplay.textContent = currentUser.username;
        }
    }

    function updateChatStatus() {
        if (!currentChatWith) return;
        
        const userData = onlineUsers.get(currentChatWith);
        if (userData && userData.isOnline) {
            elements.chatStatus.innerHTML = '<span class="online-indicator">●</span> онлайн';
            elements.chatStatus.style.color = '#4ade80';
        } else {
            elements.chatStatus.innerHTML = '<span class="offline-indicator">●</span> не в сети';
            elements.chatStatus.style.color = 'rgba(255, 255, 255, 0.7)';
        }
    }

    function setupEventListeners() {
        elements.loginButton.onclick = handleLogin;
        elements.loginUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });

        elements.restoreAccountBtn.onclick = handleRestoreAccount;

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

        elements.contactsBtn.onclick = () => {
            showModal('contactsModal');
            loadContacts();
        };

        elements.archiveAccountBtn.onclick = handleArchiveAccount;

        elements.logoutBtn.onclick = handleLogout;

        elements.sendMessageBtn.onclick = handleSendMessage;
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        elements.messageInput.addEventListener('input', function() {
            if (currentChatWith && this.value.length > 0) {
                isTypingActive = true;
                sendTypingIndicator();
            } else if (currentChatWith) {
                isTypingActive = false;
                stopTypingIndicator();
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
            elements.searchChats.addEventListener('input', function() {
                filterChats(this.value);
            });
        }
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
                .order('created_at', { ascending: false });

            if (error) throw error;

            const chatMap = new Map();
            
            if (messages) {
                for (const msg of messages) {
                    const otherUser = msg.sender === currentUser.username ? msg.receiver : msg.sender;
                    
                    if (!chatMap.has(otherUser)) {
                        chatMap.set(otherUser, {
                            username: otherUser,
                            lastMessage: msg.message,
                            lastTime: msg.created_at,
                            isMyMessage: msg.sender === currentUser.username,
                            unreadCount: 0
                        });
                    }
                    
                    if (msg.receiver === currentUser.username && !msg.read && msg.sender !== currentUser.username) {
                        const chat = chatMap.get(otherUser);
                        chat.unreadCount = (chat.unreadCount || 0) + 1;
                    }
                }
            }

            chats = Array.from(chatMap.values());
            displayChats(chats);
            
            updateUnreadNotifications();
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
        }
    }

    function displayChats(chatList) {
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
            const unreadCount = chat.unreadCount || 0;
            const userData = onlineUsers.get(chat.username);
            const isOnline = userData ? userData.isOnline : false;
            
            let lastMessagePrefix = chat.isMyMessage ? 'Вы: ' : '';
            let lastMessage = chat.lastMessage;
            if (lastMessage.length > 25) {
                lastMessage = lastMessage.substring(0, 25) + '...';
            }
            
            div.innerHTML = `
                <div class="chat-avatar">${getAvatarLetter(chat.username)}</div>
                <div class="chat-info">
                    <div class="chat-name">
                        ${chat.username}
                        ${isOnline ? '<span class="status-indicator online"></span>' : '<span class="status-indicator offline"></span>'}
                    </div>
                    <div class="chat-last-message">
                        ${lastMessagePrefix}${lastMessage}
                    </div>
                    <div class="chat-time">${time}</div>
                </div>
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            `;
            
            elements.chatsList.appendChild(div);
        });
    }

    function getAvatarLetter(username) {
        return username.charAt(0).toUpperCase();
    }

    function formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
        
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

    async function loadMessages(username) {
        if (!username) return;
        
        try {
            const usernames = [currentUser.username, username].sort();
            const chatId = usernames.join('_');
            
            const { data: messages, error } = await supabase
                .from('private_messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });
            
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
        }
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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function scrollToBottom() {
        setTimeout(() => {
            elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
        }, 50);
    }

    function getMessageStatus(msg) {
        if (msg.read) {
            return '<span class="message-status read">✓✓</span>';
        } else {
            return '<span class="message-status sent">✓</span>';
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
            isTypingActive = false;
            stopTypingIndicator();
            
            if (data && data[0]) {
                await loadMessages(currentChatWith);
                await loadChats();
            }
            
        } catch (error) {
            console.error('Ошибка отправки:', error);
            alert('Ошибка отправки сообщения');
        }
    }

    async function markMessageAsRead(messageId) {
        try {
            await supabase
                .from('private_messages')
                .update({ read: true })
                .eq('id', messageId);
        } catch (error) {
            console.error('Ошибка пометки сообщения как прочитанного:', error);
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
                .eq('deleted', false)
                .maybeSingle();

            if (error || !existingUser) {
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

    async function handleRestoreAccount() {
        const archived = localStorage.getItem('speednexus_archived_user');
        if (!archived) return;
        
        const user = JSON.parse(archived);
        
        try {
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('username', user.username)
                .maybeSingle();

            if (existingUser && existingUser.deleted) {
                await supabase
                    .from('users')
                    .update({
                        deleted: false,
                        deleted_at: null,
                        is_online: true,
                        last_seen: new Date().toISOString(),
                        device_id: userDeviceId
                    })
                    .eq('username', user.username);

                localStorage.setItem('speednexus_user', archived);
                localStorage.removeItem('speednexus_archived_user');
                
                currentUser = user;
                showChats();
                updateUserDisplay();
                startIntervals();
                updateUserPresence(true);
            } else if (existingUser && !existingUser.deleted) {
                showError(elements.loginError, 'Этот никнейм уже используется');
            }
        } catch (error) {
            console.error('Ошибка восстановления:', error);
            showError(elements.loginError, 'Ошибка восстановления аккаунта');
        }
    }

    async function handleArchiveAccount() {
        if (!currentUser) return;
        
        if (!confirm('Скрыть аккаунт? Вы сможете восстановить его позже.')) {
            return;
        }
        
        try {
            await supabase
                .from('users')
                .update({
                    deleted: true,
                    deleted_at: new Date().toISOString(),
                    is_online: false
                })
                .eq('username', currentUser.username);
            
            localStorage.setItem('speednexus_archived_user', JSON.stringify(currentUser));
            localStorage.removeItem('speednexus_user');
            localStorage.removeItem('speednexus_contacts');
            
            currentUser = null;
            stopIntervals();
            showLogin();
        } catch (error) {
            console.error('Ошибка архивации:', error);
            alert('Ошибка при скрытии аккаунта');
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
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .maybeSingle();

            if (existingUser) {
                if (existingUser.deleted) {
                    showError(elements.loginError, 'Этот аккаунт скрыт. Восстановите его.');
                    return;
                }
                
                if (existingUser.device_id && existingUser.device_id !== userDeviceId) {
                    showError(elements.loginError, 'Этот никнейм уже используется на другом устройстве');
                    return;
                }
            }

            currentUser = {
                username: username,
                createdAt: new Date().toISOString(),
                device_id: userDeviceId
            };
            
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            await supabase
                .from('users')
                .upsert({
                    username: username,
                    device_id: userDeviceId,
                    last_seen: new Date().toISOString(),
                    is_online: true,
                    deleted: false
                }, {
                    onConflict: 'username'
                });

            showChats();
            updateUserDisplay();
            startIntervals();
            updateUserPresence(true);
            
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
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('username', newUsername)
                .maybeSingle();

            if (existingUser && existingUser.device_id !== userDeviceId) {
                showError(elements.editUsernameError, 'Этот никнейм уже используется');
                return;
            }

            await supabase
                .from('users')
                .upsert({
                    username: newUsername,
                    device_id: userDeviceId,
                    last_seen: new Date().toISOString(),
                    is_online: true,
                    deleted: false
                }, {
                    onConflict: 'username'
                });

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUserDisplay();
            hideModal('editProfileModal');
            elements.chatsTitle.textContent = 'Чаты (' + newUsername + ')';
            
            setupRealtime();
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
        
        if (!searchTerm) {
            showSearchResults([]);
            return;
        }

        try {
            const { data: users } = await supabase
                .from('users')
                .select('username, last_seen, is_online')
                .ilike('username', `%${searchTerm}%`)
                .neq('username', currentUser.username)
                .eq('deleted', false)
                .limit(10);

            showSearchResults(users || []);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }

    function showSearchResults(users) {
        elements.searchResults.innerHTML = '';
        
        if (users.length === 0) {
            elements.searchResults.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">Пользователи не найдены</p>';
            return;
        }

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-result';
            
            const contacts = getContacts();
            const isContact = contacts.some(c => c.username === user.username);
            const lastSeen = new Date(user.last_seen);
            const now = new Date();
            const diff = now - lastSeen;
            const isOnline = diff < 10000;
            
            div.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar">${getAvatarLetter(user.username)}</div>
                    <div>
                        <div class="user-result-name">${user.username}</div>
                        <div style="color: rgba(255,255,255,0.5); font-size: 12px;">
                            ${isOnline ? 'онлайн' : 'не в сети'}
                        </div>
                    </div>
                </div>
                <button class="add-contact-btn ${isContact ? 'added' : ''}" data-username="${user.username}">
                    ${isContact ? '✓' : '+'}
                </button>
            `;
            
            elements.searchResults.appendChild(div);
        });

        elements.searchResults.querySelectorAll('.add-contact-btn').forEach(btn => {
            btn.onclick = (e) => {
                const username = e.target.dataset.username;
                if (!e.target.classList.contains('added')) {
                    addToContacts(username);
                    e.target.textContent = '✓';
                    e.target.classList.add('added');
                }
            };
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
            elements.contactsList.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">Контакты не найдены</p>';
            return;
        }

        contacts.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            
            div.innerHTML = `
                <div class="contact-info">
                    <div class="contact-avatar">${getAvatarLetter(contact.username)}</div>
                    <div class="contact-name">${contact.username}</div>
                </div>
                <button class="chat-btn" data-username="${contact.username}">Чат</button>
            `;
            
            elements.contactsList.appendChild(div);
        });

        elements.contactsList.querySelectorAll('.chat-btn').forEach(btn => {
            btn.onclick = (e) => {
                const username = e.target.dataset.username;
                hideModal('contactsModal');
                showChat(username);
            };
        });
    }

    async function handleLogout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            await updateUserPresence(false);
            localStorage.removeItem('speednexus_user');
            
            currentUser = null;
            stopIntervals();
            showLogin();
            elements.loginUsername.value = '';
        }
    }

    function showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
        hideSideMenu();
    }

    function hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => element.style.display = 'none', 3000);
    }

    init();
})();
