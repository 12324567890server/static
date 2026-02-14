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
    let unreadCounts = {};
    let onlineUsers = {};
    let messageSubscription = null;
    let userSubscription = null;
    let heartbeatTimer = null;

    function init() {
        checkUser();
        setupEventListeners();
    }

    async function checkUser() {
        const saved = localStorage.getItem('speednexus_user');
        if (saved) {
            currentUser = JSON.parse(saved);
            const { data } = await supabase
                .from('users')
                .select('username')
                .eq('username', currentUser.username)
                .single();
            
            if (data) {
                await setOnline(true);
                showChats();
                updateUserDisplay();
                setupRealtime();
                loadChats();
                startHeartbeat();
            } else {
                localStorage.removeItem('speednexus_user');
                showLogin();
            }
        } else {
            showLogin();
        }
    }

    function showLogin() {
        stopHeartbeat();
        cleanupSubscriptions();
        elements.loginScreen.style.display = 'flex';
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'none';
        elements.loginUsername.value = '';
        elements.loginUsername.focus();
    }

    function showChats() {
        elements.loginScreen.style.display = 'none';
        elements.chatsScreen.style.display = 'flex';
        elements.chatScreen.style.display = 'none';
        elements.chatsTitle.textContent = `Чаты`;
    }

    async function showChat(username) {
        currentChatWith = username;
        elements.chatWithUser.textContent = username;
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'flex';
        elements.privateMessages.innerHTML = '';
        elements.messageInput.value = '';
        elements.messageInput.focus();
        
        await loadMessages(username);
        await markAsRead(username);
        updateChatStatus();
        
        setTimeout(() => {
            elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
        }, 200);
    }

    function updateUserDisplay() {
        if (currentUser) {
            elements.currentUsernameDisplay.textContent = currentUser.username;
            elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
            elements.userStatusDisplay.textContent = 'на связи';
        }
    }

    function setupEventListeners() {
        elements.loginButton.addEventListener('click', handleLogin);
        elements.loginUsername.addEventListener('keypress', e => e.key === 'Enter' && handleLogin());

        elements.chatsMenuBtn.addEventListener('click', () => {
            elements.sideMenu.style.display = 'block';
            setTimeout(() => elements.sideMenu.classList.add('show'), 10);
        });

        elements.closeMenu.addEventListener('click', () => {
            elements.sideMenu.classList.remove('show');
            setTimeout(() => elements.sideMenu.style.display = 'none', 300);
        });

        document.addEventListener('click', e => {
            if (!elements.sideMenu.contains(e.target) && 
                !elements.chatsMenuBtn.contains(e.target) &&
                elements.sideMenu.classList.contains('show')) {
                elements.sideMenu.classList.remove('show');
                setTimeout(() => elements.sideMenu.style.display = 'none', 300);
            }
        });

        elements.newChatBtn.addEventListener('click', () => {
            elements.newChatUsername.value = '';
            showModal('newChatModal');
        });

        elements.backToChats.addEventListener('click', () => {
            currentChatWith = null;
            showChats();
        });

        elements.editProfileBtn.addEventListener('click', () => {
            elements.editUsername.value = currentUser.username;
            showModal('editProfileModal');
        });

        elements.saveProfileBtn.addEventListener('click', handleEditProfile);

        elements.findFriendsBtn.addEventListener('click', () => {
            elements.searchUsername.value = '';
            elements.searchResults.innerHTML = '';
            showModal('findFriendsModal');
            setTimeout(() => handleSearch(), 100);
        });

        elements.searchBtn.addEventListener('click', handleSearch);
        
        elements.searchUsername.addEventListener('input', handleSearch);
        
        elements.searchUsername.addEventListener('keypress', e => e.key === 'Enter' && handleSearch());

        elements.contactsBtn.addEventListener('click', () => {
            loadContacts();
            showModal('contactsModal');
        });

        elements.logoutBtn.addEventListener('click', handleLogout);

        elements.sendMessageBtn.addEventListener('click', handleSendMessage);
        
        elements.messageInput.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        elements.startChatBtn.addEventListener('click', handleStartNewChat);

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
                closeAllModals();
                if (elements.sideMenu.classList.contains('show')) {
                    elements.sideMenu.classList.remove('show');
                    setTimeout(() => elements.sideMenu.style.display = 'none', 300);
                }
            }
        });

        elements.searchChats.addEventListener('input', e => filterChats(e.target.value));
    }

    function setupRealtime() {
        cleanupSubscriptions();

        messageSubscription = supabase
            .channel('messages')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'private_messages' }, 
                payload => handleNewMessage(payload.new)
            )
            .subscribe();

        userSubscription = supabase
            .channel('users')
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'users' }, 
                payload => {
                    const user = payload.new;
                    if (user.username !== currentUser.username) {
                        onlineUsers[user.username] = user.is_online;
                        if (currentChatWith === user.username) updateChatStatus();
                        updateChatsList();
                        updateSearchResults();
                    }
                }
            )
            .subscribe();
    }

    function cleanupSubscriptions() {
        if (messageSubscription) supabase.removeChannel(messageSubscription);
        if (userSubscription) supabase.removeChannel(userSubscription);
        messageSubscription = null;
        userSubscription = null;
    }

    function startHeartbeat() {
        stopHeartbeat();
        setOnline(true);
        heartbeatTimer = setInterval(() => setOnline(true), 30000);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    async function setOnline(status) {
        if (!currentUser) return;
        try {
            await supabase
                .from('users')
                .upsert({ 
                    username: currentUser.username, 
                    is_online: status, 
                    last_seen: new Date().toISOString() 
                }, { onConflict: 'username' });
        } catch (e) {}
    }

    function handleNewMessage(msg) {
        if (msg.receiver !== currentUser.username && msg.sender !== currentUser.username) return;
        
        if (currentChatWith === msg.sender) {
            if (!document.querySelector(`[data-message-id="${msg.id}"]`)) {
                displayOneMessage(msg, false);
                setTimeout(() => {
                    elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
                }, 100);
                markAsRead(msg.sender);
            }
        } else if (msg.receiver === currentUser.username) {
            unreadCounts[msg.sender] = (unreadCounts[msg.sender] || 0) + 1;
            updateTitle();
            loadChats();
        }
    }

    function updateChatStatus() {
        if (!currentChatWith || !elements.chatStatus) return;
        const online = onlineUsers[currentChatWith] === true;
        elements.chatStatus.textContent = online ? 'на связи' : 'без связи';
    }

    async function loadChats() {
        if (!currentUser) return;
        
        const { data } = await supabase
            .from('private_messages')
            .select('*')
            .or(`sender.eq.${currentUser.username},receiver.eq.${currentUser.username}`)
            .order('created_at', { ascending: false });

        const chatsMap = {};
        unreadCounts = {};

        if (data) {
            for (const msg of data) {
                const other = msg.sender === currentUser.username ? msg.receiver : msg.sender;
                
                if (!chatsMap[other]) {
                    chatsMap[other] = {
                        username: other,
                        lastMessage: msg.message,
                        lastTime: msg.created_at,
                        isMyMessage: msg.sender === currentUser.username
                    };
                }
                
                if (msg.receiver === currentUser.username && !msg.read) {
                    unreadCounts[other] = (unreadCounts[other] || 0) + 1;
                }
            }
        }

        chats = Object.values(chatsMap);
        displayChats();
        updateTitle();
        loadOnlineStatuses();
    }

    async function displayChats() {
        elements.chatsList.innerHTML = '';
        
        if (chats.length === 0) {
            elements.chatsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px;">Нет чатов</div>';
            return;
        }

        chats.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

        for (const chat of chats) {
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.onclick = () => showChat(chat.username);
            
            const online = onlineUsers[chat.username] === true;
            const unread = unreadCounts[chat.username] || 0;
            const time = formatTime(new Date(chat.lastTime));
            const prefix = chat.isMyMessage ? 'Вы: ' : '';
            const lastMsg = chat.lastMessage.length > 25 ? chat.lastMessage.substr(0, 25) + '...' : chat.lastMessage;
            
            div.innerHTML = `
                <div class="chat-avatar ${online ? 'online' : ''}">${chat.username.charAt(0).toUpperCase()}</div>
                <div class="chat-info">
                    <div class="chat-name">
                        ${escapeHtml(chat.username)}
                        <span class="chat-status-text ${online ? 'online' : ''}">${online ? 'на связи' : 'без связи'}</span>
                    </div>
                    <div class="chat-last-message">${escapeHtml(prefix + lastMsg)}</div>
                    <div class="chat-time">${time}</div>
                </div>
                ${unread ? `<div class="unread-badge">${unread}</div>` : ''}
            `;
            
            elements.chatsList.appendChild(div);
        }
    }

    function updateChatsList() {
        const items = elements.chatsList.querySelectorAll('.chat-item');
        items.forEach(item => {
            const nameEl = item.querySelector('.chat-name');
            if (!nameEl) return;
            
            const username = nameEl.childNodes[0]?.textContent?.trim() || '';
            if (!username) return;
            
            const online = onlineUsers[username] === true;
            const avatar = item.querySelector('.chat-avatar');
            const status = item.querySelector('.chat-status-text');
            
            if (avatar) avatar.className = `chat-avatar ${online ? 'online' : ''}`;
            if (status) {
                status.textContent = online ? 'на связи' : 'без связи';
                status.className = `chat-status-text ${online ? 'online' : ''}`;
            }
        });
    }

    function updateSearchResults() {
        const items = elements.searchResults.querySelectorAll('.user-result');
        items.forEach(item => {
            const nameEl = item.querySelector('.user-result-name');
            if (!nameEl) return;
            
            const username = nameEl.textContent;
            const online = onlineUsers[username] === true;
            const avatar = item.querySelector('.user-result-avatar');
            
            if (avatar) {
                avatar.className = `user-result-avatar ${online ? 'online' : ''}`;
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

        elements.privateMessages.innerHTML = '';
        
        if (data) {
            data.forEach(msg => displayOneMessage(msg, msg.sender === currentUser.username));
        }
        
        setTimeout(() => {
            elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
        }, 200);
    }

    function displayOneMessage(msg, isMyMessage) {
        const div = document.createElement('div');
        div.className = `message ${isMyMessage ? 'me' : 'other'}`;
        div.dataset.messageId = msg.id;
        
        const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const status = isMyMessage ? (msg.read ? '✓✓' : '✓') : '';
        
        div.innerHTML = `
            <div class="message-content">
                <div class="text">${escapeHtml(msg.message)}</div>
                <div class="time">${time} ${status}</div>
            </div>
        `;
        
        elements.privateMessages.appendChild(div);
        
        if (isMyMessage || currentChatWith === msg.sender) {
            setTimeout(() => {
                elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
            }, 100);
        }
    }

    async function handleSendMessage() {
        if (!currentChatWith || !currentUser || !elements.messageInput.value.trim()) return;
        
        const message = elements.messageInput.value.trim();
        elements.messageInput.value = '';
        
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
            displayOneMessage(data[0], true);
            elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
            loadChats();
        }
    }

    async function markAsRead(username) {
        if (!username || !currentUser) return;
        
        await supabase
            .from('private_messages')
            .update({ read: true })
            .eq('receiver', currentUser.username)
            .eq('sender', username)
            .eq('read', false);
        
        delete unreadCounts[username];
        updateTitle();
    }

    function updateTitle() {
        const total = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
        document.title = total ? `(${total}) SpeedNexus` : 'SpeedNexus';
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

        currentUser = { username };
        localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
        
        await supabase
            .from('users')
            .upsert({ 
                username, 
                is_online: true, 
                last_seen: new Date().toISOString() 
            }, { onConflict: 'username' });

        showChats();
        updateUserDisplay();
        setupRealtime();
        loadChats();
        startHeartbeat();
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

        const { data } = await supabase
            .from('users')
            .select('username')
            .eq('username', newUsername)
            .single();

        if (data) {
            showError(elements.editUsernameError, 'Имя занято');
            return;
        }

        await setOnline(false);
        await supabase
            .from('users')
            .upsert({ 
                username: newUsername, 
                is_online: true, 
                last_seen: new Date().toISOString() 
            }, { onConflict: 'username' });

        currentUser.username = newUsername;
        localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
        
        updateUserDisplay();
        hideModal('editProfileModal');
        loadChats();
    }

    async function handleSearch() {
        const term = elements.searchUsername.value.trim();
        
        let query = supabase
            .from('users')
            .select('username, is_online')
            .neq('username', currentUser.username)
            .limit(20);
        
        if (term) {
            query = query.ilike('username', `%${term}%`);
        }
        
        const { data } = await query;

        elements.searchResults.innerHTML = '';
        
        if (!data || data.length === 0) {
            elements.searchResults.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">Никого нет</p>';
            return;
        }

        data.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-result';
            div.onclick = () => {
                hideModal('findFriendsModal');
                showChat(user.username);
            };
            
            div.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar ${user.is_online ? 'online' : ''}">${user.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="user-result-name">${escapeHtml(user.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${user.is_online ? 'на связи' : 'без связи'}</div>
                    </div>
                </div>
            `;
            
            elements.searchResults.appendChild(div);
        });
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
            
            const online = onlineUsers[contact.username] === true;
            
            div.innerHTML = `
                <div class="contact-info">
                    <div class="contact-avatar ${online ? 'online' : ''}">${contact.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">${online ? 'на связи' : 'без связи'}</div>
                    </div>
                </div>
            `;
            
            elements.contactsList.appendChild(div);
        });
    }

    async function loadOnlineStatuses() {
        const usernames = chats.map(c => c.username);
        if (currentChatWith) usernames.push(currentChatWith);
        if (usernames.length === 0) return;

        const { data } = await supabase
            .from('users')
            .select('username, is_online')
            .in('username', usernames);

        if (data) {
            data.forEach(u => onlineUsers[u.username] = u.is_online);
            updateChatStatus();
            updateChatsList();
        }
    }

    function filterChats(term) {
        if (!term) {
            displayChats();
            return;
        }
        const filtered = chats.filter(c => c.username.toLowerCase().includes(term.toLowerCase()));
        displayChats(filtered);
    }

    function handleLogout() {
        setOnline(false);
        localStorage.removeItem('speednexus_user');
        stopHeartbeat();
        cleanupSubscriptions();
        currentUser = null;
        currentChatWith = null;
        showLogin();
    }

    function showModal(id) {
        document.getElementById(id).style.display = 'flex';
    }

    function hideModal(id) {
        document.getElementById(id).style.display = 'none';
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }

    function showError(el, msg) {
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    function formatTime(date) {
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    init();

    window.addEventListener('beforeunload', () => {
        setOnline(false);
    });
})();
