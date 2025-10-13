// src/chords.js
// Utilities für Akkorderkennung und -verarbeitung

// Deutsches H ist erlaubt
export const CHORD_ROOT_RE = "(?:[A-GH])";
export const CHORD_ACCIDENTAL_RE = "(?:[#b])?";
export const CHORD_SUFFIX_RE = "(?:[a-zA-Z0-9+()/#]*)";
export const BAR_TOKEN_RE = "\\|";
export const CHORD_TOKEN_RE = `(?:${CHORD_ROOT_RE}${CHORD_ACCIDENTAL_RE}${CHORD_SUFFIX_RE}|${BAR_TOKEN_RE})`;

// Ganze Zeile nur aus Akkorden, Slashes, Bars und Leerzeichen
export const CHORD_LINE_RE = new RegExp(
    `^\\s*(?:${CHORD_TOKEN_RE})(?:\\s+${CHORD_TOKEN_RE})*\\s*$`
);

export function isChordLine(line) {
    return CHORD_LINE_RE.test(line);
}

// Zerlegt Akkordzeilen, erhält Leerzeichen
export function splitChordLinePreserveSpaces(line) {
    return line.split(/(\s+)/);
}

// Fügt Klammern um Akkorde, belässt Leerzeichen
export function wrapChordTokensPreservingSpaces(parts) {
    return parts.map(part => {
        if (!part.trim()) return part;
        return `[${part.trim()}]`;
    }).join("");
}
