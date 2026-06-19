import React, { useMemo } from "react";
import './styles.css'
import { ChordProParser, HtmlTableFormatter, HtmlDivFormatter } from "chordsheetjs";

export default function ChordProViewer({ chordProText }) {
    const parsedHtml = useMemo(() => {
        if (!chordProText.trim()) return "<p>Kein ChordPro Text</p>";

        try {
            const parser = new ChordProParser();
            const song = parser.parse(chordProText);
            const formatter = new HtmlTableFormatter();
//            const formatter = new HtmlDivFormatter();
            return formatter.format(song);
        } catch (err) {
            return `<p style="color:red;">Fehler: ${err.message}</p>`;
        }
    }, [chordProText]);

    return (
        <div
            className="border border-gray-300 p-4 mt-4"
            dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
    );
}
