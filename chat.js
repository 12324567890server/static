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
const typing = document.getElementById("typing");

let lastUser = "";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.getHours().toString().padStart(2,"0") + ":" +
         d.getMinutes().toString().padStart(2,"0");
}

async function loadMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return;

  messagesDiv.innerHTML = "";

  data.forEach(msg => {
    const div = document.createElement("div");
    div.className = "msg " + (msg.username === lastUser ? "right" : "left");

    div.innerHTML =
      '<div class="nick">' + msg.username + '</div>' +
      '<div>' + msg.text + '</div>' +
      '<div class="time">' + formatTime(msg.created_at) + '</div>';

    messagesDiv.appendChild(div);
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

sendBtn.onclick = async function () {
  const username = usernameInput.value.trim();
  const text = textInput.value.trim();
  if (!username || !text) return;

  lastUser = username;
  typing.style.display = "block";

  await supabase.from("messages").insert([
    { username: username, text: text }
  ]);

  typing.style.display = "none";
  textInput.value = "";
};

loadMessages();
setInterval(loadMessages, 2000);
