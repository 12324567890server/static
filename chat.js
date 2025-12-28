(function() {
  const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const messagesDiv = document.getElementById("messages");
  const usernameInput = document.getElementById("username");
  const textInput = document.getElementById("text");
  const sendBtn = document.getElementById("send");
  const typingDiv = document.getElementById("typing");

  // Функция для определения мобильного устройства
  function isMobile() {
    return window.innerWidth <= 480;
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

    data.forEach(msg => {
      const div = document.createElement("div");
      const isMe = msg.username === usernameInput.value;
      div.className = "message " + (isMe ? "me" : "other");

      // Исправленное время (добавляем 3 часа для Москвы)
      const msgDate = new Date(msg.created_at);
      msgDate.setHours(msgDate.getHours() + 3);
      const time = msgDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      const usernameEl = document.createElement("div");
      usernameEl.className = "username";
      usernameEl.textContent = msg.username;
      
      const textEl = document.createElement("div");
      textEl.className = "message-text";
      textEl.textContent = msg.text;
      
      const timeEl = document.createElement("div");
      timeEl.className = "time";
      timeEl.textContent = time;
      
      div.appendChild(usernameEl);
      div.appendChild(textEl);
      div.appendChild(timeEl);

      // Для мобильных делаем сообщения компактнее
      if (isMobile()) {
        div.style.maxWidth = isMe ? "85%" : "85%";
        div.style.padding = "8px 10px";
        textEl.style.fontSize = "14px";
        usernameEl.style.fontSize = "11px";
        timeEl.style.fontSize = "10px";
      }

      messagesDiv.appendChild(div);
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  sendBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const text = textInput.value.trim();
    if (!username || !text) return;

    await supabase.from("messages").insert([{ username, text }]);
    textInput.value = "";
    textInput.focus();
    loadMessages();
  };

  let typingTimer;
  textInput.addEventListener("input", () => {
    const username = usernameInput.value.trim();
    if (username) {
      typingDiv.textContent = `${username} печатает...`;
      typingDiv.style.display = "block";
    }
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      typingDiv.style.display = "none";
    }, 1000);
  });

  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Адаптация при изменении размера экрана
  window.addEventListener('resize', loadMessages);

  loadMessages();
  setInterval(loadMessages, 2000);
})();
