const messagesDiv = document.getElementById("messages");

let messages = [];

function send() {
  const name = document.getElementById("name").value.trim();
  const text = document.getElementById("text").value.trim();

  if (!name || !text) return;

  messages.push({ name, text });
  document.getElementById("text").value = "";

  render();
}

function render() {
  messagesDiv.innerHTML = "";
  messages.forEach(m => {
    const div = document.createElement("div");
    div.textContent = m.name + ": " + m.text;
    messagesDiv.appendChild(div);
  });
}