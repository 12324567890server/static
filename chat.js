const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ===== Элементы =====
const messagesDiv = document.getElementById("messages");
const usernameInput = document.getElementById("username");
const textInput = document.getElementById("text");
const sendBtn = document.getElementById("send");

// ===== Загрузка сообщений =====
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
    div.textContent = msg.username + ": " + msg.text;
    messagesDiv.appendChild(div);
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ===== Отправка сообщения =====
sendBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const text = textInput.value.trim();

  if (!username || !text) return;

  await supabase.from("messages").insert([
    { username: username, text: text }
  ]);

  textInput.value = "";
  loadMessages();
};

// ===== Запуск =====
loadMessages();
setInterval(loadMessages, 2000);
