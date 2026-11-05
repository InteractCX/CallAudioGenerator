import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTranscript,
  selectUtterances,
  splitUtterancesIntoSentences,
} from "../src/audio.js";

test("parses caller and agent turns and joins wrapped lines", () => {
  assert.deepEqual(parseTranscript("Caller: Hello\nthere\nAgent: Hi"), [
    { speaker: "caller", text: "Hello there" },
    { speaker: "agent", text: "Hi" },
  ]);
});

test("rejects text that is not attributed to a speaker", () => {
  assert.throws(() => parseTranscript("Hello there"), /begin with Caller: or Agent:/);
  assert.throws(() => parseTranscript("Caller: \n"), /at least one non-empty/);
});

test("selects only requested speaker turns or retains both speakers", () => {
  const turns = parseTranscript("Caller: Hello\nAgent: Hi\nCaller: Thanks");
  assert.deepEqual(selectUtterances(turns, "caller"), [
    { speaker: "caller", text: "Hello" },
    { speaker: "caller", text: "Thanks" },
  ]);
  assert.deepEqual(selectUtterances(turns, "agent"), [
    { speaker: "agent", text: "Hi" },
  ]);
  assert.deepEqual(selectUtterances(turns, "both"), turns);
  assert.throws(() => selectUtterances(turns, "other"), /Choose caller, agent, or both/);
});

test("splits turns into sentences while preserving each speaker", () => {
  assert.deepEqual(splitUtterancesIntoSentences([
    { speaker: "caller", text: "Hello there. How are you?" },
    { speaker: "agent", text: "I can help!" },
  ]), [
    { speaker: "caller", text: "Hello there." },
    { speaker: "caller", text: "How are you?" },
    { speaker: "agent", text: "I can help!" },
  ]);
});
