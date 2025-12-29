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
    menuBtn: document.getElementById('menuBtn'),
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
    privateChatModal: document.getElementById('privateChatModal'),
    privateChatTitle: document.getElementById('privateChatTitle'),
    privateMessages: document.getElementById('privateMessages'),
    privateText: document.getElementById('privateText'),
    sendPrivate: document.getElementById('sendPrivate'),
    chatTitle: document.getElementById('chatTitle'),
    backFromPrivate: document.getElementById('backFromPrivate'),
    restoreSection: document.getElementById('restoreSection'),
    restoreAccountBtn: document.getElementById('restoreAccountBtn')
  };

  let currentUser = null;
  let lastId = null;
  let currentPrivateChat = null;
  let userDeviceId = null;
  let archivedUser = null;

  function init() {
    console.log('Инициализация...');
    console.log('Кнопка archiveAccountBtn:', elements.archiveAccountBtn);
    
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
          is_online: true,
          deleted: false
        });
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
    }
  }

  function showLogin() {
    elements.loginScreen.style.display = 'flex';
    elements.chatContainer.style.display = 'none';
    elements.sideMenu.style.display = 'none';
    closeAllModals();
    
    const hasArchived = localStorage.getItem('speednexus_archived_user');
    if (hasArchived) {
      elements.restoreSection.style.display = 'block';
    } else {
      elements.restoreSection.style.display = 'none';
    }
    
    elements.loginUsername.focus();
  }

  function showChat() {
    elements.loginScreen.style.display = 'none';
    elements.chatContainer.style.display = 'flex';
    closeAllModals();
    loadMessages();
    elements.textInput.focus();
  }

  function toggleMenu() {
    elements.sideMenu.classList.toggle('show');
  }

  function updateUserDisplay() {
    if (currentUser) {
      elements.currentUsernameDisplay.textContent = currentUser.username;
      elements.chatTitle.textContent = currentUser.username;
    }
  }

  function setupEventListeners() {
    console.log('Настройка обработчиков...');
    
    elements.loginButton.onclick = handleLogin;
    elements.loginUsername.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    if (elements.restoreAccountBtn) {
      elements.restoreAccountBtn.onclick = handleRestoreAccount;
    }

    elements.menuBtn.onclick = toggleMenu;
    elements.closeMenu.onclick = toggleMenu;

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
      console.log('Кнопка удаления найдена, добавляем обработчик');
      elements.archiveAccountBtn.onclick = handleArchiveAccount;
    } else {
      console.error('Кнопка удаления НЕ найдена!');
    }

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

    elements.backFromPrivate.onclick = () => hideModal('privateChatModal');
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
        showChat();
        updateUserDisplay();
        alert('Аккаунт восстановлен!');
      } else if (existingUser && !existingUser.deleted) {
        alert('Этот аккаунт уже активен. Используйте другой ник.');
      }
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      alert('Ошибка восстановления аккаунта');
    }
  }

  async function handleArchiveAccount() {
    console.log('Функция handleArchiveAccount вызвана');
    if (!currentUser) {
      console.log('Нет currentUser');
      return;
    }
    
    if (!confirm('Скрыть аккаунт? Вы сможете восстановить его позже.')) {
      console.log('Пользователь отменил');
      return;
    }
    
    console.log('Начинаем архивацию для пользователя:', currentUser.username);
    
    try {
      const result = await supabase
        .from('users')
        .update({
          deleted: true,
          deleted_at: new Date().toISOString(),
          is_online: false
        })
        .eq('username', currentUser.username);
      
      console.log('Результат обновления в базе:', result);
      
      localStorage.setItem('speednexus_archived_user', JSON.stringify(currentUser));
      localStorage.removeItem('speednexus_user');
      localStorage.removeItem('speednexus_contacts');
      
      currentUser = null;
      showLogin();
      alert('Аккаунт скрыт. Для восстановления нажмите кнопку "Восстановить скрытый аккаунт"');
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

      showChat();
      updateUserDisplay();
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
          <div class="user-result-name">${user.username}</div>
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
        openPrivateChat(username);
      };
    });
  }

  function openPrivateChat(username) {
    currentPrivateChat = username;
    elements.privateChatTitle.textContent = username;
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
    elements.sideMenu.classList.remove('show');
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
