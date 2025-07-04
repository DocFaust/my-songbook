import React, { useEffect, useState } from 'react';
import { initDB } from '../db';
import ChordProViewer from './ChordProViewer/ChordProViewer.jsx';

export default function SongDetail({ songId, onClose }) {
    const [song, setSong] = useState(null);

    useEffect(() => {
        const loadSong = async () => {
            const db = await initDB();
            const result = await db.get('songs', songId);
            setSong(result);
        };
        loadSong();
    }, [songId]);

    if (!song) return <div>Lädt...</div>;

    return (
        <div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
            <button onClick={onClose}>Zurück</button>
            <h2>{song.name}</h2>
            <h4>{song.author}</h4>
            <p>
                <strong>Capo:</strong> {song.Capo} | <strong>Key:</strong> {song.key}
            </p>
            <ChordProViewer content={song.content} />
        </div>
    );
}
