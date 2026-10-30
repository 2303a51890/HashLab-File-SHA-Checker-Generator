"use strict";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALGORITHMS = {
    "SHA-1": { bits: 160, length: 40 },
    "SHA-256": { bits: 256, length: 64 },
    "SHA-384": { bits: 384, length: 96 },
    "SHA-512": { bits: 512, length: 128 }
};

const $ = id => document.getElementById(id);

const fileInput = $("fileInput");
const dropZone = $("dropZone");
const fileArea = $("fileArea");
const fileList = $("fileList");
const fileCount = $("fileCount");
const clearFilesButton = $("clearFiles");

const expectedHashInput = $("expectedHash");
const checksumFileInput = $("checksumFile");
const checksumFileName = $("checksumFileName");
const clearChecksumButton = $("clearChecksum");

const generateButton = $("generateButton");
const verifyButton = $("verifyButton");
const cancelButton = $("cancelButton");

const errorMessage = $("errorMessage");
const progressContainer = $("progressContainer");
const progressLabel = $("progressLabel");
const progressPercent = $("progressPercent");
const progressBar = $("progressBar");
const progressFill = $("progressFill");

const resultsSection = $("resultsSection");
const resultsSummary = $("resultsSummary");
const resultsBody = $("resultsBody");
const exportTxtButton = $("exportTxt");
const exportCsvButton = $("exportCsv");
const clearResultsButton = $("clearResults");

let selectedFiles = [];
let results = [];
let checksumEntries = [];
let checksumFilename = "";
let worker = null;
let operationId = 0;
let processing = false;
let cancelRequested = false;

function formatBytes(bytes) {
    if (bytes === 0) return "0 bytes";

    const units = ["bytes", "KiB", "MiB", "GiB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0)} ${units[index]}`;
}

function normalizeHash(value) {
    return value.replace(/\s+/g, "").toLowerCase();
}

function selectedAlgorithms() {
    return [...document.querySelectorAll('input[name="algorithm"]:checked')]
        .map(input => input.value);
}

function detectAlgorithm(hash) {
    const length = hash.length;

    return Object.keys(ALGORITHMS).find(
        algorithm => ALGORITHMS[algorithm].length === length
    ) || null;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function clearError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
}

function setProgress(percent, message) {
    const value = Math.max(0, Math.min(100, percent));

    progressContainer.classList.remove("hidden");
    progressLabel.textContent = message;
    progressPercent.textContent = `${Math.round(value)}%`;
    progressFill.style.width = `${value}%`;
    progressBar.setAttribute("aria-valuenow", String(Math.round(value)));
}

function hideProgress() {
    progressContainer.classList.add("hidden");
    progressFill.style.width = "0%";
}

function setProcessing(value) {
    processing = value;

    generateButton.disabled = value;
    verifyButton.disabled = value;
    clearFilesButton.disabled = value;
    fileInput.disabled = value;
    checksumFileInput.disabled = value;

    cancelButton.classList.toggle("hidden", !value);
    dropZone.setAttribute("aria-disabled", String(value));

    document.querySelectorAll('input[name="algorithm"]').forEach(input => {
        input.disabled = value;
    });
}

function clearResults() {
    results = [];
    resultsBody.replaceChildren();
    resultsSection.classList.add("hidden");
}

function invalidateResults() {
    clearResults();
    hideProgress();
}

function renderFiles() {
    fileList.replaceChildren();

    fileArea.classList.toggle("hidden", selectedFiles.length === 0);
    dropZone.classList.toggle("is-compact", selectedFiles.length > 0);

    fileCount.textContent =
        `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`;

    selectedFiles.forEach((file, index) => {
        const row = document.createElement("div");
        row.className = "file-row";

        const symbol = document.createElement("div");
        symbol.className = "file-symbol";
        const dot = file.name.lastIndexOf(".");
        symbol.textContent = dot > 0 && dot < file.name.length - 1
            ? file.name.slice(dot + 1, dot + 5).toUpperCase()
            : "FILE";

        const main = document.createElement("div");
        main.className = "file-row-main";

        const name = document.createElement("div");
        name.className = "file-row-name";
        name.textContent = file.name;

        const meta = document.createElement("div");
        meta.className = "file-row-meta";
        meta.textContent = formatBytes(file.size);

        main.append(name, meta);

        const remove = document.createElement("button");
        remove.className = "file-remove";
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${file.name}`);

        remove.addEventListener("click", () => {
            if (processing) return;

            selectedFiles.splice(index, 1);
            invalidateResults();
            renderFiles();
        });

        row.append(symbol, main, remove);
        fileList.append(row);
    });
}

function addFiles(fileCollection) {
    if (processing) return;

    clearError();

    const incoming = Array.from(fileCollection || []);
    const valid = [];
    const rejected = [];

    for (const file of incoming) {
        if (file.size > MAX_FILE_SIZE) {
            rejected.push(`${file.name} (${formatBytes(file.size)})`);
        } else {
            valid.push(file);
        }
    }

    if (rejected.length) {
        showError(
            "These files exceed the 100 MiB limit and were not added: " +
            rejected.join(", ")
        );
    }

    const existing = new Set(
        selectedFiles.map(file => `${file.name}\0${file.size}\0${file.lastModified}`)
    );

    for (const file of valid) {
        const key = `${file.name}\0${file.size}\0${file.lastModified}`;

        if (!existing.has(key)) {
            selectedFiles.push(file);
            existing.add(key);
        }
    }

    invalidateResults();
    renderFiles();
}

function clearFiles() {
    if (processing) return;

    selectedFiles = [];
    fileInput.value = "";
    invalidateResults();
    renderFiles();
    clearError();
}

dropZone.addEventListener("click", () => {
    if (!processing) fileInput.click();
});

dropZone.addEventListener("keydown", event => {
    if (!processing && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        fileInput.click();
    }
});

fileInput.addEventListener("change", event => {
    addFiles(event.target.files);
    fileInput.value = "";
});

dropZone.addEventListener("dragover", event => {
    event.preventDefault();
    if (!processing) dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", event => {
    if (!dropZone.contains(event.relatedTarget)) {
        dropZone.classList.remove("drag-over");
    }
});

dropZone.addEventListener("drop", event => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");

    if (!processing) addFiles(event.dataTransfer.files);
});

clearFilesButton.addEventListener("click", clearFiles);

document.querySelectorAll('input[name="algorithm"]').forEach(input => {
    input.addEventListener("change", () => {
        if (!processing) invalidateResults();
    });
});

expectedHashInput.addEventListener("input", () => {
    if (!processing) invalidateResults();
});

clearChecksumButton.addEventListener("click", () => {
    if (processing) return;

    expectedHashInput.value = "";
    checksumEntries = [];
    checksumFilename = "";
    checksumFileInput.value = "";
    checksumFileName.textContent = "SHA256SUMS, .sha256, .sha512, .sha1, or .txt";

    invalidateResults();
    clearError();
});

/*
 * Checksum file parsing:
 * supports lines such as:
 * HASH  filename.iso
 * HASH *filename.iso
 * filename.iso: HASH
 * SHA256 (filename.iso) = HASH   (BSD / OpenSSL style)
 * Bare hashes are also accepted.
 */
function parseChecksumFile(text, sourceName) {
    const entries = [];
    const lines = text.split(/\r?\n/);

    const sourceExtension = sourceName.toLowerCase();

    let forcedAlgorithm = null;

    if (sourceExtension.endsWith(".sha1")) forcedAlgorithm = "SHA-1";
    if (sourceExtension.endsWith(".sha256")) forcedAlgorithm = "SHA-256";
    if (sourceExtension.endsWith(".sha384")) forcedAlgorithm = "SHA-384";
    if (sourceExtension.endsWith(".sha512")) forcedAlgorithm = "SHA-512";

    for (const rawLine of lines) {
        let line = rawLine.trim();

        if (!line || line.startsWith("#")) continue;

        const bsd = line.match(/^SHA-?(?:1|256|384|512)\s*\((.+)\)\s*=\s*([a-fA-F0-9]+)$/i);
        if (bsd) line = `${bsd[2]}  ${bsd[1]}`;

        let hash = "";
        let filename = "";

        let match = line.match(/^([a-fA-F0-9]{40}|[a-fA-F0-9]{64}|[a-fA-F0-9]{96}|[a-fA-F0-9]{128})\s+\*?(.+)$/);

        if (match) {
            hash = match[1];
            filename = match[2].trim();
        } else {
            match = line.match(/^(.+?):\s*([a-fA-F0-9]{40}|[a-fA-F0-9]{64}|[a-fA-F0-9]{96}|[a-fA-F0-9]{128})$/);

            if (match) {
                filename = match[1].trim();
                hash = match[2];
            } else {
                match = line.match(/^([a-fA-F0-9]{40}|[a-fA-F0-9]{64}|[a-fA-F0-9]{96}|[a-fA-F0-9]{128})$/);

                if (match) {
                    hash = match[1];
                } else {
                    continue;
                }
            }
        }

        hash = normalizeHash(hash);

        const algorithm = detectAlgorithm(hash);

        if (!algorithm) continue;

        if (forcedAlgorithm && algorithm !== forcedAlgorithm) {
            continue;
        }

        entries.push({
            algorithm,
            hash,
            filename: filename || null
        });
    }

    return entries;
}

checksumFileInput.addEventListener("change", async event => {
    if (processing) return;

    const file = event.target.files?.[0];

    if (!file) return;

    clearError();

    if (file.size > 2 * 1024 * 1024) {
        showError("Checksum files must be 2 MiB or smaller.");
        checksumFileInput.value = "";
        return;
    }

    try {
        const text = await file.text();
        const entries = parseChecksumFile(text, file.name);

        if (!entries.length) {
            showError(
                "No supported SHA-1, SHA-256, SHA-384 or SHA-512 checksum " +
                "entries were found in this file."
            );

            checksumFileInput.value = "";
            return;
        }

        checksumEntries = entries;
        checksumFilename = file.name;
        checksumFileName.textContent =
            `${file.name}: ${entries.length} checksum${entries.length === 1 ? "" : "s"} loaded`;

        expectedHashInput.value = entries.length === 1 ? entries[0].hash : "";

        invalidateResults();
    } catch {
        showError("Could not read the checksum file.");
    }
});

function findExpectedHash(file, algorithm) {
    const manual = normalizeHash(expectedHashInput.value);

    if (manual) {
        const manualAlgorithm = detectAlgorithm(manual);

        if (manualAlgorithm === algorithm) {
            return manual;
        }
    }

    const matchingEntries = checksumEntries.filter(entry => {
        if (entry.algorithm !== algorithm) return false;

        if (!entry.filename) {
            return checksumEntries.length === 1;
        }

        return entry.filename === file.name ||
            entry.filename.split(/[\\/]/).pop() === file.name;
    });

    return matchingEntries[0]?.hash || null;
}

let rejectActive = null;

function createWorker() {
    if (!window.Worker) return null;

    try {
        return new Worker("worker.js");
    } catch {
        // Some browsers refuse workers on file:// pages; hash on the main thread instead.
        return null;
    }
}

function toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function hashOnMainThread(file, algorithms, onProgress) {
    onProgress(10, "Reading file...");
    const buffer = await file.arrayBuffer();
    const hashes = {};

    for (let index = 0; index < algorithms.length; index++) {
        onProgress(50 + (index / algorithms.length) * 45, `Calculating ${algorithms[index]}...`);
        await new Promise(resolve => setTimeout(resolve));
        hashes[algorithms[index]] = toHex(await crypto.subtle.digest(algorithms[index], buffer));
    }

    return hashes;
}

function hashFile(file, algorithms, id, onProgress) {
    const currentWorker = worker;

    if (!currentWorker) {
        return hashOnMainThread(file, algorithms, onProgress);
    }

    return new Promise((resolve, reject) => {
        const onMessage = event => {
            const message = event.data;

            if (message.id !== id) return;

            if (message.type === "progress") onProgress(message.percent, message.message);

            if (message.type === "complete") {
                cleanup();
                resolve(message.results);
            }

            if (message.type === "error") {
                cleanup();
                reject(new Error(message.message));
            }
        };

        const onError = () => {
            cleanup();
            reject(new Error("The hashing worker encountered an error."));
        };

        function cleanup() {
            rejectActive = null;
            currentWorker.removeEventListener("message", onMessage);
            currentWorker.removeEventListener("error", onError);
        }

        rejectActive = () => {
            cleanup();
            reject(new Error("Cancelled."));
        };

        currentWorker.addEventListener("message", onMessage);
        currentWorker.addEventListener("error", onError);
        currentWorker.postMessage({ type: "hash", id, file, algorithms });
    });
}

function addResultRow(result) {
    const row = document.createElement("tr");
    row.className = result.statusClass;

    const fileCell = document.createElement("td");
    fileCell.textContent = result.fileName;

    const algorithmCell = document.createElement("td");
    algorithmCell.textContent = result.algorithm;

    const hashCell = document.createElement("td");

    const hashValue = document.createElement("code");
    hashValue.className = "hash-value";
    for (const chunk of result.hash.match(/.{1,8}/g) || []) {
        const group = document.createElement("span");
        group.textContent = chunk;
        hashValue.append(group);
    }

    hashCell.append(hashValue);

    if (result.statusClass === "mismatch" && result.expectedHash) {
        const expected = document.createElement("div");
        expected.className = "hash-expected";
        expected.append("Expected");

        const expectedValue = document.createElement("code");
        expectedValue.textContent = result.expectedHash;

        expected.append(expectedValue);
        hashCell.append(expected);
    }

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status ${result.statusClass}`;
    status.textContent = result.status;
    statusCell.append(status);

    const copyCell = document.createElement("td");
    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.type = "button";
    copyButton.textContent = "Copy";

    copyButton.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(result.hash);
            copyButton.textContent = "Copied!";
            setTimeout(() => copyButton.textContent = "Copy", 1200);
        } catch {
            showError("Clipboard access was unavailable. Select and copy the hash manually.");
        }
    });

    copyCell.append(copyButton);
    row.append(fileCell, algorithmCell, hashCell, statusCell, copyCell);
    resultsBody.append(row);
}

function renderResults() {
    resultsBody.replaceChildren();

    for (const result of results) {
        addResultRow(result);
    }

    const fileTotal = new Set(results.map(result => result.fileName)).size;
    const matched = results.filter(result => result.statusClass === "match").length;
    const mismatched = results.filter(result => result.statusClass === "mismatch").length;

    let summary =
        `${results.length} hash${results.length === 1 ? "" : "es"} for ` +
        `${fileTotal} file${fileTotal === 1 ? "" : "s"}`;

    if (matched || mismatched) {
        summary += `: ${matched} matched, ${mismatched} did not match`;
    }

    resultsSummary.textContent = `${summary}.`;

    resultsSection.classList.toggle("hidden", results.length === 0);
}

async function runHashing(mode) {
    if (processing) return;

    clearError();

    if (!selectedFiles.length) {
        showError("Please select at least one file.");
        return;
    }

    const algorithms = selectedAlgorithms();
    const typed = normalizeHash(expectedHashInput.value);

    if (typed) {
        const detected = /^[a-f0-9]+$/.test(typed) ? detectAlgorithm(typed) : null;

        if (!detected) {
            showError(
                "The checksum you entered is not a valid SHA-1, SHA-256, SHA-384 or SHA-512 value. " +
                "It must contain only hexadecimal characters and be 40, 64, 96 or 128 characters long."
            );
            return;
        }

        if (!algorithms.includes(detected)) {
            algorithms.push(detected);
            const box = document.querySelector(`input[name="algorithm"][value="${detected}"]`);
            if (box) box.checked = true;
        }
    }

    if (!algorithms.length) {
        showError("Select at least one hash algorithm.");
        return;
    }

    if (mode === "verify") {
        const hasManual = normalizeHash(expectedHashInput.value).length > 0;
        const hasImported = checksumEntries.length > 0;

        if (!hasManual && !hasImported) {
            showError(
                "Enter a publisher checksum or import a checksum file. " +
                "Hash generation works without either."
            );
            return;
        }
    }

    if (!crypto?.subtle) {
        showError(
            "Web Crypto is unavailable. Run this site through localhost or HTTPS."
        );
        return;
    }

    operationId++;
    const thisOperation = operationId;

    cancelRequested = false;
    results = [];
    renderResults();

    setProcessing(true);
    setProgress(0, "Preparing...");
    
    try {
        worker = createWorker();

        for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex++) {
            if (cancelRequested || thisOperation !== operationId) break;

            const file = selectedFiles[fileIndex];

            setProgress(
                (fileIndex / selectedFiles.length) * 100,
                `Processing ${file.name} (${fileIndex + 1}/${selectedFiles.length})`
            );

            const hashes = await hashFile(file, algorithms, thisOperation, (percent, text) => {
                setProgress(
                    ((fileIndex + percent / 100) / selectedFiles.length) * 100,
                    `${file.name}: ${text}`
                );
            });

            if (cancelRequested || thisOperation !== operationId) break;

            for (const algorithm of algorithms) {
                const hash = hashes[algorithm];

                const expected = findExpectedHash(file, algorithm);

                let status = "Generated";
                let statusClass = "pending";

                if (expected) {
                    if (hash === expected) {
                        status = "Match";
                        statusClass = "match";
                    } else {
                        status = "Mismatch";
                        statusClass = "mismatch";
                    }
                }

                results.push({
                    fileName: file.name,
                    fileSize: file.size,
                    algorithm,
                    hash,
                    expectedHash: expected || "",
                    status,
                    statusClass
                });
            }

            renderResults();
        }

        if (!cancelRequested && thisOperation === operationId) {
            setProgress(100, "Processing complete.");
        }
    } catch (error) {
        if (!cancelRequested) {
            console.error(error);
            showError(error.message || "Hashing failed.");
        }
    } finally {
        if (worker) {
            worker.terminate();
            worker = null;
        }

        if (thisOperation === operationId) {
            setProcessing(false);
        }
    }
}

generateButton.addEventListener("click", () => runHashing("generate"));
verifyButton.addEventListener("click", () => runHashing("verify"));

cancelButton.addEventListener("click", () => {
    if (!processing) return;

    cancelRequested = true;
    operationId++;

    if (rejectActive) rejectActive();

    if (worker) {
        worker.terminate();
        worker = null;
    }

    setProcessing(false);
    setProgress(0, "Cancelled. Results completed so far are kept.");
});

clearResultsButton.addEventListener("click", () => {
    if (processing) return;
    clearResults();
    hideProgress();
    clearError();
});

/*
 * Report exports
 */

function escapeCsv(value) {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

exportTxtButton.addEventListener("click", () => {
    if (!results.length) {
        showError("Generate at least one hash before exporting.");
        return;
    }

    const lines = [
        "HashLab File Integrity Report",
        "=============================",
        `Generated: ${new Date().toISOString()}`,
        `Checksum source: ${checksumFilename || "Manual input or none"}`,
        ""
    ];

    for (const result of results) {
        lines.push(
            `File: ${result.fileName}`,
            `Size: ${formatBytes(result.fileSize)}`,
            `Algorithm: ${result.algorithm}`,
            `Hash: ${result.hash}`,
            `Expected: ${result.expectedHash || "Not provided"}`,
            `Status: ${result.status}`,
            ""
        );
    }

    lines.push(
        "Note: A matching digest does not independently prove publisher identity or file safety."
    );

    downloadFile("hashlab-report.txt", lines.join("\n"), "text/plain;charset=utf-8");
});

exportCsvButton.addEventListener("click", () => {
    if (!results.length) {
        showError("Generate at least one hash before exporting.");
        return;
    }

    const rows = [
        [
            "File",
            "Size Bytes",
            "Algorithm",
            "Hash",
            "Expected Hash",
            "Verification"
        ]
    ];

    for (const result of results) {
        rows.push([
            result.fileName,
            result.fileSize,
            result.algorithm,
            result.hash,
            result.expectedHash,
            result.status
        ]);
    }

    const csv = rows.map(row => row.map(escapeCsv).join(",")).join("\r\n");

    downloadFile("hashlab-report.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
});

/*
 * Initial state
 */

renderFiles();
renderResults();
setProcessing(false);
hideProgress();
clearError();

/*
 * Browser capability indicators
 */

function renderEnvironment() {
    const envStatus = $("envStatus");
    if (!envStatus) return;

    const checks = [
        ["Web Crypto", Boolean(window.crypto?.subtle), "available", "unavailable"],
        ["Web Worker", Boolean(window.Worker), "available", "unavailable, using main thread"],
        ["Context", window.isSecureContext, "secure", "not secure"]
    ];

    envStatus.replaceChildren(...checks.map(([label, ok, yes, no]) => {
        const item = document.createElement("li");
        item.className = `env-item ${ok ? "ok" : "warn"}`;
        item.textContent = `${label}: ${ok ? yes : no}`;
        return item;
    }));
}

renderEnvironment();
