(function() {
  const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const messagesDiv = document.getElementById("messages");
  const usernameInput = document.getElementById("username");
  const textInput = document.getElementById("text");
  const sendBtn = document.getElementById("send");
  const typingDiv = document.getElementById("typing");

  let lastMessageId = null;
  let myUsername = "";

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      if (data.length === 0) return;
      
      const latestId = data[data.length - 1].id;
      if (lastMessageId === latestId) return;
      
      lastMessageId = latestId;

      const wasScrolledToBottom = 
        messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 10;

      messagesDiv.innerHTML = "";

      data.forEach(msg => {
        const div = document.createElement("div");
        div.className = "message " + (msg.username === myUsername ? "me" : "other");

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

      if (wasScrolledToBottom) {
        setTimeout(() => {
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 10);
      }
    } catch (err) {
      console.error("Ошибка загрузки:", err);
    }
  }

  sendBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const text = textInput.value.trim();
    if (!username || !text) return;
    
    myUsername = username;

    try {
      const { error } = await supabase
        .from("messages")
        .insert([{ username, text }]);

      if (error) throw error;

      textInput.value = "";
      textInput.focus();
      
      setTimeout(loadMessages, 300);
    } catch (err) {
      console.error("Ошибка отправки:", err);
    }
  };
  
  let typingTimer;
  
  textInput.addEventListener("input", () => {
    const username = usernameInput.value.trim();
    if (!username) return;
    
    clearTimeout(typingTimer);
  });

  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  typingDiv.style.display = "none";

  loadMessages();
  
  setInterval(loadMessages, 3000);
})();
