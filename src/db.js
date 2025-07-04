import { openDB } from 'idb';

export const initDB = async () => {
    return openDB('SongbookDB', 1, {
        upgrade(db) {
            db.createObjectStore('songs', { keyPath: 'Id' });
        },
    });
};

export const addSongs = async (songs) => {
    const db = await initDB();
    const tx = db.transaction('songs', 'readwrite');
    const store = tx.objectStore('songs');
    songs.forEach((song) => {
        if (song.type === 1 && song.content) {
            store.put(song);
        }
    });
    await tx.done;
};

export const getAllSongs = async () => {
    const db = await initDB();
    return db.getAll('songs');
};
