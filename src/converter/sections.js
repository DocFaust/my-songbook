// src/sections.js
// Parser für Abschnittsüberschriften wie [Chorus], [Verse 2], [Intro]

const SECTION_RE = /^\[([^\]]+)\]\s*(.*)$/i;

export function parseLabeledLine(line) {
    const m = line.match(SECTION_RE);
    if (!m) return null;
    const label = m[1].trim();
    const rest = m[2] ? m[2] : "";
    return { label, rest };
}

export function labelToDirective(label) {
    const lower = label.toLowerCase();
    if (lower.startsWith("chorus") || lower.startsWith("refrain")) {
        return { directive: "soc", label };
    }
    if (lower.startsWith("verse") || lower.startsWith("strophe") || lower.startsWith("vers")) {
        return { directive: "sov", label };
    }
    return { directive: "c", label };
}
