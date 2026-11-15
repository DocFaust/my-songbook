const DIRECTIVE = /\{(\s*)([^{}:]+?)(\s*:\s*)([^{}]*?)(\s*)\}/g;

function directiveName(match) {
    return match[2].trim().toLowerCase();
}

function isTitleDirective(match) {
    const name = directiveName(match);
    return name === 'title' || name === 't';
}

function isArtistDirective(match) {
    return directiveName(match) === 'artist';
}

function withValue(match, value) {
    return `{${match[1]}${match[2]}${match[3]}${value}${match[5]}}`;
}

function removalRange(text, match) {
    const start = match.index;
    const end = start + match[0].length;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const breakAt = text.indexOf('\n', end);
    const lineStop = breakAt === -1 ? text.length : breakAt;
    const line = text.slice(lineStart, lineStop).replace(/\r$/, '');
    if (line.trim() !== match[0]) {
        return { start, end, replacement: '' };
    }
    return {
        start: lineStart,
        end: breakAt === -1 ? text.length : breakAt + 1,
        replacement: '',
    };
}

function applyEdits(text, edits) {
    const ordered = [...edits].sort((left, right) => right.start - left.start);
    let result = text;
    for (const edit of ordered) {
        result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    }
    return result;
}

export function syncChordProMetadata(content, { title = '', artist = '' } = {}) {
    const text = String(content ?? '');
    const titleValue = String(title ?? '').trim();
    const artistValue = String(artist ?? '').trim();
    const titles = [];
    const artists = [];

    for (const match of text.matchAll(DIRECTIVE)) {
        if (isTitleDirective(match)) {
            titles.push(match);
        } else if (isArtistDirective(match)) {
            artists.push(match);
        }
    }

    const edits = [];
    if (titleValue && titles.length > 0) {
        const [first, ...rest] = titles;
        edits.push({
            start: first.index,
            end: first.index + first[0].length,
            replacement: withValue(first, titleValue),
        });
        for (const extra of rest) {
            edits.push(removalRange(text, extra));
        }
    }
    if (artists.length > 0) {
        if (artistValue) {
            const [first, ...rest] = artists;
            edits.push({
                start: first.index,
                end: first.index + first[0].length,
                replacement: withValue(first, artistValue),
            });
            for (const extra of rest) {
                edits.push(removalRange(text, extra));
            }
        } else {
            for (const extra of artists) {
                edits.push(removalRange(text, extra));
            }
        }
    }

    let edited = applyEdits(text, edits);
    const headers = [];
    if (titleValue && titles.length === 0) {
        headers.push(`{title: ${titleValue}}`);
    }
    if (artistValue && artists.length === 0) {
        headers.push(`{artist: ${artistValue}}`);
    }
    if (headers.length === 0) {
        return edited;
    }

    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    const bom = edited.startsWith('\uFEFF') ? '\uFEFF' : '';
    const body = bom ? edited.slice(1) : edited;
    const block = headers.join(newline);
    if (!body) {
        return bom + block;
    }
    return `${bom}${block}${newline}${body}`;
}
