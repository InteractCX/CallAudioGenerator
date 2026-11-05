export function parseTranscript(transcript) {
  const utterances = [];
  let current = null;

  for (const line of transcript.split(/\r?\n/)) {
    const match = line.match(/^\s*(caller|agent)\s*:\s*(.*)$/i);
    if (match) {
      if (current?.text) utterances.push(current);
      current = { speaker: match[1].toLowerCase(), text: match[2].trim() };
    } else if (current && line.trim()) {
      current.text += `${current.text ? " " : ""}${line.trim()}`;
    } else if (line.trim()) {
      throw new Error("Each line must begin with Caller: or Agent:.");
    }
  }

  if (current?.text) utterances.push(current);
  if (utterances.length === 0) {
    throw new Error("Add at least one non-empty Caller: or Agent: line.");
  }
  return utterances;
}

export function selectUtterances(utterances, selection) {
  if (!["caller", "agent", "both"].includes(selection)) {
    throw new Error("Choose caller, agent, or both speakers.");
  }
  return selection === "both"
    ? utterances
    : utterances.filter((utterance) => utterance.speaker === selection);
}

export function splitUtterancesIntoSentences(utterances) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  return utterances.flatMap(({ speaker, text }) =>
    Array.from(segmenter.segment(text), ({ segment }) => ({
      speaker,
      text: segment.trim(),
    })).filter((utterance) => utterance.text));
}
