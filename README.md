# HashLab

HashLab is a browser-based tool for generating file hashes and verifying downloads against a publisher's checksum. It has no backend, no account and no dependencies: files are read and hashed locally with the Web Crypto API.

## Features

- SHA-1, SHA-256, SHA-384 and SHA-512, for one file or a whole batch.
- Verification is optional. Leave the checksum empty to only generate hashes.
- Paste a checksum or import a checksum file. Each result is marked `Match`, `Mismatch` or `Generated`, and a mismatch shows the expected value beside the computed one.
- Hashing runs in a Web Worker so the interface stays responsive. If workers are unavailable, hashing falls back to the main thread.
- Copy individual hashes, or export a TXT or CSV report.
- Block-explorer style dark interface: digests are grouped in 8-character blocks for easy comparison, and live indicators show Web Crypto, Web Worker and secure-context support.
- Keyboard accessible, with no external fonts, scripts or network requests.

## Quick start

HashLab is a static site. Serve the folder locally (recommended, because workers and Web Crypto are most reliable on `localhost` or HTTPS):

| Platform | Command |
| --- | --- |
| Windows | Double-click `start.bat` |
| macOS / Linux | `./start.sh` |
| Any | `python3 -m http.server 8000 --bind 127.0.0.1` |

Then open <http://localhost:8000>. The launchers bind to the loopback interface only, so the folder is not exposed to your network.

## Usage

**Generate hashes.** Add one or more files, choose the algorithms and select **Generate hashes**.

**Verify a download.** Add the file, paste the publisher's checksum or import a checksum file, and select **Verify checksum**.

- The algorithm is detected from the checksum length and selected for you if needed.
- A checksum that is not valid hexadecimal, or not 40, 64, 96 or 128 characters long, is rejected with an explanation.
- A single pasted checksum is compared with every selected file. To verify several files at once, import a checksum list that includes filenames.

### Supported checksum formats

```text
0123456789abcdef0123456789abcdef01234567  example.zip
0123456789abcdef0123456789abcdef01234567 *example.zip
example.zip: 0123456789abcdef0123456789abcdef01234567
SHA256 (example.zip) = 0123456789abcdef...   (BSD / OpenSSL style)
0123456789abcdef0123456789abcdef01234567     (bare hash)
```

Files named `*.sha1`, `*.sha256`, `*.sha384` and `*.sha512` are only matched against that algorithm. Checksum files can be up to 2 MiB.

| Algorithm | Hex length |
| --- | --- |
| SHA-1 | 40 |
| SHA-256 | 64 |
| SHA-384 | 96 |
| SHA-512 | 128 |

## Privacy and security

- Files never leave your device. The project contains no upload code, analytics or third-party requests.
- Results live in page memory until you clear them or reload.
- CSV exports neutralise cells that begin with `=`, `+`, `-` or `@`, so a hostile filename cannot run as a spreadsheet formula.
- A matching checksum shows only that a file is identical to the one the checksum describes. It does not show who published the checksum or that the file is safe. Take checksums from a source you trust, ideally a different channel from the download.
- SHA-1 is included for older downloads. It is no longer collision resistant.

## Limitations

Web Crypto cannot hash a stream, so each file is read into memory before hashing. Files are limited to 100 MiB to keep memory use predictable. Checksum import covers the common formats above, not every vendor-specific format.

## Project structure

```text
index.html   Application markup
style.css    Interface styling
script.js    UI logic, checksum parsing, verification, exports
worker.js    Background hashing (Web Crypto)
favicon.svg  Site icon
start.bat    Windows launcher
start.sh     macOS / Linux launcher
```

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. Selected-algorithm highlighting uses the CSS `:has()` selector and degrades gracefully where it is unsupported.

## License

MIT. See [LICENSE](LICENSE).
