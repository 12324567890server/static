let onlineUsers = new Map();
let heartbeatInterval = null;
let usersUnsubscribe = null;

const findUserByUsername = async (username) => {
    const snapshot = await db.collection('users').where('username', '==', username).get();
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
            uid: doc.id,
            username: doc.data().username
        };
    }
    return null;
};

function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (currentUser && connectionId && navigator.onLine && !document.hidden) {
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
    if (!currentUser || !connectionId) return;
    try {
        const connectionRef = db.collection('users')
            .doc(currentUser.uid)
            .collection('connections')
            .doc(connectionId);
        await connectionRef.set({
            connection_id: connectionId,
            is_online: isOnline,
            last_seen: new Date().toISOString(),
            device: isMobile ? 'mobile' : 'desktop'
        }, { merge: true });
        await updateUserStatus(currentUser.uid);
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
    if (!currentChatUserId || !elements.chatStatus) return;
    const user = onlineUsers.get(currentChatUserId);
    const isOnline = user?.is_online === true;
    if (isOnline) {
        elements.chatStatus.textContent = 'на связи';
        elements.chatStatus.style.color = '#4CAF50';
    } else {
        elements.chatStatus.textContent = 'был(а) недавно';
        elements.chatStatus.style.color = 'rgba(255,255,255,0.5)';
    }
}

function setupRealtimeSubscriptions() {
    cleanupSubscriptions();
    if (!currentUser) return;

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
        if (currentChatWith) {
            updateChatStatus();
        }
        displayChats();
        updateSearchResultsWithStatus();
        updateContactsWithStatus();
    });

    chatsUnsubscribe = db.collection('messages')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('created_at', 'desc')
        .onSnapshot(() => {
            loadChats();
        });
}

function updateSearchResultsWithStatus() {
    const searchResults = document.querySelectorAll('.user-result');
    searchResults.forEach(result => {
        const nameElement = result.querySelector('.user-result-name');
        if (nameElement) {
            const username = nameElement.textContent;
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
    });
}

function updateContactsWithStatus() {
    const contactsItems = document.querySelectorAll('.contact-item');
    contactsItems.forEach(item => {
        const nameElement = item.querySelector('.contact-name');
        if (nameElement) {
            const username = nameElement.textContent;
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
    });
}

const originalDisplayChats = displayChats;
displayChats = function() {
    if (originalDisplayChats) originalDisplayChats();
    document.querySelectorAll('.chat-item').forEach(item => {
        const nameElement = item.querySelector('.chat-name');
        if (nameElement) {
            const username = nameElement.textContent.trim();
            findUserByUsername(username).then(user => {
                if (user) {
                    const isOnline = onlineUsers.get(user.uid)?.is_online === true;
                    const avatar = item.querySelector('.chat-avatar');
                    if (avatar) {
                        avatar.className = `chat-avatar ${isOnline ? 'online' : ''}`;
                    }
                }
            });
        }
    });
};
