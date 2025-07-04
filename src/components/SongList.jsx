// SongList.jsx
import React, { useEffect, useState } from 'react';
import { getAllSongs } from '../db';

export default function SongList({ onSelectSong }) {
    const [songs, setSongs] = useState([]);

    useEffect(() => {
        getAllSongs().then(setSongs);
    }, []);

    return (
        <div>
            <h2>Meine Songs</h2>
            <ul>
                {songs.map((s) => (
                    <li key={s.Id} onClick={() => onSelectSong(s.Id)} style={{ cursor: 'pointer' }}>
                        {s.name} — {s.author}
                    </li>
                ))}
            </ul>
        </div>
    );
}
