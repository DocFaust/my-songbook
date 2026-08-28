import React from "react";

export default function InputArea({ chordProText, setChordProText }) {
    return (
        <textarea
            value={chordProText}
            onChange={(e) => setChordProText(e.target.value)}
            placeholder="ChordPro hier eingeben..."
            className="w-full h-48 p-4 border border-gray-400 rounded"
        />
    );
}
