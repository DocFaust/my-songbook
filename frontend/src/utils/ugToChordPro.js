// sehr pragmatischer Converter – gut genug für viele UG-Beiträge
export function ugToChordPro(input) {
    const lines = input.replace(/\r\n/g, "\n").split("\n");

    // Fall A: [ch]C[/ch] vorhanden -> direkt ersetzen
    if (/\[ch\].+?\[\/ch\]/i.test(input)) {
        return input
            .replace(/\[ch\]\s*([^\]]+?)\s*\[\/ch\]/gi, "{$1}")
            .replace(/^\s*\[(intro|verse|chorus|bridge|outro)\]\s*$/gim, (m, sec) => `{c: ${sec.toUpperCase()}}`);
    }

    // Fall B: Zeilenweise: chords über lyrics
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const a = lines[i];
        const b = lines[i + 1] ?? "";
        const looksLikeChords = /^[A-G][#b]?(m|maj7|m7|7|sus4|sus2|add9|dim|aug)?(?:\s+[A-G][#b]?(?:m|maj7|m7|7|sus4|sus2|add9|dim|aug)?)*\s*$/.test(a.trim());

        if (looksLikeChords && b.trim()) {
            out.push(weaveChordsIntoLyrics(a, b));
            i++; // zweite Zeile verbraucht
        } else {
            // Sektionen wie [Verse] in {c: Verse}
            const secMatch = a.trim().match(/^\[(intro|verse|chorus|bridge|outro)\]$/i);
            if (secMatch) out.push(`{c: ${secMatch[1].toUpperCase()}}`);
            else out.push(a);
        }
    }
    return out.join("\n");
}

function weaveChordsIntoLyrics(chordLine, lyricLine) {
    // mappe positionsbasiert Akkorde in Text – heuristisch
    const positions = [];
    const re = /([A-G][#b]?(?:m|maj7|m7|7|sus4|sus2|add9|dim|aug)?)/g;
    let m;
    while ((m = re.exec(chordLine)) !== null) {
        positions.push({ index: m.index, chord: m[1] });
    }
    if (positions.length === 0) return lyricLine;

    let result = "";
    for (let i = 0; i < lyricLine.length; i++) {
        const here = positions.find(p => p.index === i);
        if (here) result += `{${here.chord}}`;
        result += lyricLine[i];
    }
    // falls Chords hinter dem Lyric-Ende hängen
    positions.filter(p => p.index >= lyricLine.length).forEach(p => { result += ` {${p.chord}}`; });
    return result;
}
