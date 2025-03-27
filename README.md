# X Download Chrome Extension

A Chrome extension that allows you to easily download videos from X (formerly Twitter) with a single click.

## Features

- 🎥 One-click video downloads from X/Twitter
- 🔍 Automatically detects videos in your feed
- ⚡ High-quality video downloads using yt-dlp
- 🎯 Clean and intuitive interface
- 📱 Works with both X.com and Twitter.com
- 🔄 Real-time status updates and notifications

## Installation

### Chrome Extension

1. Clone this repository:
```bash
git clone https://github.com/yourusername/x_download.git
cd x_download
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` directory

### Native Host (Required for Video Downloads)

1. Install Python dependencies:
```bash
cd native_host
pip install -r requirements.txt
```

2. Install the native host:
```bash
python install_host.py
```

3. The native host will be installed in:
   - Windows: `%LOCALAPPDATA%\Google\Chrome\NativeMessagingHosts\`
   - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
   - Linux: `~/.config/google-chrome/NativeMessagingHosts/`

## Usage

1. Navigate to X.com or Twitter.com
2. Find a tweet with a video
3. Click the download button (↓) that appears in the tweet's action bar
4. The video will be downloaded to `~/Downloads/x_downloads/`

## Development

### Extension Structure

- `src/content/` - Content script that runs on X/Twitter pages
- `src/background/` - Background script for handling downloads
- `src/popup/` - Extension popup UI
- `native_host/` - Python-based native messaging host

### Building

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build
```

### Native Host Development

The native host uses yt-dlp to handle video downloads. The communication flow is:
1. Extension detects video and sends URL to native host
2. Native host downloads video using yt-dlp
3. Native host sends download status back to extension

## Troubleshooting

### Common Issues

1. **Native host not connecting**
   - Make sure Python and yt-dlp are installed
   - Reinstall the native host: `python native_host/install_host.py`
   - Check the logs in `native_host/native_host.log`

2. **Download button not appearing**
   - Refresh the page
   - Make sure you're on X.com or Twitter.com
   - Check if the video is in a supported format

3. **Downloads failing**
   - Check if yt-dlp is up to date: `pip install -U yt-dlp`
   - Verify you have write permissions in the downloads directory
   - Check Chrome's console for error messages

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for video downloading functionality
- Chrome Extension APIs
- Native Messaging API 