(function() {
  const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const messagesDiv = document.getElementById("messages");
  const usernameInput = document.getElementById("username");
  const textInput = document.getElementById("text");
  const sendBtn = document.getElementById("send");
  const typingDiv = document.getElementById("typing");

  let lastMessageTime = null;
  let currentUsername = "";

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const latestMessage = data[data.length - 1];
      const latestTime = latestMessage ? new Date(latestMessage.created_at).getTime() : null;

      if (lastMessageTime && latestTime <= lastMessageTime) {
        return;
      }

      lastMessageTime = latestTime;

      messagesDiv.innerHTML = "";

      data.forEach(msg => {
        const div = document.createElement("div");
        div.className = "message " + (msg.username === usernameInput.value ? "me" : "other");

        const msgDate = new Date(msg.created_at);
        msgDate.setHours(msgDate.getHours() + 3);
        const time = msgDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        });

        div.innerHTML = `
          <div class="username">${msg.username}</div>
          <div>${msg.text}</div>
          <div class="time">${time}</div>
        `;

        messagesDiv.appendChild(div);
      });

      requestAnimationFrame(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
    } catch (err) {
      console.error("Ошибка загрузки:", err);
    }
  }

  sendBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const text = textInput.value.trim();
    if (!username || !text) return;

    currentUsername = username;

    try {
      const { error } = await supabase
        .from("messages")
        .insert([{ username, text }]);

      if (error) throw error;

      textInput.value = "";
      textInput.focus();
      
      await loadMessages();
    } catch (err) {
      console.error("Ошибка отправки:", err);
    }
  };

  let typingTimer;
  let isTypingActive = false;
  
  textInput.addEventListener("input", () => {
    const username = usernameInput.value.trim();
    if (!username) return;
    
    if (username === currentUsername) {
      typingDiv.style.display = "none";
      return;
    }
    
    typingDiv.textContent = `${username} печатает...`;
    typingDiv.style.display = "block";
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      typingDiv.style.display = "none";
    }, 1500);
  });

  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  loadMessages();
  
  setInterval(() => {
    loadMessages();
  }, 3000);
})();
