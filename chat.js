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

// загрузка сообщений
async function loadMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return;

  messagesDiv.innerHTML = "";

  data.forEach(msg => {
    const el = document.createElement("div");
    el.textContent = ${msg.username}: ${msg.text};
    messagesDiv.appendChild(el);
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// отправка сообщения
sendBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const text = textInput.value.trim();
  if (!username || !text) return;

  await supabase.from("messages").insert({
    username,
    text
  });

  textInput.value = "";
};

// первая загрузка
loadMessages();

// каждые 2 секунды обновляем
setInterval(loadMessages, 2000);
