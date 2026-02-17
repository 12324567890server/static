let onlineUsers = new Map();
let heartbeatInterval = null;
let usersUnsubscribe = null;

function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (window.currentUser && window.connectionId && navigator.onLine && !document.hidden) {
            updateOnlineStatus(true);
        }
    }, 5000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

async function updateOnlineStatus(isOnline) {
    if (!window.currentUser || !window.connectionId) return;
    try {
        const connectionRef = db.collection('users')
            .doc(window.currentUser.uid)
            .collection('connections')
            .doc(window.connectionId);
        await connectionRef.set({
            connection_id: window.connectionId,
            is_online: isOnline,
            last_seen: new Date().toISOString(),
            device: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        }, { merge: true });
        await updateUserStatus(window.currentUser.uid);
    } catch (e) {}
}

async function updateUserStatus(userId) {
    try {
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
        const connectionsSnapshot = await db.collection('users')
            .doc(userId)
            .collection('connections')
            .where('is_online', '==', true)
            .where('last_seen', '>', tenSecondsAgo)
            .get();
        const isOnline = !connectionsSnapshot.empty;
        await db.collection('users').doc(userId).update({
            is_online: isOnline,
            last_check: new Date().toISOString()
        });
    } catch (e) {}
}

async function cleanupOldConnections() {
    try {
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
        const connectionsSnapshot = await db.collectionGroup('connections')
            .where('last_seen', '<', tenSecondsAgo)
            .where('is_online', '==', true)
            .get();

        for (const doc of connectionsSnapshot.docs) {
            await doc.ref.update({
                is_online: false,
                last_seen: new Date().toISOString()
            });
            const userId = doc.ref.parent.parent.id;
            await updateUserStatus(userId);
        }
    } catch (e) {}
}

function updateChatStatus() {
    if (!window.currentChatUserId || !document.getElementById('chatStatus')) return;
    const user = onlineUsers.get(window.currentChatUserId);
    const isOnline = user?.is_online === true;
    const chatStatus = document.getElementById('chatStatus');
    if (isOnline) {
        chatStatus.textContent = 'на связи';
        chatStatus.style.color = '#4CAF50';
    } else {
        chatStatus.textContent = 'был(а) недавно';
        chatStatus.style.color = 'rgba(255,255,255,0.5)';
    }
}

function setupRealtimeSubscriptions() {
    if (typeof cleanupSubscriptions === 'function') cleanupSubscriptions();
    if (!window.currentUser) return;

    usersUnsubscribe = db.collection('users').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'modified' || change.type === 'added') {
                const userData = change.doc.data();
                onlineUsers.set(change.doc.id, {
                    username: userData.username,
                    is_online: userData.is_online === true
                });
            } else if (change.type === 'removed') {
                onlineUsers.delete(change.doc.id);
            }
        });
        if (window.currentChatWith) {
            updateChatStatus();
        }
        if (typeof displayChats === 'function') displayChats();
        updateSearchResultsWithStatus();
        updateContactsWithStatus();
    });

    if (typeof window.chatsUnsubscribe === 'undefined') {
        window.chatsUnsubscribe = db.collection('messages')
            .where('participants', 'array-contains', window.currentUser.uid)
            .orderBy('created_at', 'desc')
            .onSnapshot(() => {
                if (typeof loadChats === 'function') loadChats();
            });
    }
}

function updateSearchResultsWithStatus() {
    const searchResults = document.querySelectorAll('.user-result');
    searchResults.forEach(result => {
        const nameElement = result.querySelector('.user-result-name');
        if (nameElement) {
            const username = nameElement.textContent;
            if (typeof findUserByUsername === 'function') {
                findUserByUsername(username).then(user => {
                    if (user) {
                        const isOnline = onlineUsers.get(user.uid)?.is_online === true;
                        const avatarElement = result.querySelector('.user-result-avatar');
                        const statusElement = result.querySelector('div[style*="font-size: 12px"]');
                        if (avatarElement) {
                            avatarElement.className = `user-result-avatar ${isOnline ? 'online' : ''}`;
                        }
                        if (statusElement) {
                            statusElement.textContent = isOnline ? 'на связи' : 'без связи';
                        }
                    }
                });
            }
        }
    });
}

function updateContactsWithStatus() {
    const contactsItems = document.querySelectorAll('.contact-item');
    contactsItems.forEach(item => {
        const nameElement = item.querySelector('.contact-name');
        if (nameElement) {
            const username = nameElement.textContent;
            if (typeof findUserByUsername === 'function') {
                findUserByUsername(username).then(user => {
                    if (user) {
                        const isOnline = onlineUsers.get(user.uid)?.is_online === true;
                        const avatarElement = item.querySelector('.contact-avatar');
                        const statusElement = item.querySelector('div[style*="font-size: 12px"]');
                        if (avatarElement) {
                            avatarElement.className = `contact-avatar ${isOnline ? 'online' : ''}`;
                        }
                        if (statusElement) {
                            statusElement.textContent = isOnline ? 'на связи' : 'без связи';
                        }
                    }
                });
            }
        }
    });
}

if (typeof window.originalDisplayChats === 'undefined') {
    window.originalDisplayChats = typeof displayChats === 'function' ? displayChats : function() {};
}

window.displayChats = function() {
    if (window.originalDisplayChats) window.originalDisplayChats();
    document.querySelectorAll('.chat-item').forEach(item => {
        const nameElement = item.querySelector('.chat-name');
        if (nameElement) {
            const username = nameElement.textContent.trim();
            if (typeof findUserByUsername === 'function') {
                findUserByUsername(username).then(user => {
                    if (user) {
                        const isOnline = onlineUsers.get(user.uid)?.is_online === true;
                        const avatar = item.querySelector('.chat-avatar');
                        if (avatar) {
                            avatar.className = `chat-avatar ${isOnline ? 'online' : ''}`;
                        }
                        const statusSpan = item.querySelector('.chat-status-text');
                        if (statusSpan) {
                            statusSpan.textContent = isOnline ? 'на связи' : 'без связи';
                            statusSpan.className = `chat-status-text ${isOnline ? 'online' : ''}`;
                        }
                    }
                });
            }
        }
    });
};

setInterval(cleanupOldConnections, 10000);
