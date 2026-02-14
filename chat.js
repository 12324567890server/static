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
        userStatusDisplay: document.getElementById('userStatusDisplay')
    };

    let currentUser = null;
    let currentChatWith = null;
    let chats = [];
    let unreadMessages = new Map();
    let onlineUsers = new Map();
    let heartbeatInterval = null;
    let messageSubscription = null;
    let userSubscription = null;

    async function init() {
        await checkUser();
        setupEventListeners();
    }

    async function checkUser() {
        const savedUser = localStorage.getItem('speednexus_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                const { data } = await supabase
                    .from('users')
                    .select('username')
                    .eq('username', currentUser.username)
                    .single();
                
                if (data) {
                    await updateUserOnline();
                    showChats();
                    updateUserDisplay();
                    setupRealtime();
                    await loadChats();
                    startHeartbeat();
                } else {
                    localStorage.removeItem('speednexus_user');
                    showLogin();
                }
            } catch {
                localStorage.removeItem('speednexus_user');
                showLogin();
            }
        } else {
            showLogin();
        }
    }

    function showLogin() {
        stopHeartbeat();
        elements.loginScreen.style.display = 'flex';
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        elements.loginUsername.focus();
    }

    function showChats() {
        elements.loginScreen.style.display = 'none';
        elements.chatsScreen.style.display = 'flex';
        elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        elements.chatsTitle.textContent = 'Чаты';
    }

    async function showChat(username) {
        currentChatWith = username;
        elements.chatWithUser.textContent = username;
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'flex';
        elements.privateMessages.innerHTML = '';
        await loadMessages(username);
        updateChatStatus();
        elements.messageInput.focus();
        await markChatAsRead(username);
    }

    function updateUserDisplay() {
        if (currentUser) {
            elements.currentUsernameDisplay.textContent = currentUser.username;
            elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
            elements.userStatusDisplay.textContent = 'на связи';
        }
    }

    function setupEventListeners() {
        elements.loginButton.onclick = handleLogin;
        elements.loginUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });

        elements.chatsMenuBtn.onclick = () => {
            elements.sideMenu.style.display = 'block';
            setTimeout(() => elements.sideMenu.classList.add('show'), 10);
        };

        elements.closeMenu.onclick = hideSideMenu;

        document.addEventListener('click', (e) => {
            if (!elements.sideMenu.contains(e.target) && 
                !elements.chatsMenuBtn.contains(e.target) &&
                elements.sideMenu.classList.contains('show')) {
                hideSideMenu();
            }
        });

        elements.newChatBtn.onclick = () => {
            elements.newChatUsername.value = '';
            showModal('newChatModal');
        };

        elements.backToChats.onclick = () => {
            currentChatWith = null;
            showChats();
        };

        elements.editProfileBtn.onclick = () => {
            elements.editUsername.value = currentUser.username;
            showModal('editProfileModal');
        };

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
                const modal = e.target.closest('.modal');
                if (modal) hideModal(modal.id);
            };
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.onclick = (e) => {
                if (e.target === modal) hideModal(modal.id);
            };
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllModals();
                hideSideMenu();
            }
        });

        elements.searchChats.addEventListener('input', function() {
            filterChats(this.value);
        });
    }

    function hideSideMenu() {
        elements.sideMenu.classList.remove('show');
        setTimeout(() => {
            elements.sideMenu.style.display = 'none';
        }, 300);
    }

    function setupRealtime() {
        if (messageSubscription) {
            supabase.removeChannel(messageSubscription);
        }
        if (userSubscription) {
            supabase.removeChannel(userSubscription);
        }

        messageSubscription = supabase
            .channel('messages')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'private_messages' }, 
                (payload) => {
                    const msg = payload.new;
                    if (msg.receiver === currentUser.username || msg.sender === currentUser.username) {
                        handleNewMessage(msg);
                    }
                }
            )
            .subscribe();

        userSubscription = supabase
            .channel('users')
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'users' }, 
                (payload) => {
                    const user = payload.new;
                    if (user.username !== currentUser.username) {
                        onlineUsers.set(user.username, user.is_online);
                        if (currentChatWith === user.username) {
                            updateChatStatus();
                        }
                        updateChatsList();
                    }
                }
            )
            .subscribe();
    }

    function startHeartbeat() {
        stopHeartbeat();
        updateUserOnline();
        heartbeatInterval = setInterval(updateUserOnline, 30000);
    }

    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    async function updateUserOnline() {
        if (!currentUser) return;
        try {
            await supabase
                .from('users')
                .upsert({ 
                    username: currentUser.username, 
                    is_online: true, 
                    last_seen: new Date().toISOString() 
                }, { 
                    onConflict: 'username' 
                });
        } catch (e) {}
    }

    async function setUserOffline() {
        if (!currentUser) return;
        try {
            await supabase
                .from('users')
                .update({ is_online: false, last_seen: new Date().toISOString() })
                .eq('username', currentUser.username);
        } catch (e) {}
    }

    function handleNewMessage(msg) {
        if (currentChatWith === msg.sender) {
            if (!document.querySelector(`[data-message-id="${msg.id}"]`)) {
                addMessageToDisplay(msg, false);
                markChatAsRead(msg.sender);
            }
        } else if (msg.receiver === currentUser.username) {
            const count = unreadMessages.get(msg.sender) || 0;
            unreadMessages.set(msg.sender, count + 1);
            updateUnreadNotifications();
            loadChats();
        }
    }

    function updateChatStatus() {
        if (!currentChatWith || !elements.chatStatus) return;
        const isOnline = onlineUsers.get(currentChatWith) === true;
        elements.chatStatus.textContent = isOnline ? 'на связи' : 'без связи';
        elements.chatStatus.style.color = isOnline ? '#b19cd9' : 'rgba(255,255,255,0.7)';
    }

    async function loadChats() {
        if (!currentUser) return;
        try {
            const { data: messages } = await supabase
                .from('private_messages')
                .select('*')
                .or(`sender.eq.${currentUser.username},receiver.eq.${currentUser.username}`)
                .order('created_at', { ascending: false });

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
            await checkOnlineStatuses();
        } catch (e) {}
    }

    function displayChats(chatList) {
        elements.chatsList.innerHTML = '';
        
        if (chatList.length === 0) {
            elements.chatsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px;">Нет чатов</div>';
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
            
            const lastMessagePrefix = chat.isMyMessage ? 'Вы: ' : '';
            let lastMessage = chat.lastMessage || '';
            if (lastMessage.length > 25) lastMessage = lastMessage.substring(0, 25) + '...';
            
            div.innerHTML = `
                <div class="chat-avatar ${isOnline ? 'online' : ''}">${escapeHtml(chat.username.charAt(0).toUpperCase())}</div>
                <div class="chat-info">
                    <div class="chat-name">
                        ${escapeHtml(chat.username)}
                        <span class="chat-status-text ${isOnline ? 'online' : ''}">
                            ${isOnline ? 'на связи' : 'без связи'}
                        </span>
                    </div>
                    <div class="chat-last-message">${escapeHtml(lastMessagePrefix + lastMessage)}</div>
                    <div class="chat-time">${escapeHtml(time)}</div>
                </div>
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            `;
            
            elements.chatsList.appendChild(div);
        });
    }

    async function loadMessages(username) {
        if (!username || !currentUser) return;
        try {
            const chatId = [currentUser.username, username].sort().join('_');
            const { data: messages } = await supabase
                .from('private_messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            displayMessages(messages || []);

            const unreadIds = (messages || [])
                .filter(msg => msg.receiver === currentUser.username && !msg.read)
                .map(msg => msg.id);

            if (unreadIds.length > 0) {
                await supabase
                    .from('private_messages')
                    .update({ read: true })
                    .in('id', unreadIds);
            }
        } catch (e) {}
    }

    function displayMessages(messages) {
        elements.privateMessages.innerHTML = '';
        messages.forEach(msg => {
            const isMyMessage = msg.sender === currentUser.username;
            const div = document.createElement('div');
            div.className = `message ${isMyMessage ? 'me' : 'other'}`;
            div.dataset.messageId = msg.id;
            
            const date = new Date(msg.created_at);
            const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const status = isMyMessage ? (msg.read ? '<span class="message-status read">✓✓</span>' : '<span class="message-status delivered">✓</span>') : '';
            
            div.innerHTML = `
                <div class="message-content">
                    <div class="text">${escapeHtml(msg.message)}</div>
                    <div class="time">${escapeHtml(time)} ${status}</div>
                </div>
            `;
            elements.privateMessages.appendChild(div);
        });
        scrollToBottom();
    }

    function addMessageToDisplay(msg, isMyMessage) {
        const div = document.createElement('div');
        div.className = `message ${isMyMessage ? 'me' : 'other'}`;
        div.dataset.messageId = msg.id;
        
        const date = new Date(msg.created_at);
        const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const status = isMyMessage ? (msg.read ? '<span class="message-status read">✓✓</span>' : '<span class="message-status delivered">✓</span>') : '';
        
        div.innerHTML = `
            <div class="message-content">
                <div class="text">${escapeHtml(msg.message)}</div>
                <div class="time">${escapeHtml(time)} ${status}</div>
            </div>
        `;
        elements.privateMessages.appendChild(div);
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

    async function handleSendMessage() {
        if (!currentChatWith || !currentUser || !elements.messageInput.value.trim()) return;
        
        const message = elements.messageInput.value.trim();
        elements.messageInput.value = '';
        
        try {
            const chatId = [currentUser.username, currentChatWith].sort().join('_');
            const { data } = await supabase
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

            if (data && data[0]) {
                addMessageToDisplay(data[0], true);
                loadChats();
            }
        } catch (e) {}
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
        } catch (e) {}
    }

    function updateUnreadNotifications() {
        let total = 0;
        for (const count of unreadMessages.values()) total += count;
        document.title = total > 0 ? `(${total}) SpeedNexus` : 'SpeedNexus';
    }

    async function handleStartNewChat() {
        const username = elements.newChatUsername.value.trim();
        if (!username) {
            showError(elements.newChatError, 'Введите имя');
            return;
        }
        if (username === currentUser.username) {
            showError(elements.newChatError, 'Нельзя с собой');
            return;
        }

        try {
            const { data } = await supabase
                .from('users')
                .select('username')
                .eq('username', username)
                .single();

            if (!data) {
                showError(elements.newChatError, 'Пользователь не найден');
                return;
            }

            hideModal('newChatModal');
            showChat(username);
        } catch {
            showError(elements.newChatError, 'Ошибка');
        }
    }

    async function handleLogin() {
        const username = elements.loginUsername.value.trim();
        if (!username || username.length < 3) {
            showError(elements.loginError, 'Минимум 3 символа');
            return;
        }
        if (!/^[A-Za-z0-9_]+$/.test(username)) {
            showError(elements.loginError, 'Только буквы, цифры и _');
            return;
        }

        try {
            currentUser = { username };
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            await supabase
                .from('users')
                .upsert({ 
                    username, 
                    is_online: true, 
                    last_seen: new Date().toISOString() 
                }, { 
                    onConflict: 'username' 
                });

            showChats();
            updateUserDisplay();
            setupRealtime();
            await loadChats();
            startHeartbeat();
        } catch {
            showError(elements.loginError, 'Ошибка входа');
        }
    }

    async function handleEditProfile() {
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

        try {
            const { data } = await supabase
                .from('users')
                .select('username')
                .eq('username', newUsername)
                .single();

            if (data) {
                showError(elements.editUsernameError, 'Имя занято');
                return;
            }

            await setUserOffline();
            await supabase
                .from('users')
                .upsert({ 
                    username: newUsername, 
                    is_online: true, 
                    last_seen: new Date().toISOString() 
                }, { 
                    onConflict: 'username' 
                });

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            updateUserDisplay();
            hideModal('editProfileModal');
            await loadChats();
        } catch {
            showError(elements.editUsernameError, 'Ошибка');
        }
    }

    async function handleSearch() {
        const searchTerm = elements.searchUsername.value.trim();
        if (!searchTerm) {
            elements.searchResults.innerHTML = '';
            return;
        }

        try {
            const { data: users } = await supabase
                .from('users')
                .select('username, is_online')
                .ilike('username', `%${searchTerm}%`)
                .neq('username', currentUser.username)
                .limit(10);

            elements.searchResults.innerHTML = '';
            
            if (!users || users.length === 0) {
                elements.searchResults.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">Не найдены</p>';
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
                        <div class="user-result-avatar ${isOnline ? 'online' : ''}">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
                        <div>
                            <div class="user-result-name">${escapeHtml(user.username)}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                        </div>
                    </div>
                `;
                
                elements.searchResults.appendChild(div);
            });
        } catch {}
    }

    function loadContacts() {
        const contacts = JSON.parse(localStorage.getItem('speednexus_contacts') || '[]');
        elements.contactsList.innerHTML = '';
        
        if (contacts.length === 0) {
            elements.contactsList.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">Нет контактов</p>';
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
                    <div class="contact-avatar ${isOnline ? 'online' : ''}">${escapeHtml(contact.username.charAt(0).toUpperCase())}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${isOnline ? 'на связи' : 'без связи'}</div>
                    </div>
                </div>
            `;
            
            elements.contactsList.appendChild(div);
        });
    }

    async function checkOnlineStatuses() {
        if (!currentUser) return;
        
        const usernames = new Set();
        if (currentChatWith) usernames.add(currentChatWith);
        chats.forEach(chat => usernames.add(chat.username));
        
        if (usernames.size === 0) return;

        try {
            const { data: users } = await supabase
                .from('users')
                .select('username, is_online')
                .in('username', Array.from(usernames));

            if (users) {
                users.forEach(user => onlineUsers.set(user.username, user.is_online));
                updateChatStatus();
                updateChatsList();
            }
        } catch {}
    }

    function updateChatsList() {
        const items = elements.chatsList.querySelectorAll('.chat-item');
        items.forEach(item => {
            const nameElement = item.querySelector('.chat-name');
            if (!nameElement) return;
            
            const username = nameElement.childNodes[0]?.textContent?.trim() || '';
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

    async function handleLogout() {
        await setUserOffline();
        localStorage.removeItem('speednexus_user');
        stopHeartbeat();
        if (messageSubscription) supabase.removeChannel(messageSubscription);
        if (userSubscription) supabase.removeChannel(userSubscription);
        currentUser = null;
        currentChatWith = null;
        showLogin();
        elements.loginUsername.value = '';
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

    function formatTime(date) {
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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

    init();

    window.addEventListener('beforeunload', () => {
        setUserOffline();
    });
})();
