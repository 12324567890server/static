(function() {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    document.addEventListener('touchmove', function(e) {
        const scrollable = e.target.closest('.chats-list, .private-messages, .emoji-panel, .modal-body, .search-results, .contacts-list');
        
        if (!scrollable) {
            e.preventDefault();
            return;
        }
        
        const element = scrollable;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;
        const touchY = e.touches[0].clientY;
        
        if (scrollTop <= 0 && touchY > e.touches[0].clientY) {
            e.preventDefault();
        }
        
        if (scrollTop + clientHeight >= scrollHeight && touchY < e.touches[0].clientY) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('wheel', function(e) {
        const scrollable = e.target.closest('.chats-list, .private-messages, .emoji-panel, .modal-body, .search-results, .contacts-list');
        if (!scrollable) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End') {
            const scrollable = e.target.closest('.chats-list, .private-messages, .emoji-panel, .modal-body, .search-results, .contacts-list');
            if (!scrollable) {
                e.preventDefault();
            }
        }
    });
})();
