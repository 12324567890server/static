(function() {
  const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const elements = {
    loginScreen: document.getElementById('loginScreen'),
    chatContainer: document.querySelector('.chat-container'),
    messagesDiv: document.getElementById('messages'),
    textInput: document.getElementById('text'),
    sendBtn: document.getElementById('send'),
    loginUsername: document.getElementById('loginUsername'),
    loginButton: document.getElementById('loginButton'),
    loginError: document.getElementById('loginError'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsMenu: document.getElementById('settingsMenu'),
    backToChat: document.getElementById('backToChat'),
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
    privateChatModal: document.getElementById('privateChatModal'),
    privateChatTitle: document.getElementById('privateChatTitle'),
    privateMessages: document.getElementById('privateMessages'),
    privateText: document.getElementById('privateText'),
    sendPrivate: document.getElementById('sendPrivate'),
    chatTitle: document.getElementById('chatTitle')
  };

  let currentUser = null;
  let lastId = null;
  let currentPrivateChat = null;
  let userDeviceId = null;

  function init() {
    checkUser();
    setupEventListeners();
    
    userDeviceId = localStorage.getItem('device_id');
    if (!userDeviceId) {
      userDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', userDeviceId);
    }
  }

  function checkUser() {
    const savedUser = localStorage.getItem('speednexus_user');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        showChat();
        updateUserDisplay();
        syncUserOnlineStatus();
      } catch (e) {
        localStorage.removeItem('speednexus_user');
        showLogin();
      }
    } else {
      showLogin();
    }
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
          is_online: true
        });
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
    }
  }

  function showLogin() {
    elements.loginScreen.style.display = 'flex';
    elements.chatContainer.style.display = 'none';
    elements.settingsMenu.style.display = 'none';
    elements.loginUsername.focus();
  }

  function showChat() {
    elements.loginScreen.style.display = 'none';
    elements.chatContainer.style.display = 'flex';
    elements.settingsMenu.style.display = 'none';
    closeAllModals();
    loadMessages();
    elements.textInput.focus();
  }

  function showSettingsMenu() {
    elements.settingsMenu.style.display = 'flex';
    updateUserDisplay();
    loadContacts();
  }

  function updateUserDisplay() {
    if (currentUser) {
      elements.currentUsernameDisplay.textContent = currentUser.username;
      elements.chatTitle.textContent = `SpeedNexus (${currentUser.username})`;
    }
  }
  
  function setupEventListeners() {
    
    elements.loginButton.onclick = handleLogin;
    elements.loginUsername.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    
    elements.settingsBtn.onclick = showSettingsMenu;
    elements.backToChat.onclick = showChat;

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

    elements.logoutBtn.onclick = handleLogout;
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

    elements.sendBtn.onclick = handleSendMessage;
    elements.textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    elements.sendPrivate.onclick = handleSendPrivateMessage;
    elements.privateText.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendPrivateMessage();
      }
    });
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

      if (existingUser && existingUser.device_id !== userDeviceId) {
        showError(elements.loginError, 'Этот никнейм уже используется другим устройством');
        return;
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
          is_online: true
        });

      showChat();
      updateUserDisplay();
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      showError(elements.loginError, 'Ошибка регистрации. Попробуйте еще раз.');
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

      // Обновляем историю сообщений
      await supabase
        .from('messages')
        .update({ username: newUsername })
        .eq('username', currentUser.username);

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
      showSuccess('Имя успешно изменено!');
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
        .select('username, last_seen')
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
      
  
      const contacts = getContacts();
      const isContact = contacts.some(c => c.username === user.username);
      
      div.innerHTML = `
        <div class="user-result-info">
          <div class="user-result-avatar">👤</div>
          <div>
            <div class="user-result-name">${user.username}</div>
            <div style="color: rgba(255,255,255,0.5); font-size: 12px;">
              ${formatLastSeen(user.last_seen)}
            </div>
          </div>
        </div>
        <button class="add-contact-btn ${isContact ? 'added' : ''}" 
                data-username="${user.username}">
          ${isContact ? '✓ В контактах' : '+ Добавить'}
        </button>
      `;
      
      elements.searchResults.appendChild(div);
    });

    elements.searchResults.querySelectorAll('.add-contact-btn').forEach(btn => {
      btn.onclick = (e) => {
        const username = e.target.dataset.username;
        if (!e.target.classList.contains('added')) {
          addToContacts(username);
          e.target.textContent = '✓ В контактах';
          e.target.classList.add('added');
        }
      };
    });
  }
  
  function formatLastSeen(dateString) {
    if (!dateString) return 'никогда не был';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
    
    return date.toLocaleDateString();
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
      showSuccess(`${username} добавлен в контакты!`);
    }
  }

  function removeFromContacts(username) {
    const contacts = getContacts().filter(c => c.username !== username);
    saveContacts(contacts);
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
        <div class="contact-actions">
          <button class="chat-btn" data-username="${contact.username}">💬 Чат</button>
        </div>
      `;
      
      elements.contactsList.appendChild(div);
    });

    elements.contactsList.querySelectorAll('.chat-btn').forEach(btn => {
      btn.onclick = (e) => {
        const username = e.target.dataset.username;
        openPrivateChat(username);
      };
    });
  }

  function openPrivateChat(username) {
    currentPrivateChat = username;
    elements.privateChatTitle.textContent = `Чат с ${username}`;
    showModal('privateChatModal');
    loadPrivateMessages();
  }

  async function loadPrivateMessages() {
    if (!currentPrivateChat) return;
    
    const chatId = [currentUser.username, currentPrivateChat].sort().join('_');
    
    const { data: messages } = await supabase
      .from('private_messages')
      .select('*')
      .or(`chat_id.eq.${chatId},chat_id.eq.${currentPrivateChat}_${currentUser.username}`)
      .order('created_at', { ascending: true });
    
    displayPrivateMessages(messages || []);
  }

  function displayPrivateMessages(messages) {
    elements.privateMessages.innerHTML = '';
    
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message ${msg.sender === currentUser.username ? 'me' : 'other'}`;
      
      const date = new Date(msg.created_at);
      const time = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      
      div.innerHTML = `
        <div class="text">${msg.message}</div>
        <div class="time">${time}</div>
      `;
      
      elements.privateMessages.appendChild(div);
    });
    
    elements.privateMessages.scrollTop = elements.privateMessages.scrollHeight;
  }

  async function handleSendPrivateMessage() {
    if (!currentPrivateChat) return;
    
    const message = elements.privateText.value.trim();
    if (!message) return;
    
    try {
      const chatId = [currentUser.username, currentPrivateChat].sort().join('_');
      
      await supabase
        .from('private_messages')
        .insert({
          chat_id: chatId,
          sender: currentUser.username,
          receiver: currentPrivateChat,
          message: message
        });
      
      elements.privateText.value = '';
      loadPrivateMessages();
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    
    if (error || !data || data.length === 0) return;
    
    const latestId = data[data.length-1].id;
    if (lastId === latestId) return;
    lastId = latestId;

    const wasBottom = elements.messagesDiv.scrollHeight - elements.messagesDiv.scrollTop - elements.messagesDiv.clientHeight < 50;
    
    if (elements.messagesDiv.children.length > 0 && data.length > elements.messagesDiv.children.length) {
      const newMessages = data.slice(elements.messagesDiv.children.length);
      newMessages.forEach(msg => addMessage(msg));
    } else {
      elements.messagesDiv.innerHTML = "";
      data.forEach(msg => addMessage(msg));
    }

    if (wasBottom) {
      setTimeout(() => elements.messagesDiv.scrollTop = elements.messagesDiv.scrollHeight, 50);
    }
  }

  function addMessage(msg) {
    const div = document.createElement("div");
    div.className = `message ${msg.username === currentUser?.username ? 'me' : 'other'}`;
    
    const date = new Date(msg.created_at);
    date.setHours(date.getHours() + 3);
    const time = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    div.innerHTML = `
      <div class="username">${msg.username || 'Аноним'}</div>
      <div class="text">${msg.text}</div>
      <div class="time">${time}</div>
    `;
    elements.messagesDiv.appendChild(div);
  }

  async function handleSendMessage() {
    if (!currentUser) {
      showLogin();
      return;
    }

    const text = elements.textInput.value.trim();
    if (!text) {
      elements.textInput.focus();
      return;
    }

    try {
      await supabase
        .from("messages")
        .insert([{ 
          username: currentUser.username, 
          text 
        }]);

      elements.textInput.value = "";
      elements.textInput.focus();
      setTimeout(() => loadMessages(), 200);
    } catch (err) {
      console.error("Ошибка отправки:", err);
    }
  }

  function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
      localStorage.removeItem('speednexus_user');
      currentUser = null;
      showLogin();
      elements.loginUsername.value = '';
    }
  }

  function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
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
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 3000);
  }

  function showSuccess(message) {
    alert(message);
  }

  init();
  
  setInterval(() => {
    if (currentUser) {
      loadMessages();
      if (currentPrivateChat) {
        loadPrivateMessages();
      }
    }
  }, 2000);

  setInterval(() => {
    if (currentUser) {
      syncUserOnlineStatus();
    }
  }, 60000);
})();
