(function() {
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const messagesDiv = document.getElementById("messages");
  const usernameInput = document.getElementById("username");
  const textInput = document.getElementById("text");
  const sendBtn = document.getElementById("send");
  const typingDiv = document.getElementById("typing");
  
  function getMessageMaxWidth() {
    const width = window.innerWidth;
    if (width < 360) return '92%';
    if (width < 480) return '88%';
    if (width < 768) return '80%';
    return '75%';                 
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    messagesDiv.innerHTML = "";
    const maxWidth = getMessageMaxWidth();

    data.forEach(msg => {
      const div = document.createElement("div");
      const isMe = msg.username === usernameInput.value;
      div.className = "message " + (isMe ? "me" : "other");
      
      div.style.maxWidth = maxWidth;

      const msgDate = new Date(msg.created_at);
      msgDate.setHours(msgDate.getHours() + 3);
      const time = msgDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      const usernameEl = document.createElement("div");
      usernameEl.className = "username";
      usernameEl.textContent = msg.username || "Аноним";
      
      const textEl = document.createElement("div");
      textEl.className = "message-text";
      textEl.textContent = msg.text;
      
      const timeEl = document.createElement("div");
      timeEl.className = "time";
      timeEl.textContent = time;
      
      if (isMobile) {
        div.style.padding = "8px 10px";
        textEl.style.fontSize = "14px";
        usernameEl.style.fontSize = "11px";
        timeEl.style.fontSize = "10px";
      }
      
      div.appendChild(usernameEl);
      div.appendChild(textEl);
      div.appendChild(timeEl);
      messagesDiv.appendChild(div);
    });

    setTimeout(() => {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
  }

  sendBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const text = textInput.value.trim();
    
    if (!username) {
      if (isMobile) {
        usernameInput.focus();
        usernameInput.style.border = "2px solid #ff6b6b";
        setTimeout(() => usernameInput.style.border = "", 2000);
      } else {
        alert("Введите имя!");
      }
      return;
    }
    
    if (!text) {
      if (isMobile) {
        textInput.focus();
        textInput.style.border = "2px solid #ff6b6b";
        setTimeout(() => textInput.style.border = "", 2000);
      } else {
        alert("Введите сообщение!");
      }
      return;
    }

    try {
      const { error } = await supabase.from("messages").insert([{ 
        username: username, 
        text: text 
      }]);
      
      if (error) throw error;
      
      textInput.value = "";
      textInput.focus();
      
      if (isMobile && document.activeElement) {
        document.activeElement.blur();
      }
      
      await loadMessages();
    } catch (err) {
      console.error("Ошибка отправки:", err);
      if (!isMobile) alert("Ошибка отправки!");
    }
  };

  // печать
  let typingTimer;
  textInput.addEventListener("input", () => {
    const username = usernameInput.value.trim();
    if (!username) return;
    
    typingDiv.textContent = `${username} печатает...`;
    typingDiv.style.display = "block";
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      typingDiv.style.display = "none";
    }, 1000);
  });

  // Отправка
  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(loadMessages, 250);
  });

  if (isMobile) {
    setTimeout(() => {
      usernameInput.focus();
      setTimeout(() => usernameInput.blur(), 100);
    }, 500);
  }

  // Запуск
  loadMessages();
  setInterval(loadMessages, 2000);
})();
