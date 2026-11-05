import express from "express";
import { GoogleGenAI } from "@google/genai";
import { parseTranscript, selectUtterances, splitUtterancesIntoSentences } from "./src/audio.js";
import { createGenerationRateLimiter } from "./src/rate-limit.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";

app.set("trust proxy", 1);
app.use(express.json({ limit: "64kb" }));
app.use(express.static("public"));

app.post("/api/generate", createGenerationRateLimiter(), async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Set GEMINI_API_KEY before generating audio." });
  }

  const { transcript, voices, styles, selection } = req.body ?? {};
  if (typeof transcript !== "string" || transcript.length > 8000) {
    return res.status(400).json({ error: "Transcript must be a string of at most 8,000 characters." });
  }

  let utterances;
  try {
    utterances = parseTranscript(transcript);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!utterances.length || utterances.length > 40) {
    return res.status(400).json({ error: "Provide between 1 and 40 caller/agent utterances." });
  }

  try {
    utterances = selectUtterances(utterances, selection);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!utterances.length) {
    return res.status(400).json({ error: `The transcript has no ${selection} lines to generate.` });
  }

  if (!styles || typeof styles !== "object" || Array.isArray(styles) ||
      !["caller", "agent"].every((speaker) =>
        typeof styles[speaker] === "string" && styles[speaker].length <= 500)) {
    return res.status(400).json({ error: "Provide a voice style of at most 500 characters for each speaker." });
  }

  const voiceNames = new Set(["Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar", "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"]);

  if (!voices || typeof voices !== "object" ||
      !["caller", "agent"].every((speaker) => voiceNames.has(voices[speaker]))) {
    return res.status(400).json({ error: "Choose a supported Gemini voice for both caller and agent." });
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const sentences = splitUtterancesIntoSentences(utterances);
    const singleSpeaker = selection !== "both";
    const input = [{
      type: "user_input",
      content: sentences.map((sentence) => {
        const annotation = { type: "speech_metadata" };
        if (!singleSpeaker) {
          annotation.speaker = sentence.speaker === "caller" ? "Caller" : "Agent";
        }
        const style = styles[sentence.speaker].trim();
        if (style) annotation.style = style;
        return {
          type: "text",
          text: sentence.text,
          annotations: [annotation],
        };
      }),
    }];
    const speechConfig = singleSpeaker
      ? [{ voice: voices[selection] }]
      : {
          speakers: [
            { speaker: "Caller", voice: voices.caller },
            { speaker: "Agent", voice: voices.agent },
          ],
        };
    const interaction = await client.interactions.create({
      model,
      input,
      response_format: { type: "audio" },
      generation_config: { speech_config: speechConfig },
    });
    const generatedAudio = interaction.output_audio;
    if (!generatedAudio?.data) {
      throw new Error("Gemini returned no audio.");
    }
    res.json({
      utterances: sentences,
      data: generatedAudio.data,
      mimeType: generatedAudio.mime_type || "audio/wav",
    });
  } catch (error) {
    console.error("Gemini audio generation failed:", error);
    res.status(502).json({ error: "Audio generation failed. Check the Gemini API key, model access, and try again." });
  }
});

app.listen(port, () => {
  console.log(`Call audio generator is running at http://localhost:${port}`);
});
