// === Supabase config ===
const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

// создаём клиент ОДИН раз
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// === DOM ===
const messagesDiv = document.getElementById("messages");
const usernameInput = document.getElementById("username");
const textInput = document.getElementById("text");
const sendBtn = document.getElementById("send");

// === загрузка сообщений ===
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
    const el = document.createElement("div");
    el.textContent = ${msg.username}: ${msg.text};
    messagesDiv.appendChild(el);
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// === отправка ===
sendBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const text = textInput.value.trim();

  if (!username || !text) return;

  const { error } = await supabase
    .from("messages")
    .insert([{ username, text }]);

  if (error) {
    console.error(error);
    return;
  }

  textInput.value = "";
};

// === старт ===
loadMessages();
setInterval(loadMessages, 2000);
