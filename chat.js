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
    let messageSubscription = null;
    let userSubscription = null;
    let heartbeatInterval = null;

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
                const { data } = await supabase
                    .from('users')
                    .select('username')
                    .eq('username', currentUser.username)
                    .maybeSingle();
                
                if (data) {
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
        if (messageSubscription) {
            messageSubscription.unsubscribe();
            messageSubscription = null;
        }
        if (userSubscription) {
            userSubscription.unsubscribe();
            userSubscription = null;
        }
    }

    function setupRealtimeSubscriptions() {
        cleanupSubscriptions();

        messageSubscription = supabase
            .channel('messages-channel')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'private_messages' }, 
                payload => handleNewMessage(payload.new)
            )
            .subscribe();

        userSubscription = supabase
            .channel('users-channel')
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'users' }, 
                payload => handleUserUpdate(payload.new)
            )
            .subscribe();
    }

    function handleUserUpdate(user) {
        if (user && user.username !== currentUser?.username) {
            onlineUsers[user.username] = user.is_online;
            if (currentChatWith === user.username) {
                updateChatStatus();
            }
            updateChatsList();
            updateSearchResults();
        }
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
            await supabase
                .from('users')
                .update({ 
                    is_online: status, 
                    last_seen: new Date().toISOString() 
                })
                .eq('username', currentUser.username);
        } catch (e) {}
    }

    function handleNewMessage(msg) {
        if (!currentUser) return;
        
        if (msg.receiver === currentUser.username || msg.sender === currentUser.username) {
            if (currentChatWith === (msg.sender === currentUser.username ? msg.receiver : msg.sender)) {
                if (!document.querySelector(`[data-message-id="${msg.id}"]`)) {
                    displayMessage(msg, msg.sender === currentUser.username);
                    scrollToBottom();
                    if (msg.receiver === currentUser.username) {
                        markMessagesAsRead(msg.sender);
                    }
                }
            } else if (msg.receiver === currentUser.username) {
                unreadCounts[msg.sender] = (unreadCounts[msg.sender] || 0) + 1;
                updateTitle();
            }
            loadChats();
        }
    }

    function updateChatStatus() {
        if (!currentChatWith || !elements.chatStatus) return;
        const isOnline = onlineUsers[currentChatWith] === true;
        elements.chatStatus.textContent = isOnline ? 'на связи' : 'без связи';
    }

    async function loadChats() {
        if (!currentUser) return;
        
        const { data } = await supabase
            .from('private_messages')
            .select('*')
            .or(`sender.eq.${currentUser.username},receiver.eq.${currentUser.username}`)
            .order('created_at', { ascending: false });

        const chatsMap = new Map();
        const newUnreadCounts = {};

        if (data) {
            for (const msg of data) {
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
            }
        }

        chats = Array.from(chatsMap.values());
        unreadCounts = newUnreadCounts;
        displayChats();
        updateTitle();
        loadOnlineStatuses();
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
        
        const chatId = [currentUser.username, username].sort().join('_');
        const { data } = await supabase
            .from('private_messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (data) {
            elements.privateMessages.innerHTML = '';
            data.forEach(msg => {
                displayMessage(msg, msg.sender === currentUser.username);
            });
        }
    }

    function displayMessage(msg, isMyMessage) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isMyMessage ? 'me' : 'other'}`;
        messageElement.dataset.messageId = msg.id;
        
        const messageTime = new Date(msg.created_at);
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
        const { data } = await supabase
            .from('private_messages')
            .insert({
                chat_id: chatId,
                sender: currentUser.username,
                receiver: currentChatWith,
                message: messageText,
                read: false,
                created_at: new Date().toISOString()
            })
            .select();

        if (data && data[0]) {
            displayMessage(data[0], true);
            scrollToBottom();
            loadChats();
        }
    }

    async function markMessagesAsRead(username) {
        if (!username || !currentUser) return;
        
        await supabase
            .from('private_messages')
            .update({ read: true })
            .eq('receiver', currentUser.username)
            .eq('sender', username)
            .eq('read', false);
        
        delete unreadCounts[username];
        updateTitle();
        loadChats();
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
            const { data } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .maybeSingle();

            if (!data) {
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
            const { data: existingUser } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .maybeSingle();

            if (!existingUser) {
                const { error } = await supabase
                    .from('users')
                    .insert({ 
                        username: username, 
                        is_online: true, 
                        last_seen: new Date().toISOString() 
                    });
                
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('users')
                    .update({ 
                        is_online: true, 
                        last_seen: new Date().toISOString() 
                    })
                    .eq('username', username);
                
                if (error) throw error;
            }

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
            const { data } = await supabase
                .from('users')
                .select('username')
                .eq('username', newUsername)
                .maybeSingle();

            if (data) {
                showError(elements.editUsernameError, 'Имя пользователя уже занято');
                return;
            }

            await setOnline(false);
            
            await supabase
                .from('users')
                .insert({ 
                    username: newUsername, 
                    is_online: true, 
                    last_seen: new Date().toISOString() 
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
            let query = supabase
                .from('users')
                .select('username, is_online');
            
            if (searchTerm) {
                query = query.ilike('username', `%${searchTerm}%`);
            }
            
            const { data } = await query.limit(50);

            elements.searchResults.innerHTML = '';
            
            if (!data || data.length === 0) {
                elements.searchResults.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Пользователи не найдены</div>';
                return;
            }

            const filteredUsers = data.filter(user => user.username !== currentUser?.username);

            if (filteredUsers.length === 0) {
                elements.searchResults.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Пользователи не найдены</div>';
                return;
            }

            filteredUsers.forEach(user => {
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

        const { data } = await supabase
            .from('users')
            .select('username, is_online')
            .in('username', usernames);

        if (data) {
            data.forEach(user => {
                onlineUsers[user.username] = user.is_online;
            });
            updateChatStatus();
            updateChatsList();
        }
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
        const messageDate = new Date(timestamp);
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

    init();
})();
