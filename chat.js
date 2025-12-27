// ===== SUPABASE =====
var SUPABASE_URL = "https://bncysgnqsgpdpuupzgqj.supabase.co";
var SUPABASE_KEY = "sb_publishable_bCoFKBILLDgxddAOkd0ZrA_7LJTvSaR";

var supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ===== ELEMENTS =====
var messagesDiv = document.getElementById("messages");
var usernameInput = document.getElementById("username");
var textInput = document.getElementById("text");
var sendBtn = document.getElementById("send");

// ===== LOAD MESSAGES =====
function loadMessages() {
  supabase
    .from("messages")
    .select("username,text,created_at")
    .order("created_at")
    .then(function (result) {
      if (result.error) return;

      messagesDiv.innerHTML = "";

      for (var i = 0; i < result.data.length; i++) {
        var msg = result.data[i];
        var div = document.createElement("div");
        div.textContent = msg.username + ": " + msg.text;
        messagesDiv.appendChild(div);
      }

      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// ===== SEND =====
sendBtn.onclick = function () {
  var username = usernameInput.value.trim();
  var text = textInput.value.trim();

  if (username === "" || text === "") return;

  supabase
    .from("messages")
    .insert([{ username: username, text: text }])
    .then(function () {
      textInput.value = "";
      loadMessages();
    });
};

// ===== START =====
loadMessages();
setInterval(loadMessages, 2000);
