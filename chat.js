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

    const wasBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 20;
    messagesDiv.innerHTML = "";

    data.forEach(msg => {
      const div = document.createElement("div");
      div.className = `message ${msg.username === usernameInput.value ? 'me' : 'other'}`;
      
      const date = new Date(msg.created_at);
      date.setHours(date.getHours() + 3);
      const time = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      
      div.innerHTML = `
        <div class="username">${msg.username}</div>
        <div>${msg.text}</div>
        <div class="time">${time}</div>
      `;
      messagesDiv.appendChild(div);
    });

    if (wasBottom) {
      setTimeout(() => messagesDiv.scrollTop = messagesDiv.scrollHeight, 10);
    }
  }

  sendBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const text = textInput.value.trim();
    if (!username || !text) return;

    await supabase.from("messages").insert([{ username, text }]);
    textInput.value = "";
    textInput.focus();
    setTimeout(loadMessages, 300);
  };

  textInput.addEventListener("keypress", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  loadMessages();
  setInterval(loadMessages, 3000);
})();
