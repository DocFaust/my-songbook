import { openDB } from "idb";

export const initDB = async () => {
    return openDB("SongbookDB", 2, {
        upgrade(db, oldVersion) {
            if (oldVersion < 1) {
                db.createObjectStore("songs", { keyPath: "Id" });
            }
            if (oldVersion < 2) {
                db.createObjectStore("setlists", { keyPath: "id" });
            }
        },
    });
};

// SONGS bleiben wie gehabt:
export const addSongs = async (songs) => {
    const db = await initDB();
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    songs.forEach((song) => {
        if (song.type === 1 && song.content) {
            store.put(song);
        }
    });
    await tx.done;
};

export const getAllSongs = async () => (await initDB()).getAll("songs");

// NEU: SETLISTS
export const saveSetlist = async (setlist) => {
    const db = await initDB();
    await db.put("setlists", setlist);
};

export const getSetlists = async () => {
    const db = await initDB();
    return db.getAll("setlists");
};

export const getSetlistById = async (id) => {
    const db = await initDB();
    return db.get("setlists", id);
};

export const deleteSetlist = async (id) => {
    const db = await initDB();
    await db.delete("setlists", id);
};
