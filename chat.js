const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const messagesDiv = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const usernameInput = document.getElementById("username");
const textInput = document.getElementById("text");
const sendBtn = document.getElementById("send");

async function loadMessages() {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .order("created_at");

  messagesDiv.innerHTML = "";

  const myName = usernameInput.value.trim();

  data.forEach(msg => {
    const div = document.createElement("div");
    div.className = "msg " + (msg.username === myName ? "right" : "left");

    const time = new Date(msg.created_at).toLocaleTimeString().slice(0,5);

    div.innerHTML = 
      <div class="nick">${msg.username}</div>
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

  typingDiv.classList.remove("hidden");

  await supabase.from("messages").insert({
    username,
    text
  });

  textInput.value = "";
  typingDiv.classList.add("hidden");
  loadMessages();
};

loadMessages();
setInterval(loadMessages, 2000);
