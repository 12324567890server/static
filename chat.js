const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const messagesDiv = document.getElementById("messages");
const usernameInput = document.getElementById("username");
const textInput = document.getElementById("text");
const sendBtn = document.getElementById("send");
const typingDiv = document.getElementById("typing");

async function loadMessages() {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  messagesDiv.innerHTML = "";

  data.forEach(msg => {
    const div = document.createElement("div");
    div.className = "message " +
      (msg.username === usernameInput.value ? "me" : "other");

    const time = new Date(msg.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    div.innerHTML = 
      <div class="username">${msg.username}</div>
      <div>${msg.text}</div>
      <div class="time">${time}</div>
    ;

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
};

textInput.addEventListener("input", () => {
  typingDiv.style.display = "block";
  clearTimeout(window.typingTimer);
  window.typingTimer = setTimeout(() => {
    typingDiv.style.display = "none";
  }, 1000);
});

loadMessages();
setInterval(loadMessages, 2000);
