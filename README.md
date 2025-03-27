# X Download

A browser extension that helps you download videos from X/Twitter with a single click. This extension automatically detects video content on X/Twitter and provides an easy way to download them.

## Features

- **Seamless Integration**: Automatically detects videos on X/Twitter
- **One-Click Download**: Download videos with a single click
- **Format Options**: Download in various quality options when available
- **Download History**: Keep track of your downloaded videos
- **Privacy-Focused**: No data collection, runs entirely in your browser

## Installation

### From Source

1. Clone this repository
```bash
git clone https://github.com/yourusername/x-download.git
cd x-download
```

2. Install dependencies
```bash
npm install
```

3. Build the extension
```bash
npm run build
```

4. Load the extension in your browser:
   - Chrome: Go to `chrome://extensions/`, enable Developer mode, and click "Load unpacked". Select the `dist` folder.
   - Firefox: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select the manifest.json file in the `dist` folder.

## Development

```bash
# Start development server with hot-reload
npm run dev

# Build for production
npm run build
```

## Usage

1. Install the extension
2. Navigate to X/Twitter
3. When you encounter a video, a download button will appear
4. Click the button to download the video
5. The video will be saved to your default downloads folder

## Technologies

- JavaScript
- Chrome Extension API
- Vite.js (for bundling)

## License

MIT License

## Acknowledgements

This project was inspired by the need to save and share interesting content from X/Twitter. 