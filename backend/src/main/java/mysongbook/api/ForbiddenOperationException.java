package mysongbook.api;

public class ForbiddenOperationException extends RuntimeException {

    public ForbiddenOperationException() {
        super("Forbidden");
    }
}
