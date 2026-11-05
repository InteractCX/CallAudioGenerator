# Call Audio Studio

A small web app for generating call-center dialogue with Gemini text-to-speech. Choose a Gemini prebuilt voice and speaking style for the caller and agent, then generate caller audio, agent audio, or the complete conversation with an approximate word-by-word highlight.

## Run locally

1. Install Node.js 20 or newer.
2. Install packages with `npm install`.
3. Set `GEMINI_API_KEY` in your environment.
4. Run `npm start` and open [http://localhost:3000](http://localhost:3000).

For example, in macOS or Linux:

```sh
export GEMINI_API_KEY="your-api-key"
npm start
```

The default model is `gemini-3.8-flash-tts`. Override it with `GEMINI_TTS_MODEL` if your Gemini project uses a different TTS model. Each generation sends the selected transcript to Gemini in one request, with sentence-level speaker and style annotations to keep delivery consistent across a long call. The API key stays on the server.

Use **Caller only** or **Agent only** to generate just that speaker's lines from the transcript, or **Generate both** to generate all lines in order. Optional style descriptions (up to 500 characters each) can guide delivery, for example “Warm, a little rushed, and concerned.” During playback, choose continuous playback or pause after each caller sentence; press play to resume from each pause.

## Transcript format

Start each turn with `Caller:` or `Agent:`. Additional wrapped lines are joined to that turn. Each speaker keeps their selected voice for all turns.

```text
Caller: Thanks for calling. How can I help?
Agent: I have a question about my order.
```

The player highlights words in sequence based on their relative length and the audio duration. Gemini does not return word-level timestamps for this generation flow, so the highlight and sentence boundaries are estimates rather than forced alignment.

Run unit tests with `npm test`.
# CallAudioGenerator
