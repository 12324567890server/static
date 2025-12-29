(function() {
    const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
    const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";
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
        restoreAccountBtn: document.getElementById('restoreAccountBtn'),
        notification: document.getElementById('notification')
    };

    let currentUser = null;
    let userDeviceId = null;
    let currentChatWith = null;
    let chats = [];
    let unreadMessages = new Map();
    let onlineUsers = new Set();
    let messageReadStatus = new Map();
    let lastOnlineCheck = 0;
    let lastMessagesCheck = 0;
    let activeIntervals = [];
    let chatMessagesCache = new Map();
    let onlineStatusCache = new Map();
    let isTyping = false;

    function init() {
        checkUser();
        setupEventListeners();
        
        userDeviceId = localStorage.getItem('device_id');
        if (!userDeviceId) {
            userDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_id', userDeviceId);
        }
    }

    function cleanup() {
        activeIntervals.forEach(interval => clearInterval(interval));
        activeIntervals = [];
    }

    function checkUser() {
        const savedUser = localStorage.getItem('speednexus_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                showChats();
                updateUserDisplay();
                startSync();
            } catch (e) {
                localStorage.removeItem('speednexus_user');
                showLogin();
            }
        } else {
            showLogin();
        }
    }

    function startSync() {
        cleanup();
        
        syncUserOnlineStatus();
        
        activeIntervals.push(
            setInterval(syncUserOnlineStatus, 5000)
        );
        
        activeIntervals.push(
            setInterval(checkOnlineStatuses, 500)
        );
        
        activeIntervals.push(
            setInterval(checkNewMessages, 1000)
        );
        
        loadChats();
    }

    async function syncUserOnlineStatus() {
        if (!currentUser) return;
        
        try {
            await supabase
                .from('users')
                .upsert({
                    username: currentUser.username,
                    last_seen: new Date().toISOString(),
                    device_id: userDeviceId,
                    is_online: true,
                    deleted: false
                });
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
        }
    }

    async function checkOnlineStatuses() {
        if (!currentUser || Date.now() - lastOnlineCheck < 500) return;
        lastOnlineCheck = Date.now();
        
        try {
            const cacheKey = 'online_status_' + Date.now();
            if (onlineStatusCache.has(cacheKey)) {
                updateOnlineUsers(onlineStatusCache.get(cacheKey));
                return;
            }

            const { data: users } = await supabase
                .from('users')
                .select('username, is_online')
                .eq('deleted', false)
                .limit(50);

            if (users) {
                onlineStatusCache.set(cacheKey, users);
                setTimeout(() => onlineStatusCache.delete(cacheKey), 1000);
                updateOnlineUsers(users);
            }
        } catch (error) {
            console.error('Ошибка проверки онлайн:', error);
        }
    }

    function updateOnlineUsers(users) {
        const newOnlineUsers = new Set();
        users.forEach(user => {
            if (user.is_online && user.username !== currentUser.username) {
                newOnlineUsers.add(user.username);
            }
        });
        
        if (onlineUsers.size !== newOnlineUsers.size || 
            [...onlineUsers].some(user => !newOnlineUsers.has(user))) {
            onlineUsers = newOnlineUsers;
            updateChatStatus();
            updateChatsList();
        }
    }

    async function checkNewMessages() {
        if (!currentUser || Date.now() - lastMessagesCheck < 1000) return;
        lastMessagesCheck = Date.now();
        
        try {
            if (currentChatWith) {
                const messages = await loadMessagesFast(currentChatWith);
                if (messages && messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.sender !== currentUser.username) {
                        markMessageAsRead(lastMessage.id);
                    }
                }
            }
            
            await updateChatsListFast();
        } catch (error) {
            console.error('Ошибка проверки сообщений:', error);
        }
    }

    async function loadMessagesFast(username) {
        if (!username) return [];
        
        const cacheKey = `messages_${username}_${currentUser.username}`;
        if (chatMessagesCache.has(cacheKey)) {
            return chatMessagesCache.get(cacheKey);
        }

        try {
            const chatId = [currentUser.username, username].sort().join('_');
            
            const { data: messages } = await supabase
                .from('private_messages')
                .select('*')
                .or(`chat_id.eq.${chatId},chat_id.eq.${username}_${currentUser.username}`)
                .order('created_at', { ascending: true });
            
            if (messages) {
                chatMessagesCache.set(cacheKey, messages);
                setTimeout(() => chatMessagesCache.delete(cacheKey), 2000);
                return messages;
            }
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
        
        return [];
    }

    async function updateChatsListFast() {
        if (!currentUser) return;
        
        try {
            const { data: messages } = await supabase
                .from('private_messages')
                .select('*')
                .or(`sender.eq.${currentUser.username},receiver.eq.${currentUser.username}`)
                .order('created_at', { ascending: false })
                .limit(100);

            if (messages) {
                const chatMap = new Map();
                const unreadCounts = new Map();
                
                messages.forEach(msg => {
                    const otherUser = msg.sender === currentUser.username ? msg.receiver : msg.sender;
                    
                    if (!chatMap.has(otherUser)) {
                        chatMap.set(otherUser, {
                            username: otherUser,
                            lastMessage: msg.message,
                            lastTime: msg.created_at,
                            isMyMessage: msg.sender === currentUser.username
                        });
                    }
                    
                    if (msg.receiver === currentUser.username && !messageReadStatus.has(msg.id)) {
                        unreadCounts.set(otherUser, (unreadCounts.get(otherUser) || 0) + 1);
                    }
                });

                unreadMessages = unreadCounts;
                chats = Array.from(chatMap.values());
                
                if (elements.chatsScreen.style.display !== 'none') {
                    displayChats(chats);
                }
            }
        } catch (error) {
            console.error('Ошибка обновления чатов:', error);
        }
    }

    async function markMessageAsRead(messageId) {
        if (messageReadStatus.has(messageId)) return;
        
        messageReadStatus.set(messageId, true);
        
        if (currentChatWith) {
            unreadMessages.delete(currentChatWith);
            updateChatsList();
        }
    }

    function showLogin() {
        cleanup();
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
        markAllChatsAsRead();
    }

    function showChat(username) {
        currentChatWith = username;
        elements.chatWithUser.textContent = username;
        elements.chatsScreen.style.display = 'none';
        elements.chatScreen.style.display = 'flex';
        closeAllModals();
        hideSideMenu();
        loadMessages(username);
        updateChatStatus();
        elements.messageInput.focus();
        
        markChatAsRead(username);
    }

    function updateUserDisplay() {
        if (currentUser) {
            elements.currentUsernameDisplay.textContent = currentUser.username;
        }
    }

    function updateChatStatus() {
        if (!currentChatWith) return;
        
        if (onlineUsers.has(currentChatWith)) {
            elements.chatStatus.textContent = 'online';
            elements.chatStatus.style.color = '#4ade80';
        } else {
            elements.chatStatus.textContent = 'был(а) недавно';
            elements.chatStatus.style.color = 'rgba(255, 255, 255, 0.7)';
        }
    }

    function setupEventListeners() {
        elements.loginButton.onclick = handleLogin;
        elements.loginUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });

        if (elements.restoreAccountBtn) {
            elements.restoreAccountBtn.onclick = handleRestoreAccount;
        }

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
            updateChatsListFast();
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

        if (elements.archiveAccountBtn) {
            elements.archiveAccountBtn.onclick = handleArchiveAccount;
        }

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

    async function loadChats() {
        if (!currentUser) return;
        await updateChatsListFast();
    }

    function displayChats(chatList) {
        if (!elements.chatsList) return;
        
        elements.chatsList.innerHTML = '';
        
        if (chatList.length === 0) {
            elements.chatsList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px;">Нет чатов. Нажмите "+" чтобы начать новый чат.</div>';
            return;
        }

        chatList.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

        chatList.forEach(chat => {
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.onclick = () => showChat(chat.username);
            
            const date = new Date(chat.lastTime);
            const time = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const unreadCount = unreadMessages.get(chat.username) || 0;
            
            let lastMessagePrefix = chat.isMyMessage ? 'Вы: ' : '';
            let lastMessage = chat.lastMessage || '';
            if (lastMessage.length > 30) {
                lastMessage = lastMessage.substring(0, 30) + '...';
            }
            
            div.innerHTML = `
                <div class="chat-avatar">👤</div>
                <div class="chat-info">
                    <div class="chat-name">
                        ${chat.username}
                        ${onlineUsers.has(chat.username) ? '<span class="status-indicator online" style="margin-left: 5px;"></span>' : ''}
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
            const messages = await loadMessagesFast(username);
            displayMessages(messages);
            
            if (messages) {
                messages.forEach(msg => {
                    if (msg.receiver === currentUser.username) {
                        messageReadStatus.set(msg.id, true);
                    }
                });
            }
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
    }

    function displayMessages(messages) {
        if (!elements.privateMessages) return;
        
        elements.privateMessages.innerHTML = '';
        
        messages.forEach(msg => {
            const div = document.createElement('div');
            const isMyMessage = msg.sender === currentUser.username;
            div.className = `message ${isMyMessage ? 'me' : 'other'}`;
            
            const date = new Date(msg.created_at);
            const time = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const status = isMyMessage ? getMessageStatus(msg) : '';
            
            div.innerHTML = `
                <div class="text">${msg.message}</div>
                <div class="time">
                    ${time}
                    ${status}
                </div>
            `;
            
            elements.privateMessages.appendChild(div);
        });
        
        setTimeout(() => {
            if (elements.privateMessages) {
                elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
            }
        }, 50);
    }

    function getMessageStatus(msg) {
        const now = new Date();
        const msgTime = new Date(msg.created_at);
        const diff = now - msgTime;
        
        if (diff < 1000) {
            return '<span class="message-status sent">✓</span>';
        } else if (diff < 5000) {
            return '<span class="message-status delivered">✓✓</span>';
        } else {
            return '<span class="message-status read">✓✓</span>';
        }
    }

    async function handleSendMessage() {
        if (!currentChatWith || !currentUser) return;
        
        const message = elements.messageInput.value.trim();
        if (!message) return;
        
        try {
            const chatId = [currentUser.username, currentChatWith].sort().join('_');
            
            const { data, error } = await supabase
                .from('private_messages')
                .insert({
                    chat_id: chatId,
                    sender: currentUser.username,
                    receiver: currentChatWith,
                    message: message
                })
                .select();
            
            if (error) throw error;
            
            elements.messageInput.value = '';
            chatMessagesCache.clear();
            
            await loadMessages(currentChatWith);
            await updateChatsListFast();
            
        } catch (error) {
            console.error('Ошибка отправки:', error);
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
                .eq('deleted', false)
                .single();

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

    function markChatAsRead(username) {
        unreadMessages.delete(username);
        updateChatsList();
    }

    function markAllChatsAsRead() {
        unreadMessages.clear();
        updateChatsList();
    }

    async function updateChatsList() {
        await updateChatsListFast();
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
                .single();

            if (existingUser && existingUser.deleted) {
                await supabase
                    .from('users')
                    .update({
                        deleted: false,
                        deleted_at: null,
                        is_online: true,
                        last_seen: new Date().toISOString()
                    })
                    .eq('username', user.username);

                localStorage.setItem('speednexus_user', archived);
                localStorage.removeItem('speednexus_archived_user');
                
                currentUser = user;
                showChats();
                updateUserDisplay();
                startSync();
            } else if (existingUser && !existingUser.deleted) {
                alert('Этот аккаунт уже активен. Используйте другой ник.');
            }
        } catch (error) {
            console.error('Ошибка восстановления:', error);
            alert('Ошибка восстановления аккаунта');
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
            cleanup();
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
                .single();

            if (existingUser) {
                if (existingUser.deleted) {
                    if (confirm('Этот аккаунт был скрыт. Восстановить его?')) {
                        await supabase
                            .from('users')
                            .update({
                                deleted: false,
                                deleted_at: null,
                                is_online: true,
                                last_seen: new Date().toISOString()
                            })
                            .eq('username', username);
                    } else {
                        showError(elements.loginError, 'Этот никнейм занят (скрыт)');
                        return;
                    }
                } else if (existingUser.device_id !== userDeviceId) {
                    showError(elements.loginError, 'Этот никнейм уже используется');
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
                });

            showChats();
            updateUserDisplay();
            startSync();
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            showError(elements.loginError, 'Ошибка регистрации');
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
                .single();

            if (existingUser && existingUser.device_id !== userDeviceId) {
                showError(elements.editUsernameError, 'Этот никнейм уже используется');
                return;
            }

            await supabase
                .from('private_messages')
                .update({ 
                    sender: newUsername 
                })
                .eq('sender', currentUser.username);

            await supabase
                .from('private_messages')
                .update({ 
                    receiver: newUsername 
                })
                .eq('receiver', currentUser.username);

            currentUser.username = newUsername;
            localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
            
            await supabase
                .from('users')
                .upsert({
                    username: newUsername,
                    device_id: userDeviceId,
                    last_seen: new Date().toISOString()
                });

            updateUserDisplay();
            hideModal('editProfileModal');
            elements.chatsTitle.textContent = 'Чаты (' + newUsername + ')';
            
            chatMessagesCache.clear();
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
            
            div.innerHTML = `
                <div class="user-result-info">
                    <div class="user-result-avatar">👤</div>
                    <div>
                        <div class="user-result-name">${user.username}</div>
                        <div style="color: rgba(255,255,255,0.5); font-size: 12px;">
                            ${user.is_online ? 'online' : 'был(а) недавно'}
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
                    <div class="contact-avatar">👤</div>
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

    function handleLogout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            localStorage.removeItem('speednexus_user');
            currentUser = null;
            cleanup();
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
