const SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

// подключение
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
  const result = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (result.error) {
    console.log(result.error);
    return;
  }

  messagesDiv.innerHTML = "";

  result.data.forEach(function (msg) {
    const div = document.createElement("div");
    div.textContent = msg.username + ": " + msg.text;
    messagesDiv.appendChild(div);
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// отправка сообщения
sendBtn.onclick = async function () {
  const username = usernameInput.value.trim();
  const text = textInput.value.trim();

  if (!username || !text) return;

  await supabase.from("messages").insert([
    {
      username: username,
      text: text
    }
  ]);

  textInput.value = "";
};

// первая загрузка
loadMessages();

// обновление каждые 2 секунды
setInterval(loadMessages, 2000);
