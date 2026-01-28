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
    let onlineCheckInterval = null;
    let isUserOnline = true;

    function init() {
        checkUser();
        setupEventListeners();
        
        window.addEventListener('beforeunload', () => {
            if (currentUser) {
                setUserOffline();
            }
        });
        
        window.addEventListener('online', () => {
            isUserOnline = true;
            if (currentUser) {
                updateUserOnline();
                updateAllStatuses();
            }
        });
        
        window.addEventListener('offline', () => {
            isUserOnline = false;
            updateAllStatuses();
        });
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
                updateUserOnline();
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

    function showChats() {
        elements.loginScreen.style.display = 'none';
        elements.chatsScreen.style.display = 'flex';
        elements.chatScreen.style.display = 'none';
        closeAllModals();
        hideSideMenu();
        elements.chatsTitle.textContent = 'Чаты (' + currentUser.username + ')';
        loadChats();
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

        elements.searchUsername.addEventListener('input', (e) => {
            if (e.target.value.trim().length > 1) {
                handleSearch();
            } else {
                elements.searchResults.innerHTML = '';
            }
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

    async function updateUserOnline() {
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
        } catch (error) {
            console.error('Ошибка обновления онлайн:', error);
        }
    }

    async function setUserOffline() {
        try {
            await supabase
                .from('users')
                .update({
                    is_online: false,
                    last_seen: new Date().toISOString()
                })
                .eq('username', currentUser.username);
        } catch (error) {
            console.error('Ошибка установки оффлайн:', error);
        }
    }

    function setupSubscriptions() {
        if (userStatusSubscription) {
            supabase.removeChannel(userStatusSubscription);
        }

        userStatusSubscription = supabase
            .channel('online_status')
            .on('postgres_changes', 
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'users'
                }, 
                (payload) => {
                    const user = payload.new;
                    if (user.username !== currentUser.username) {
                        onlineUsers.set(user.username, user.is_online);
                        lastSeenTimes.set(user.username, user.last_seen);
                        updateAllStatuses();
                    }
                }
            )
            .subscribe();

        if (messagesSubscription) {
            supabase.removeChannel(messagesSubscription);
        }

        messagesSubscription = supabase
            .channel('new_messages')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'private_messages',
                    filter: `receiver=eq.${currentUser.username}`
                }, 
                (payload) => {
                    const message = payload.new;
                    if (currentChatWith === message.sender) {
                        addMessageToDisplay(message, false);
                        markChatAsRead(message.sender);
                    } else {
                        const count = unreadMessages.get(message.sender) || 0;
                        unreadMessages.set(message.sender, count + 1);
                        updateUnreadNotifications();
                        loadChats();
                    }
                }
            )
            .subscribe();

        startOnlineCheck();
    }

    function startOnlineCheck() {
        if (onlineCheckInterval) clearInterval(onlineCheckInterval);
        
        onlineCheckInterval = setInterval(async () => {
            if (!currentUser) return;
            
            await updateUserOnline();
            await checkAllOnlineStatuses();
        }, 15000);
    }

    async function checkAllOnlineStatuses() {
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
                .select('username, is_online, last_seen')
                .in('username', usernamesArray);

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

    function updateChatStatus() {
        if (!currentChatWith || !elements.chatStatus) return;
        
        const isUserOnline = onlineUsers.get(currentChatWith);
        if (isUserOnline === true) {
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
            const { data: messages } = await supabase
                .from('private_messages')
                .select('*')
                .or(`sender.eq.${currentUser.username},receiver.eq.${currentUser.username}`)
                .order('created_at', { ascending: false })
                .limit(100);

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
            
            await checkAllOnlineStatuses();
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
            const unreadCount = unreadMessages.get(chat.username) || 0;
            const isUserOnline = onlineUsers.get(chat.username) === true;
            
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
                            ${isUserOnline ? 'на связи' : 'без связи'}
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
            
            const { data: messages } = await supabase
                .from('private_messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true })
                .limit(200);
            
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
            
            const { data } = await supabase
                .from('private_messages')
                .insert({
                    chat_id: chatId,
                    sender: currentUser.username,
                    receiver: currentChatWith,
                    message: message,
                    read: false
                })
                .select();
            
            elements.messageInput.value = '';
            
            if (data && data[0]) {
                addMessageToDisplay(data[0], true);
                loadChats();
            }
            
        } catch (error) {
            console.error('Ошибка отправки:', error);
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
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .maybeSingle();

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
                    last_seen: new Date().toISOString()
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
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('username', newUsername)
                .maybeSingle();

            if (existingUser) {
                showError(elements.editUsernameError, 'Этот никнейм уже используется');
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
            elements.chatsTitle.textContent = 'Чаты (' + newUsername + ')';
            
            await updateUserOnline();
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
                .select('username, is_online')
                .ilike('username', `%${searchTerm}%`)
                .neq('username', currentUser.username)
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
            div.onclick = () => {
                hideModal('findFriendsModal');
                showChat(user.username);
            };
            
            const isUserOnline = user.is_online === true;
            
            div.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar ${isUserOnline ? 'online' : ''}">${getAvatarLetter(user.username)}</div>
                    <div>
                        <div class="user-result-name">${escapeHtml(user.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">
                            ${isUserOnline ? 'на связи' : 'без связи'}
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
                const isUserOnline = onlineUsers.get(username) === true;
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
            
            const isUserOnline = onlineUsers.get(contact.username) === true;
            
            div.innerHTML = `
                <div class="contact-info">
                    <div class="contact-avatar ${isUserOnline ? 'online' : ''}">${getAvatarLetter(contact.username)}</div>
                    <div>
                        <div class="contact-name">${escapeHtml(contact.username)}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 12px;">
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
                const isUserOnline = onlineUsers.get(username) === true;
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
            await setUserOffline();
            localStorage.removeItem('speednexus_user');
            
            cleanupSubscriptions();
            
            currentUser = null;
            showLogin();
            elements.loginUsername.value = '';
        }
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
                const isUserOnline = onlineUsers.get(username) === true;
                
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
