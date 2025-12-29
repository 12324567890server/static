(function() {
  const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const authScreen = document.getElementById('authScreen');
  const chatContainer = document.querySelector('.chat-container');
  const messagesDiv = document.getElementById('messages');
  const textInput = document.getElementById('text');
  const sendBtn = document.getElementById('send');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const currentUsername = document.getElementById('currentUsername');
  const newUsernameInput = document.getElementById('newUsername');
  const changeUsernameBtn = document.getElementById('changeUsernameBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authUsernameInput = document.getElementById('authUsername');
  const authSubmit = document.getElementById('authSubmit');
  const usernameError = document.getElementById('usernameError');
  const changeUsernameError = document.getElementById('changeUsernameError');

  let lastId = null;
  let currentUser = null;

  function checkSavedUser() {
    const savedUser = localStorage.getItem('speednexus_user');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        showChat();
      } catch (e) {
        localStorage.removeItem('speednexus_user');
        showAuth();
      }
    } else {
      showAuth();
    }
  }

  function showAuth() {
    authScreen.style.display = 'flex';
    chatContainer.style.display = 'none';
    settingsModal.style.display = 'none';
    authUsernameInput.focus();
  }

  function showChat() {
    authScreen.style.display = 'none';
    chatContainer.style.display = 'flex';
    currentUsername.textContent = currentUser.username;
    textInput.focus();
    loadMessages();
  }

  authSubmit.onclick = async () => {
    const username = authUsernameInput.value.trim();
    
    if (!username) {
      showError(usernameError, 'Введите имя пользователя');
      return;
    }
    
    if (username.length < 3) {
      showError(usernameError, 'Имя должно быть не менее 3 символов');
      return;
    }
    
    if (username.length > 20) {
      showError(usernameError, 'Имя должно быть не более 20 символов');
      return;
    }
    
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(username)) {
      showError(usernameError, 'Недопустимые символы в имени');
      return;
    }
    
    currentUser = {
      username: username,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
    showChat();
  };

  authUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      authSubmit.click();
    }
  });

  async function loadMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    
    if (error || !data || data.length === 0) return;
    
    const latestId = data[data.length-1].id;
    if (lastId === latestId) return;
    lastId = latestId;

    const wasBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 50;
    
    if (messagesDiv.children.length > 0 && data.length > messagesDiv.children.length) {
      const newMessages = data.slice(messagesDiv.children.length);
      newMessages.forEach(msg => addMessage(msg));
    } else {
      messagesDiv.innerHTML = "";
      data.forEach(msg => addMessage(msg));
    }

    if (wasBottom) {
      setTimeout(() => messagesDiv.scrollTop = messagesDiv.scrollHeight, 50);
    }
  }

  function addMessage(msg) {
    const div = document.createElement("div");
    const isMyMessage = currentUser && msg.username === currentUser.username;
    div.className = `message ${isMyMessage ? 'me' : 'other'}`;
    
    const date = new Date(msg.created_at);
    date.setHours(date.getHours() + 3);
    const time = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    div.innerHTML = `
      <div class="username">${msg.username || 'Аноним'}</div>
      <div class="text">${msg.text}</div>
      <div class="time">${time}</div>
    `;
    messagesDiv.appendChild(div);
  }
  
  sendBtn.onclick = async () => {
    if (!currentUser) {
      showAuth();
      return;
    }

    const text = textInput.value.trim();
    if (!text) {
      textInput.focus();
      return;
    }

    try {
      const { error } = await supabase
        .from("messages")
        .insert([{ 
          username: currentUser.username, 
          text 
        }]);

      if (error) throw error;

      textInput.value = "";
      textInput.focus();
      
      setTimeout(() => loadMessages(), 200);
    } catch (err) {
      console.error("Ошибка отправки:", err);
    }
  };
  
  textInput.addEventListener("keypress", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });
  
  settingsBtn.onclick = () => {
    currentUsername.textContent = currentUser.username;
    settingsModal.style.display = 'flex';
    newUsernameInput.value = currentUser.username;
    newUsernameInput.focus();
  };

  closeSettings.onclick = () => {
    settingsModal.style.display = 'none';
  };

  window.onclick = (event) => {
    if (event.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  };
  
  changeUsernameBtn.onclick = () => {
    const newUsername = newUsernameInput.value.trim();
    
    if (!newUsername) {
      showError(changeUsernameError, 'Введите новое имя');
      return;
    }
    
    if (newUsername.length < 10) {
      showError(changeUsernameError, 'Имя должно быть не менее 10 символов');
      return;
    }
    
    if (newUsername === currentUser.username) {
      showError(changeUsernameError, 'Это текущее имя пользователя');
      return;
    }
    
    currentUser.username = newUsername;
    currentUser.updatedAt = new Date().toISOString();
    localStorage.setItem('speednexus_user', JSON.stringify(currentUser));
    currentUsername.textContent = newUsername;
    changeUsernameError.classList.remove('show');
    const originalText = changeUsernameBtn.textContent;
    changeUsernameBtn.textContent = '✓ Изменено!';
    changeUsernameBtn.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
    
    setTimeout(() => {
      changeUsernameBtn.textContent = originalText;
      changeUsernameBtn.style.background = 'linear-gradient(135deg, #7b2cff 0%, #9d4eff 100%)';
      settingsModal.style.display = 'none';
    }, 1500);
  };

  logoutBtn.onclick = () => {
    if (confirm('Вы уверены, что хотите выйти из аккаунта?')) {
      localStorage.removeItem('speednexus_user');
      currentUser = null;
      showAuth();
      authUsernameInput.value = '';
    }
  };

  newUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      changeUsernameBtn.click();
    }
  });

  function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    
    setTimeout(() => {
      element.classList.remove('show');
    }, 3000);
  }

  function init() {
    checkSavedUser();
    
    setInterval(() => {
      if (currentUser) {
        loadMessages();
      }
    }, 2500);
    
    messagesDiv.addEventListener('click', () => {
      textInput.focus();
    });
  }

  init();
})();
