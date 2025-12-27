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

function formatTime(date) {
  const d = new Date(date);
  return d.getHours().toString().padStart(2, "0") + ":" +
         d.getMinutes().toString().padStart(2, "0");
}

async function loadMessages() {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  messagesDiv.innerHTML = "";

  const myName = usernameInput.value.trim();

  data.forEach(msg => {
    const div = document.createElement("div");
    div.className = "message " + (msg.username === myName ? "right" : "left");

    div.innerHTML = 
      <div class="username">${msg.username}</div>
      <div>${msg.text}</div>
      <div class="time">${formatTime(msg.created_at)}</div>
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

loadMessages();
setInterval(loadMessages, 2000);
