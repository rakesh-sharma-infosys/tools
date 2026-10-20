'use strict';

/**
 * Pure JavaScript MD5 implementation, exposed as the global `Md5ChecksumCalculator`.
 * The browser's Web Crypto API deliberately does not offer MD5, so it is implemented here.
 * Classic <script> style (no modules) so index.html keeps working from file://.
 */
const Md5ChecksumCalculator = (() => {
    // Number of bits each of the 64 steps rotates left by (16 steps per round, 4 rounds).
    const rotationAmountPerStep = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];

    // Per-step constants: floor(abs(sin(stepNumber + 1)) * 2^32), as defined by RFC 1321.
    const constantPerStep = Array.from({ length: 64 }, (unusedValue, stepIndex) =>
        Math.floor(Math.abs(Math.sin(stepIndex + 1)) * 4294967296) >>> 0);

    /** Rotates a 32-bit number left by the given amount of bits. */
    const rotateLeft = (numberToRotate, bitCount) => ((numberToRotate << bitCount) | (numberToRotate >>> (32 - bitCount))) >>> 0;

    /**
     * Calculates the MD5 checksum of raw bytes.
     * @param {Uint8Array} inputBytes The data to hash.
     * @returns {string} The checksum as 32 lowercase hexadecimal characters.
     */
    const calculateChecksumOfBytes = (inputBytes) => {
        // ---- padding: append 0x80, zeros up to 56 mod 64, then the bit length as 64-bit little endian ----
        const paddedLength = (((inputBytes.length + 8) >>> 6) + 1) << 6;
        const paddedBytes = new Uint8Array(paddedLength);
        paddedBytes.set(inputBytes);
        paddedBytes[inputBytes.length] = 0x80;
        const paddedView = new DataView(paddedBytes.buffer);
        paddedView.setUint32(paddedLength - 8, (inputBytes.length << 3) >>> 0, true);
        paddedView.setUint32(paddedLength - 4, Math.floor(inputBytes.length / 0x20000000), true);

        // ---- running state, initialised with the standard RFC 1321 values ----
        let stateA = 0x67452301;
        let stateB = 0xefcdab89;
        let stateC = 0x98badcfe;
        let stateD = 0x10325476;

        // ---- process the data in 64-byte blocks ----
        for (let blockOffset = 0; blockOffset < paddedLength; blockOffset += 64) {
            let workingA = stateA;
            let workingB = stateB;
            let workingC = stateC;
            let workingD = stateD;

            for (let stepIndex = 0; stepIndex < 64; stepIndex++) {
                let mixedValue;
                let wordIndex;
                if (stepIndex < 16) {
                    mixedValue = (workingB & workingC) | (~workingB & workingD);
                    wordIndex = stepIndex;
                } else if (stepIndex < 32) {
                    mixedValue = (workingD & workingB) | (~workingD & workingC);
                    wordIndex = (5 * stepIndex + 1) % 16;
                } else if (stepIndex < 48) {
                    mixedValue = workingB ^ workingC ^ workingD;
                    wordIndex = (3 * stepIndex + 5) % 16;
                } else {
                    mixedValue = workingC ^ (workingB | ~workingD);
                    wordIndex = (7 * stepIndex) % 16;
                }

                const messageWord = paddedView.getUint32(blockOffset + wordIndex * 4, true);
                const sumBeforeRotation = (workingA + (mixedValue >>> 0) + constantPerStep[stepIndex] + messageWord) >>> 0;

                // Shift the four working registers one position, as the algorithm prescribes.
                workingA = workingD;
                workingD = workingC;
                workingC = workingB;
                workingB = (workingB + rotateLeft(sumBeforeRotation, rotationAmountPerStep[stepIndex])) >>> 0;
            }

            // Add this block's result to the running state.
            stateA = (stateA + workingA) >>> 0;
            stateB = (stateB + workingB) >>> 0;
            stateC = (stateC + workingC) >>> 0;
            stateD = (stateD + workingD) >>> 0;
        }

        // ---- output: the four state words as little endian bytes, written in hex ----
        const outputBytes = new Uint8Array(16);
        const outputView = new DataView(outputBytes.buffer);
        [stateA, stateB, stateC, stateD].forEach((stateWord, wordPosition) => outputView.setUint32(wordPosition * 4, stateWord, true));
        return Array.from(outputBytes, (singleByte) => singleByte.toString(16).padStart(2, '0')).join('');
    };

    /**
     * Calculates the MD5 checksum of a text, hashing its UTF-8 encoding.
     * @param {string} textToHash The text to hash.
     * @returns {string} The checksum as 32 lowercase hexadecimal characters.
     */
    const calculateChecksumOfText = (textToHash) => calculateChecksumOfBytes(new TextEncoder().encode(textToHash));

    return { calculateChecksumOfBytes, calculateChecksumOfText };
})();
