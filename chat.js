(function() {
  const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const messagesDiv = document.getElementById("messages");
  const usernameInput = document.getElementById("username");
  const textInput = document.getElementById("text");
  const sendBtn = document.getElementById("send");
  let lastId = null;

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
    div.className = `message ${msg.username === usernameInput.value ? 'me' : 'other'}`;
    
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
    const username = usernameInput.value.trim();
    const text = textInput.value.trim();
    if (!username || !text) {
      if (!username) usernameInput.focus();
      else textInput.focus();
      return;
    }

    try {
      const { error } = await supabase
        .from("messages")
        .insert([{ username, text }]);

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

  setTimeout(() => usernameInput.focus(), 300);

  loadMessages();
  setInterval(loadMessages, 2500);
})();
