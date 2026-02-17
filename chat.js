const firebaseConfig = {
    apiKey: "AIzaSyBek2UzUYyBek2UzUYyBek2UzUYyBek2UzU",
    authDomain: "speednexus.firebaseapp.com",
    projectId: "speednexus",
    storageBucket: "speednexus.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let currentChatUser = null;
let unsubscribeMessages = null;
let unsubscribeStatus = null;
let typingTimeout = null;

const loginScreen = document.getElementById('loginScreen');
const chatsScreen = document.getElementById('chatsScreen');
const chatScreen = document.getElementById('chatScreen');
const sideMenu = document.getElementById('sideMenu');
const loginBtn = document.getElementById('loginButton');
const loginUsername = document.getElementById('loginUsername');
const loginError = document.getElementById('loginError');
const chatsList = document.getElementById('chatsList');
const privateMessages = document.getElementById('privateMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendMessageBtn');
const backToChats = document.getElementById('backToChats');
const chatWithUser = document.getElementById('chatWithUser');
const chatStatus = document.getElementById('chatStatus');
const currentUsernameDisplay = document.getElementById('currentUsernameDisplay');
const userStatusDisplay = document.getElementById('userStatusDisplay');
const userAvatar = document.getElementById('userAvatar');
const chatsMenuBtn = document.getElementById('chatsMenuBtn');
const closeMenu = document.getElementById('closeMenu');
const editProfileBtn = document.getElementById('editProfileBtn');
const findFriendsMenuBtn = document.getElementById('findFriendsMenuBtn');
const contactsBtn = document.getElementById('contactsBtn');
const logoutBtn = document.getElementById('logoutBtn');
const findFriendsBtn = document.getElementById('findFriendsBtn');
const searchChats = document.getElementById('searchChats');

const editProfileModal = document.getElementById('editProfileModal');
const findFriendsModal = document.getElementById('findFriendsModal');
const contactsModal = document.getElementById('contactsModal');
const searchUsersInput = document.getElementById('searchUsersInput');
const searchUsersResults = document.getElementById('searchUsersResults');
const contactsList = document.getElementById('contactsList');
const editUsername = document.getElementById('editUsername');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const editUsernameError = document.getElementById('editUsernameError');
const loadingOverlay = document.getElementById('loadingOverlay');

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        document.getElementById(modalId).classList.remove('active');
    });
});

loginBtn.addEventListener('click', async () => {
    const username = loginUsername.value.trim();
    if (!username) {
        showError(loginError, 'Введите никнейм');
        return;
    }
    
    if (!/^[A-Za-z0-9_]+$/.test(username)) {
        showError(loginError, 'Только буквы, цифры и _');
        return;
    }
    
    showLoading(true);
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username).get();
        
        if (snapshot.empty) {
            const userRef = await usersRef.add({
                username: username,
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            currentUser = {
                id: userRef.id,
                username: username
            };
        } else {
            const userDoc = snapshot.docs[0];
            currentUser = {
                id: userDoc.id,
                username: userDoc.data().username
            };
            await userDoc.ref.update({
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserStatus(currentUser.id, true);
        
        loginScreen.style.display = 'none';
        chatsScreen.style.display = 'flex';
        
        currentUsernameDisplay.textContent = currentUser.username;
        userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
        
        loadChats();
        setupStatusListener(currentUser.id);
        
    } catch (error) {
        showError(loginError, 'Ошибка входа');
        console.error(error);
    } finally {
        showLoading(false);
    }
});

chatsMenuBtn.addEventListener('click', () => {
    sideMenu.style.display = 'block';
    setTimeout(() => sideMenu.classList.add('show'), 10);
});

closeMenu.addEventListener('click', () => {
    sideMenu.classList.remove('show');
    setTimeout(() => sideMenu.style.display = 'none', 300);
});

findFriendsBtn.addEventListener('click', () => {
    findFriendsModal.classList.add('active');
    searchUsersInput.value = '';
    searchUsersResults.innerHTML = '';
    searchUsersInput.focus();
});

findFriendsMenuBtn.addEventListener('click', () => {
    sideMenu.classList.remove('show');
    setTimeout(() => sideMenu.style.display = 'none', 300);
    findFriendsModal.classList.add('active');
    searchUsersInput.value = '';
    searchUsersResults.innerHTML = '';
    searchUsersInput.focus();
});

searchUsersInput.addEventListener('input', debounce(async (e) => {
    const searchText = e.target.value.trim().toLowerCase();
    if (searchText.length < 1) {
        searchUsersResults.innerHTML = '';
        return;
    }
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        
        const users = [];
        snapshot.forEach(doc => {
            const user = doc.data();
            if (doc.id !== currentUser.id && user.username.toLowerCase().includes(searchText)) {
                users.push({
                    id: doc.id,
                    username: user.username,
                    online: user.online || false,
                    lastSeen: user.lastSeen
                });
            }
        });
        
        users.sort((a, b) => a.username.localeCompare(b.username));
        
        if (users.length === 0) {
            searchUsersResults.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Ничего не найдено</div>';
            return;
        }
        
        searchUsersResults.innerHTML = users.map(user => `
            <div class="user-result" onclick="startChatWith('${user.id}', '${user.username}')">
                <div class="user-result-info">
                    <div class="user-result-avatar ${user.online ? 'online' : ''}">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <span class="user-result-name">${user.username}</span>
                </div>
                <span style="color:#999; font-size:12px;">${user.online ? 'онлайн' : getLastSeenText(user.lastSeen)}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Search error:', error);
    }
}, 300));

window.startChatWith = (userId, username) => {
    findFriendsModal.classList.remove('active');
    openChatWith(userId, username);
};

editProfileBtn.addEventListener('click', () => {
    sideMenu.classList.remove('show');
    setTimeout(() => sideMenu.style.display = 'none', 300);
    editUsername.value = currentUser.username;
    editProfileModal.classList.add('active');
});

saveProfileBtn.addEventListener('click', async () => {
    const newUsername = editUsername.value.trim();
    if (!newUsername) {
        showError(editUsernameError, 'Введите никнейм');
        return;
    }
    
    if (!/^[A-Za-z0-9_]+$/.test(newUsername)) {
        showError(editUsernameError, 'Только буквы, цифры и _');
        return;
    }
    
    showLoading(true);
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', newUsername).get();
        
        if (!snapshot.empty && snapshot.docs[0].id !== currentUser.id) {
            showError(editUsernameError, 'Никнейм занят');
            showLoading(false);
            return;
        }
        
        await db.collection('users').doc(currentUser.id).update({
            username: newUsername
        });
        
        currentUser.username = newUsername;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        currentUsernameDisplay.textContent = newUsername;
        userAvatar.textContent = newUsername.charAt(0).toUpperCase();
        
        editProfileModal.classList.remove('active');
        loadChats();
        
    } catch (error) {
        showError(editUsernameError, 'Ошибка сохранения');
    } finally {
        showLoading(false);
    }
});

contactsBtn.addEventListener('click', async () => {
    sideMenu.classList.remove('show');
    setTimeout(() => sideMenu.style.display = 'none', 300);
    
    showLoading(true);
    
    try {
        const messagesRef = db.collection('messages');
        const sentSnapshot = await messagesRef
            .where('from', '==', currentUser.id)
            .get();
        const receivedSnapshot = await messagesRef
            .where('to', '==', currentUser.id)
            .get();
        
        const contactIds = new Set();
        sentSnapshot.forEach(doc => contactIds.add(doc.data().to));
        receivedSnapshot.forEach(doc => contactIds.add(doc.data().from));
        contactIds.delete(currentUser.id);
        
        if (contactIds.size === 0) {
            contactsList.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Нет контактов</div>';
            contactsModal.classList.add('active');
            showLoading(false);
            return;
        }
        
        const contacts = [];
        for (const id of contactIds) {
            const userDoc = await db.collection('users').doc(id).get();
            if (userDoc.exists) {
                contacts.push({
                    id: userDoc.id,
                    ...userDoc.data()
                });
            }
        }
        
        contacts.sort((a, b) => a.username.localeCompare(b.username));
        
        contactsList.innerHTML = contacts.map(contact => `
            <div class="contact-item" onclick="openChatWith('${contact.id}', '${contact.username}')">
                <div class="contact-avatar ${contact.online ? 'online' : ''}">
                    ${contact.username.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1;">
                    <div class="contact-name">${contact.username}</div>
                    <div style="color:#999; font-size:12px;">${contact.online ? 'онлайн' : getLastSeenText(contact.lastSeen)}</div>
                </div>
            </div>
        `).join('');
        
        contactsModal.classList.add('active');
        
    } catch (error) {
        console.error('Contacts error:', error);
    } finally {
        showLoading(false);
    }
});

logoutBtn.addEventListener('click', async () => {
    if (currentUser) {
        await db.collection('users').doc(currentUser.id).update({
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        updateUserStatus(currentUser.id, false);
        localStorage.removeItem('currentUser');
    }
    
    sideMenu.classList.remove('show');
    setTimeout(() => sideMenu.style.display = 'none', 300);
    chatScreen.style.display = 'none';
    chatsScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    loginUsername.value = '';
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    if (unsubscribeStatus) {
        unsubscribeStatus();
        unsubscribeStatus = null;
    }
});

backToChats.addEventListener('click', () => {
    chatScreen.style.display = 'none';
    chatsScreen.style.display = 'flex';
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    if (unsubscribeStatus) {
        unsubscribeStatus();
        unsubscribeStatus = null;
    }
    
    loadChats();
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    if (!currentChatUser) return;
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    db.collection('typing').doc(`${currentUser.id}_${currentChatUser.id}`).set({
        userId: currentUser.id,
        chatWith: currentChatUser.id,
        typing: true,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    typingTimeout = setTimeout(() => {
        db.collection('typing').doc(`${currentUser.id}_${currentChatUser.id}`).delete();
    }, 2000);
});

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChatUser) return;
    
    messageInput.value = '';
    
    try {
        await db.collection('messages').add({
            from: currentUser.id,
            to: currentChatUser.id,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            db.collection('typing').doc(`${currentUser.id}_${currentChatUser.id}`).delete();
        }
        
    } catch (error) {
        console.error('Send error:', error);
    }
}

function openChatWith(userId, username) {
    chatsScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    
    currentChatUser = { id: userId, username: username };
    chatWithUser.textContent = username;
    
    privateMessages.innerHTML = '';
    
    setupTypingListener(userId);
    setupMessagesListener(userId);
    setupChatStatusListener(userId);
    markMessagesAsRead(userId);
}

function setupMessagesListener(userId) {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    
    unsubscribeMessages = db.collection('messages')
        .where('from', 'in', [currentUser.id, userId])
        .where('to', 'in', [currentUser.id, userId])
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    displayMessage(message, change.doc.id);
                }
            });
            
            markMessagesAsRead(userId);
            scrollToBottom();
        });
}

function setupChatStatusListener(userId) {
    if (unsubscribeStatus) {
        unsubscribeStatus();
    }
    
    unsubscribeStatus = db.collection('users').doc(userId)
        .onSnapshot(doc => {
            if (doc.exists) {
                const user = doc.data();
                if (user.online) {
                    chatStatus.textContent = 'онлайн';
                } else {
                    chatStatus.textContent = getLastSeenText(user.lastSeen);
                }
            }
        });
}

function setupTypingListener(userId) {
    db.collection('typing')
        .where('userId', '==', userId)
        .where('chatWith', '==', currentUser.id)
        .onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const typingData = snapshot.docs[0]?.data();
                if (typingData?.typing) {
                    chatStatus.innerHTML = '<span class="typing-animation-small">печатает<span>.</span><span>.</span><span>.</span></span>';
                } else {
                    db.collection('users').doc(userId).get().then(doc => {
                        if (doc.exists) {
                            const user = doc.data();
                            chatStatus.textContent = user.online ? 'онлайн' : getLastSeenText(user.lastSeen);
                        }
                    });
                }
            }
        });
}

function displayMessage(message, messageId) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.from === currentUser.id ? 'me' : 'other'}`;
    messageDiv.dataset.messageId = messageId;
    
    const time = message.timestamp?.toDate() || new Date();
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="text">${escapeHtml(message.text)}</div>
            <div class="time">${timeStr}</div>
        </div>
    `;
    
    privateMessages.appendChild(messageDiv);
}

async function markMessagesAsRead(userId) {
    const messagesRef = db.collection('messages');
    const snapshot = await messagesRef
        .where('from', '==', userId)
        .where('to', '==', currentUser.id)
        .where('read', '==', false)
        .get();
    
    const batch = db.batch();
    snapshot.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
}

async function loadChats() {
    const messagesRef = db.collection('messages');
    const sentSnapshot = await messagesRef
        .where('from', '==', currentUser.id)
        .orderBy('timestamp', 'desc')
        .get();
    const receivedSnapshot = await messagesRef
        .where('to', '==', currentUser.id)
        .orderBy('timestamp', 'desc')
        .get();
    
    const chatMap = new Map();
    
    sentSnapshot.forEach(doc => {
        const data = doc.data();
        const otherUserId = data.to;
        if (!chatMap.has(otherUserId) || chatMap.get(otherUserId).timestamp < data.timestamp) {
            chatMap.set(otherUserId, {
                message: data.text,
                timestamp: data.timestamp,
                fromMe: true,
                read: data.read
            });
        }
    });
    
    receivedSnapshot.forEach(doc => {
        const data = doc.data();
        const otherUserId = data.from;
        if (!chatMap.has(otherUserId) || chatMap.get(otherUserId).timestamp < data.timestamp) {
            chatMap.set(otherUserId, {
                message: data.text,
                timestamp: data.timestamp,
                fromMe: false,
                read: data.read
            });
        }
    });
    
    if (chatMap.size === 0) {
        chatsList.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Нет чатов</div>';
        return;
    }
    
    const chats = [];
    for (const [userId, lastMessage] of chatMap) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            chats.push({
                userId,
                username: userDoc.data().username,
                online: userDoc.data().online || false,
                lastSeen: userDoc.data().lastSeen,
                lastMessage: lastMessage.message,
                lastMessageTime: lastMessage.timestamp,
                fromMe: lastMessage.fromMe,
                unread: !lastMessage.fromMe && !lastMessage.read
            });
        }
    }
    
    chats.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.toDate() - a.lastMessageTime.toDate();
    });
    
    chatsList.innerHTML = chats.map(chat => `
        <div class="chat-item" onclick="openChatWith('${chat.userId}', '${chat.username}')">
            <div class="chat-avatar ${chat.online ? 'online' : ''}">
                ${chat.username.charAt(0).toUpperCase()}
            </div>
            <div class="chat-info">
                <div class="chat-name">
                    ${chat.username}
                    <span class="chat-status-text ${chat.online ? 'online' : ''}">
                        ${chat.online ? 'онлайн' : ''}
                    </span>
                </div>
                <div class="chat-last-message">
                    ${chat.fromMe ? 'Вы: ' : ''}${escapeHtml(chat.lastMessage || '')}
                </div>
                <div class="chat-time">
                    ${chat.lastMessageTime ? formatTime(chat.lastMessageTime.toDate()) : ''}
                </div>
            </div>
            ${chat.unread ? '<div class="unread-badge">1</div>' : ''}
        </div>
    `).join('');
}

function setupStatusListener(userId) {
    db.collection('users').doc(userId).onSnapshot(doc => {
        if (doc.exists) {
            const user = doc.data();
            userStatusDisplay.textContent = user.online ? 'в сети' : 'не в сети';
        }
    });
}

function updateUserStatus(userId, online) {
    fetch('https://status.speednexus.com', {
        method: 'POST',
        body: JSON.stringify({ userId, online })
    }).catch(() => {});
}

function getLastSeenText(timestamp) {
    if (!timestamp) return 'давно';
    
    const lastSeen = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} дн назад`;
    return lastSeen.toLocaleDateString();
}

function formatTime(date) {
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);
    
    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'вчера';
    } else {
        return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    privateMessages.scrollTop = privateMessages.scrollHeight;
}

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
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

window.openChatWith = openChatWith;

(async () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            const userDoc = await db.collection('users').doc(currentUser.id).get();
            if (userDoc.exists) {
                await userDoc.ref.update({
                    online: true,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
                currentUsernameDisplay.textContent = currentUser.username;
                userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
                loginScreen.style.display = 'none';
                chatsScreen.style.display = 'flex';
                loadChats();
                setupStatusListener(currentUser.id);
            } else {
                localStorage.removeItem('currentUser');
            }
        } catch (error) {
            localStorage.removeItem('currentUser');
        }
    }
})();
