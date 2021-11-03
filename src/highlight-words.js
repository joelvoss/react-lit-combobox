/**
 * @typedef {Object} Chunk
 * @prop {boolean} highlight
 * @prop {number} start
 * @prop {number} end
 */

/**
 * @typedef {Object} FindAllOptions
 * @prop {boolean} autoEscape
 * @prop {boolean} caseSensitive
 * @prop {typeof defaultFindChunks} findChunks
 * @prop {typeof defaultSanitize} sanitize
 * @prop {Array<string>} searchWords
 * @prop {string | null} textToHighlight
 */

/**
 * findAll creates an array of chunk objects representing both higlightable and
 * non highlightable pieces of text that match each search word.
 * @param {FindAllOptions} options
 * @return {Array<Chunk>}
 */
function findAll({
	autoEscape,
	caseSensitive = false,
	findChunks = defaultFindChunks,
	sanitize,
	searchWords,
	textToHighlight,
}) {
	const chunks = findChunks({
		autoEscape,
		caseSensitive,
		sanitize,
		searchWords,
		textToHighlight,
	});

	const chunksToHighlight = combineChunks({ chunks });

	return fillInChunks({
		chunksToHighlight,
		totalLength: textToHighlight ? textToHighlight.length : 0,
	});
}

////////////////////////////////////////////////////////////////////////////////

/**
 * combineChunks takes an array of "chunk" objects and combines chunks that
 * overlap into single chunks.
 * @param {{ chunks:Array<Chunk> }} param
 * @return {Array<Chunk>}
 */
function combineChunks({ chunks }) {
	const processedChunks = [];

	chunks.sort((first, second) => first.start - second.start);

	for (let nextChunk of chunks) {
		// NOTE(joel): First chunk just goes straight in the array.
		if (processedChunks.length === 0) {
			processedChunks.push(nextChunk);
			continue;
		}

		// NOTE(joel): Subsequent chunks get checked to see if they overlap.
		const prevChunk = processedChunks.pop();
		if (nextChunk.start <= prevChunk.end) {
			// NOTE(joel): It may be the case that `prevChunk` completely surrounds
			// `nextChunk`, so take the largest of the end indeces.
			const endIndex = Math.max(prevChunk.end, nextChunk.end);
			processedChunks.push({
				highlight: false,
				start: prevChunk.start,
				end: endIndex,
			});
		} else {
			processedChunks.push(prevChunk, nextChunk);
		}
	}

	return processedChunks;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} DefaultFindChunksOptions
 * @prop {boolean} autoEscape
 * @prop {boolean} caseSensitive
 * @prop {typeof defaultSanitize} sanitize
 * @prop {Array<string>} searchWords
 * @prop {string | null} textToHighlight
 */

/**
 * Examine text for any matches. If we find matches, add them to the returned
 * array as a "chunk" object.
 * @param {DefaultFindChunksOptions} options
 * @return {Array<Chunk>}
 */
function defaultFindChunks({
	autoEscape,
	caseSensitive,
	sanitize = defaultSanitize,
	searchWords,
	textToHighlight,
}) {
	textToHighlight = sanitize(textToHighlight || '');

	const chunks = [];

	for (let searchWord of searchWords) {
		if (!searchWord) continue;

		searchWord = sanitize(searchWord);

		if (autoEscape) {
			searchWord = escapeRegExpFn(searchWord);
		}

		const regex = new RegExp(searchWord, caseSensitive ? 'g' : 'gi');

		let match;
		while ((match = regex.exec(textToHighlight || ''))) {
			let start = match.index;
			let end = regex.lastIndex;
			// NOTE(joel): We do not return zero-length matches
			if (end > start) {
				chunks.push({ highlight: false, start, end });
			}

			// NOTE(joel): Prevent browsers like Firefox from getting stuck in an
			// infinite loop.
			// @see http://www.regexguru.com/2008/04/watch-out-for-zero-length-matches/
			if (match.index === regex.lastIndex) {
				regex.lastIndex++;
			}
		}
	}

	return chunks;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} FillInChunksOptions
 * @prop {Array<Chunk>} chunksToHighlight
 * @prop {number} totalLength
 */

/**
 * Given a set of chunks to highlight, create an additional set of chunks
 * to represent the bits of text between the highlighted text.
 * @param {}
 * @return {Array<Chunk>}
 */
function fillInChunks({ chunksToHighlight, totalLength }) {
	/**
	 * append
	 * @param {number} start
	 * @param {number} end
	 * @param {boolean} highlight
	 */
	function append(start, end, highlight) {
		if (end - start > 0) {
			allChunks.push({
				start,
				end,
				highlight,
			});
		}
	}

	/** @type {Array<Chunk>} */
	const allChunks = [];
	if (chunksToHighlight.length === 0) {
		append(0, totalLength, false);
	} else {
		let lastIndex = 0;
		chunksToHighlight.forEach(chunk => {
			append(lastIndex, chunk.start, false);
			append(chunk.start, chunk.end, true);
			lastIndex = chunk.end;
		});
		append(lastIndex, totalLength, false);
	}
	return allChunks;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * defaultSanitize
 * @param {string} string
 * @returns {string}
 */
function defaultSanitize(string) {
	return string;
}

////////////////////////////////////////////////////////////////////////////////

const escapeRegexp = /[-[\]/{}()*+?.\\^$|]/g;

/**
 * escapeRegExpFn
 * @param {string} string
 * @returns {string}
 */
function escapeRegExpFn(string) {
	return string.replace(escapeRegexp, '\\$&');
}

////////////////////////////////////////////////////////////////////////////////

export const HighlightWords = {
	combineChunks,
	fillInChunks,
	findAll,
	findChunks: defaultFindChunks,
};
