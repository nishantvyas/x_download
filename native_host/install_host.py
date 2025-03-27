#!/usr/bin/env python3
import os
import sys
import json
import shutil
from pathlib import Path

def get_chrome_native_messaging_dir():
    """Get the native messaging host directory for Chrome based on the OS."""
    if sys.platform.startswith('linux'):
        return os.path.join(str(Path.home()), '.config', 'google-chrome', 'NativeMessagingHosts')
    elif sys.platform == 'darwin':
        return os.path.join(str(Path.home()), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts')
    elif sys.platform == 'win32':
        return os.path.join(os.environ['LOCALAPPDATA'], 'Google', 'Chrome', 'NativeMessagingHosts')
    else:
        raise RuntimeError(f"Unsupported platform: {sys.platform}")

def main():
    """Install the native messaging host."""
    # Get the absolute path of the script directory
    script_dir = os.path.dirname(os.path.realpath(__file__))
    
    # Make the Python script executable
    downloader_path = os.path.join(script_dir, 'x_downloader.py')
    os.chmod(downloader_path, 0o755)
    
    # Create the native messaging directory if it doesn't exist
    native_messaging_dir = get_chrome_native_messaging_dir()
    os.makedirs(native_messaging_dir, exist_ok=True)
    
    # Update the manifest with the correct path
    manifest_path = os.path.join(script_dir, 'com.x_download.downloader.json')
    with open(manifest_path, 'r') as f:
        manifest = json.load(f)
    
    manifest['path'] = os.path.abspath(downloader_path)
    
    # Write the updated manifest to the native messaging directory
    target_manifest_path = os.path.join(native_messaging_dir, 'com.x_download.downloader.json')
    with open(target_manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"Native messaging host installed successfully at {target_manifest_path}")
    print(f"Python script location: {downloader_path}")

if __name__ == '__main__':
    main() 