const voices = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];
const sample = `Caller: Good morning, thanks for calling. How can I help you today?
Agent: Hi, I'm calling about a delivery that was expected this morning.
Caller: I can take a look. Could you share your order number?
Agent: Of course. It's order 4500183927.
Caller: Thank you. I can see it here, and the delivery is now scheduled for tomorrow morning.
Agent: That's great, thank you for checking.
Caller: You're welcome. Is there anything else I can help with?
Agent: No, that's everything. Have a nice day.
Caller: You too. Goodbye.`;
const transcriptInput = document.querySelector("#transcript");
const audio = document.querySelector("#audio");
const generateButtons = [
  { button: document.querySelector("#generate-caller"), selection: "caller", label: "Caller only" },
  { button: document.querySelector("#generate-agent"), selection: "agent", label: "Agent only" },
  { button: document.querySelector("#generate-both"), selection: "both", label: "Generate both" },
];
const playButton = document.querySelector("#play-pause");
const stopButton = document.querySelector("#stop");
const transcriptView = document.querySelector("#transcript-view");
const errorMessage = document.querySelector("#error-message");
let segments = [];
let currentSegment = 0;
let playing = false;
let paused = false;
let totalDuration = 0;
let audioUrl = null;
let lastPausedSegment = -1;

function fillVoices() {
  for (const id of ["caller-voice", "agent-voice"]) {
    const select = document.querySelector(`#${id}`);
    for (const voice of voices) {
      const option = document.createElement("option");
      option.value = voice;
      option.textContent = voice;
      select.append(option);
    }
  }
  document.querySelector("#caller-voice").value = "Kore";
  document.querySelector("#agent-voice").value = "Puck";
}

function getTurns() {
  return transcriptInput.value.split(/\r?\n/).filter((line) => /^\s*(caller|agent)\s*:/i.test(line.trim()));
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function getTextSegments(text) {
  if (typeof Intl.Segmenter === "function") {
    const locale = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) ? "ja" : undefined;
    return Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(text), (part) => ({
      text: part.segment,
      isWord: part.isWordLike,
    }));
  }
  return (text.match(/\s+|\S+/gu) ?? []).map((part) => ({ text: part, isWord: !/^\s+$/u.test(part) }));
}

function renderTranscript() {
  transcriptView.replaceChildren();
  for (const [index, utterance] of segments.entries()) {
    const line = document.createElement("div");
    line.className = "transcript-line";
    line.dataset.index = String(index);
    const speaker = document.createElement("span");
    speaker.className = `transcript-speaker ${utterance.speaker}`;
    speaker.textContent = utterance.speaker === "caller" ? "CALLER" : "AGENT";
    line.append(speaker);
    let wordIndex = 0;
    for (const part of getTextSegments(utterance.text)) {
      if (!part.isWord) {
        line.append(document.createTextNode(part.text));
        continue;
      }
      const token = document.createElement("span");
      token.className = "word";
      token.dataset.word = String(wordIndex++);
      token.textContent = part.text;
      line.append(token);
    }
    transcriptView.append(line);
  }
}

function setActiveWord() {
  const utterance = segments[currentSegment];
  if (!utterance || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const words = getTextSegments(utterance.text).filter((part) => part.isWord).map((part) => part.text);
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const segmentDuration = utterance.end - utterance.start;
  const progress = segmentDuration > 0
    ? Math.min(1, Math.max(0, (audio.currentTime - utterance.start) / segmentDuration))
    : 0;
  let elapsed = 0;
  let activeWord = words.length - 1;
  for (let index = 0; index < weights.length; index++) {
    elapsed += weights[index];
    if (progress < elapsed / totalWeight) {
      activeWord = index;
      break;
    }
  }
  document.querySelectorAll(".transcript-line").forEach((line, index) => {
    line.classList.toggle("active", index === currentSegment);
  });
  document.querySelectorAll(".word").forEach((word) => {
    const lineIndex = Number(word.closest(".transcript-line").dataset.index);
    word.classList.toggle("active", lineIndex === currentSegment && Number(word.dataset.word) === activeWord);
  });
  document.querySelector("#now-playing").innerHTML = "";
  const label = document.createElement("span");
  label.className = `transcript-speaker ${utterance.speaker}`;
  label.textContent = utterance.speaker === "caller" ? "CALLER" : "AGENT";
  const text = document.createElement("p");
  text.textContent = utterance.text;
  const nowPlaying = document.querySelector("#now-playing");
  nowPlaying.append(label, text);
}

function updateProgress() {
  if (!segments.length) return;
  const pauseAfterCaller = document.querySelector("#playback-mode").value === "pause-after-caller";
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    if (playing && pauseAfterCaller && index !== lastPausedSegment && segment.speaker === "caller" &&
        audio.currentTime >= segment.end) {
      audio.currentTime = segment.end;
      currentSegment = index;
      lastPausedSegment = index;
      audio.pause();
      playing = false;
      paused = true;
      playButton.textContent = "▶";
      playButton.setAttribute("aria-label", "Resume conversation");
      document.querySelector("#player-status").textContent = "PAUSED";
      document.querySelector("#player-status").classList.remove("playing");
      break;
    }
  }
  const activeIndex = segments.findIndex((segment) => audio.currentTime < segment.end);
  if (!paused) currentSegment = activeIndex < 0 ? segments.length - 1 : activeIndex;
  const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  document.querySelector("#track-position").textContent = formatTime(elapsed);
  document.querySelector("#progress").style.width = `${totalDuration ? Math.min(100, elapsed / totalDuration * 100) : 0}%`;
  setActiveWord();
}

function stopPlayback() {
  playing = false;
  paused = false;
  audio.pause();
  audio.currentTime = 0;
  currentSegment = 0;
  lastPausedSegment = -1;
  playButton.textContent = "▶";
  playButton.setAttribute("aria-label", "Play conversation");
  document.querySelector("#player-status").textContent = "READY";
  document.querySelector("#player-status").classList.remove("playing");
  document.querySelectorAll(".active").forEach((element) => element.classList.remove("active"));
  document.querySelector("#track-position").textContent = "0:00";
  document.querySelector("#progress").style.width = "0";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

transcriptInput.addEventListener("input", () => {
  const count = getTurns().length;
  document.querySelector("#line-count").textContent = `${count} ${count === 1 ? "turn" : "turns"}`;
});
document.querySelector("#load-example").addEventListener("click", () => {
  transcriptInput.value = sample;
  transcriptInput.dispatchEvent(new Event("input"));
});

async function generateAudio(selection, button) {
  errorMessage.hidden = true;
  if (!transcriptInput.value.trim()) {
    showError("Add a caller/agent transcript before generating audio.");
    transcriptInput.focus();
    return;
  }
  stopPlayback();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  segments = [];
  audio.removeAttribute("src");
  audio.load();
  playButton.disabled = true;
  stopButton.disabled = true;
  for (const item of generateButtons) item.button.disabled = true;
  button.querySelector("span").textContent = "Generating audio…";
  document.querySelector("#player-status").textContent = "GENERATING";
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: transcriptInput.value,
        voices: {
          caller: document.querySelector("#caller-voice").value,
          agent: document.querySelector("#agent-voice").value,
        },
        styles: {
          caller: document.querySelector("#caller-style").value,
          agent: document.querySelector("#agent-style").value,
        },
        selection,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Audio generation failed.");
    if (!result.data || !Array.isArray(result.utterances) || !result.utterances.length) {
      throw new Error("Gemini returned no playable audio.");
    }
    segments = result.utterances.map((utterance) => ({ ...utterance, start: 0, end: 0 }));
    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    audioUrl = URL.createObjectURL(new Blob([bytes], { type: result.mimeType || "audio/wav" }));
    await new Promise((resolve, reject) => {
      audio.addEventListener("loadedmetadata", resolve, { once: true });
      audio.addEventListener("error", () => reject(new Error("The generated audio could not be decoded by this browser.")), { once: true });
      audio.src = audioUrl;
      audio.load();
    });
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      throw new Error("Gemini returned audio with no playable duration.");
    }
    totalDuration = audio.duration;
    const weights = segments.map((segment) => Math.max(1, Array.from(segment.text).length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let elapsedWeight = 0;
    segments.forEach((segment, index) => {
      segment.start = totalDuration * elapsedWeight / totalWeight;
      elapsedWeight += weights[index];
      segment.end = index === segments.length - 1
        ? totalDuration
        : totalDuration * elapsedWeight / totalWeight;
    });
    renderTranscript();
    document.querySelector("#player-status").textContent = "READY";
    playButton.disabled = false;
    stopButton.disabled = false;
    document.querySelector("#now-playing").textContent = "Ready when you are. Press play to follow each word.";
    document.querySelector("#track-duration").textContent = formatTime(totalDuration);
  } catch (error) {
    document.querySelector("#player-status").textContent = "ERROR";
    showError(error.message);
  } finally {
    for (const item of generateButtons) item.button.disabled = false;
    button.querySelector("span").textContent = generateButtons.find((item) => item.button === button).label;
  }
}

for (const item of generateButtons) {
  item.button.addEventListener("click", () => generateAudio(item.selection, item.button));
}

playButton.addEventListener("click", () => {
  if (!segments.length) return;
  if (playing) {
    playing = false;
    paused = true;
    audio.pause();
    playButton.textContent = "▶";
    playButton.setAttribute("aria-label", "Resume conversation");
    document.querySelector("#player-status").textContent = "PAUSED";
    document.querySelector("#player-status").classList.remove("playing");
  } else {
    playing = true;
    const resumeCurrentSegment = paused;
    paused = false;
    playButton.textContent = "Ⅱ";
    playButton.setAttribute("aria-label", "Pause conversation");
    document.querySelector("#player-status").textContent = "PLAYING";
    document.querySelector("#player-status").classList.add("playing");
    if (resumeCurrentSegment) {
      audio.play().catch((error) => {
        showError(`Could not play audio: ${error.message}`);
        stopPlayback();
      });
    } else {
      lastPausedSegment = -1;
      audio.currentTime = 0;
      audio.play().catch((error) => {
        showError(`Could not play audio: ${error.message}`);
        stopPlayback();
      });
    }
  }
});
stopButton.addEventListener("click", stopPlayback);
audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("ended", () => {
  playing = false;
  paused = false;
  currentSegment = 0;
  lastPausedSegment = -1;
  playButton.textContent = "▶";
  playButton.setAttribute("aria-label", "Play conversation");
  document.querySelector("#player-status").textContent = "READY";
  document.querySelector("#player-status").classList.remove("playing");
  document.querySelectorAll(".active").forEach((element) => element.classList.remove("active"));
  document.querySelector("#track-position").textContent = "0:00";
  document.querySelector("#progress").style.width = "0";
});

fillVoices();
