import React from 'react';
import { addSongs } from '../db';

export default function ImportButton({ onImportDone }) {
    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const json = JSON.parse(text.split('\n').slice(1).join('')); // Überspringe evtl. Version-Zeile
        await addSongs(json.songs);
        onImportDone();
    };

    return (
        <div>
            <input type="file" accept=".txt,.json" onChange={handleFile} />
        </div>
    );
}
