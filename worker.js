"use strict";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALGORITHMS = new Set([
    "SHA-1",
    "SHA-256",
    "SHA-384",
    "SHA-512"
]);

self.onmessage = async event => {
    const message = event.data;

    if (!message || message.type !== "hash") {
        return;
    }

    const { id, file, algorithms } = message;

    try {
        if (!(file instanceof Blob)) {
            throw new Error("Invalid file supplied to the hashing worker.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("File exceeds the 100 MiB size limit.");
        }

        const validAlgorithms = (Array.isArray(algorithms) ? algorithms : []).filter(
            algorithm => ALGORITHMS.has(algorithm)
        );

        if (validAlgorithms.length === 0) {
            throw new Error("No valid hash algorithms were selected.");
        }

        if (!self.crypto?.subtle) {
            throw new Error("Web Crypto API is unavailable.");
        }

        const buffer = await readFileWithProgress(file, id);

        const results = {};

        for (let index = 0; index < validAlgorithms.length; index++) {
            const algorithm = validAlgorithms[index];

            self.postMessage({
                type: "progress",
                id,
                percent: 80 + (index / validAlgorithms.length) * 15,
                message: `Calculating ${algorithm}...`
            });

            const digest = await crypto.subtle.digest(algorithm, buffer);

            results[algorithm] = Array.from(new Uint8Array(digest))
                .map(byte => byte.toString(16).padStart(2, "0"))
                .join("");
        }

        self.postMessage({
            type: "complete",
            id,
            results
        });
    } catch (error) {
        self.postMessage({
            type: "error",
            id,
            message: error?.message || "Hash calculation failed."
        });
    }
};

function readFileWithProgress(file, id) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onprogress = event => {
            if (event.lengthComputable) {
                self.postMessage({
                    type: "progress",
                    id,
                    percent: (event.loaded / event.total) * 75,
                    message: "Reading file..."
                });
            }
        };

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to read the file."));
        reader.onabort = () => reject(new Error("File reading was cancelled."));

        reader.readAsArrayBuffer(file);
    });
}