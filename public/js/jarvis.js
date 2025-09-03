const btn = document.querySelector(".talk");
const content = document.querySelector(".content");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.volume = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function wishMe() {
  const hour = new Date().getHours();
  if (hour < 12) speak("Good Morning Boss...");
  else if (hour < 17) speak("Good Afternoon Master...");
  else speak("Good Evening Sir...");
}

window.addEventListener("load", () => {
  speak("Activating Jarvis");
  speak("Going online");
  wishMe();
});

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  content.textContent = transcript;
  takeCommand(transcript.toLowerCase());
};

btn.addEventListener("click", () => {
  recognition.start();
});

function takeCommand(message) {
  if (message.includes("hello") || message.includes("hey")) {
    speak("Hello Sir, How May I Help You?");
  } else if (message.includes("open google")) {
    speak("Opening Google...");
    window.open("https://google.com", "_blank");
  } else if (message.includes("what is your name")) {
    speak("My name is Jarvis, your virtual assistant.");
  } else if (message.includes("time")) {
    const time = new Date().toLocaleTimeString();
    speak(`Current time is ${time}`);
  } else {
    speak("Sorry, I didn't understand. Searching on Google.");
    window.open(`https://www.google.com/search?q=${message}`, "_blank");
  }
}
