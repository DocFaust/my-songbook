package mysongbook.song;

public class StaleSongVersionException extends RuntimeException {

    public StaleSongVersionException() {
        super("stale version");
    }
}
