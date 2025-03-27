#!/Users/nishantvyas/.pyenv/versions/3.9.6/bin/python3
import json
import sys
import struct
import yt_dlp
import os
import logging
import traceback
from pathlib import Path
from urllib.parse import urlparse, urljoin

# Set up logging with more detailed format
logging.basicConfig(
    level=logging.DEBUG,
    filename=os.path.join(os.path.dirname(os.path.realpath(__file__)), 'native_host.log'),
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)

def normalize_twitter_url(url):
    """Normalize Twitter/X URL to ensure it works with yt-dlp."""
    try:
        logging.info(f"Normalizing URL: {url}")
        parsed = urlparse(url)
        
        # Ensure we're using twitter.com instead of x.com
        if parsed.netloc == 'x.com':
            url = url.replace('x.com', 'twitter.com')
        
        # Remove any tracking parameters
        if '?' in url:
            url = url.split('?')[0]
        
        # Ensure URL starts with https://
        if not url.startswith('http'):
            url = 'https://' + url
        
        logging.info(f"Normalized URL: {url}")
        return url
    except Exception as e:
        logging.error(f"Error normalizing URL: {str(e)}")
        return url

def get_message():
    """Read a message from stdin and decode it."""
    try:
        raw_length = sys.stdin.buffer.read(4)
        if not raw_length:
            logging.warning("No message length received")
            return None
        message_length = struct.unpack('=I', raw_length)[0]
        logging.debug(f"Reading message of length: {message_length}")
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        logging.debug(f"Received raw message: {message}")
        return json.loads(message)
    except Exception as e:
        logging.error(f"Error reading message: {str(e)}\n{traceback.format_exc()}")
        return None

def send_message(message_content):
    """Encode and send a message to stdout."""
    try:
        logging.debug(f"Sending message: {message_content}")
        encoded_content = json.dumps(message_content).encode('utf-8')
        encoded_length = struct.pack('=I', len(encoded_content))
        sys.stdout.buffer.write(encoded_length)
        sys.stdout.buffer.write(encoded_content)
        sys.stdout.buffer.flush()
        logging.debug("Message sent successfully")
    except Exception as e:
        logging.error(f"Error sending message: {str(e)}\n{traceback.format_exc()}")
        # Try to send error message
        try:
            error_msg = json.dumps({'success': False, 'error': str(e)}).encode('utf-8')
            error_len = struct.pack('=I', len(error_msg))
            sys.stdout.buffer.write(error_len)
            sys.stdout.buffer.write(error_msg)
            sys.stdout.buffer.flush()
        except:
            pass

def download_video(url, output_dir):
    """Download video using yt-dlp."""
    try:
        logging.info(f"Starting download for URL: {url}")
        normalized_url = normalize_twitter_url(url)
        logging.info(f"Using normalized URL: {normalized_url}")
        
        ydl_opts = {
            'format': 'best',
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
            'verbose': True,
            'logger': logging.getLogger('yt-dlp'),
            'cookiesfrombrowser': ('chrome',),  # Try to use Chrome cookies
            'socket_timeout': 30,
        }
        
        logging.info(f"Using yt-dlp options: {ydl_opts}")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logging.info("Extracting video info...")
            try:
                info = ydl.extract_info(normalized_url, download=True)
                if not info:
                    raise Exception("No video information extracted")
                logging.info(f"Download completed. Video info: {info.get('title')}")
                
                return {
                    'success': True,
                    'title': info.get('title', 'Unknown'),
                    'filename': ydl.prepare_filename(info)
                }
            except Exception as e:
                logging.error(f"yt-dlp error: {str(e)}\n{traceback.format_exc()}")
                raise
    except Exception as e:
        logging.error(f"Error downloading video: {str(e)}\n{traceback.format_exc()}")
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """Main function to handle native messaging."""
    try:
        # Create downloads directory if it doesn't exist
        downloads_dir = os.path.join(str(Path.home()), 'Downloads', 'x_downloads')
        os.makedirs(downloads_dir, exist_ok=True)
        
        logging.info("Native host started")
        logging.info(f"Downloads directory: {downloads_dir}")
        
        while True:
            try:
                message = get_message()
                if message is None:
                    logging.info("No more messages, exiting")
                    break
                
                logging.info(f"Received message: {message}")
                
                if 'url' in message:
                    result = download_video(message['url'], downloads_dir)
                    send_message(result)
                else:
                    logging.warning("No URL provided in message")
                    send_message({'success': False, 'error': 'No URL provided'})
            except Exception as e:
                logging.error(f"Error processing message: {str(e)}\n{traceback.format_exc()}")
                send_message({'success': False, 'error': str(e)})
                
    except Exception as e:
        logging.error(f"Fatal error: {str(e)}\n{traceback.format_exc()}")
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        logging.error(f"Uncaught exception: {str(e)}\n{traceback.format_exc()}")
        sys.exit(1) 