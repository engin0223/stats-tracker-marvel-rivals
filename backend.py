import cv2
import numpy as np
import asyncio
import mss
import os
import threading
import time
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import keyboard

# --- NATIVE WINDOWS OCR IMPORTS ---
from winsdk.windows.media.ocr import OcrEngine
from winsdk.windows.storage import StorageFile
from winsdk.windows.graphics.imaging import BitmapDecoder

# --- CONFIGURATION ---
HEALING_BOX = {"top": 730, "left": 910, "width": 150, "height": 50}

# TEXT COLOR CONFIGURATION (Set to White)
TARGET_COLOR_LOWER = np.array([200, 200, 200, 255])
TARGET_COLOR_UPPER = np.array([255, 255, 255, 255])
MIN_COLOR_PIXELS = 15

# Global state
healing_data = {
    "healing": 0,
    "timer_running": False,
    "start_time": 0.0,
    "accumulated_time": 0.0
}

# OCR trigger flag
should_perform_ocr = False

ocr_engine = OcrEngine.try_create_from_user_profile_languages()
TEMP_IMAGE_PATH = os.path.abspath("temp_ocr_capture.png")

# --- FLASK APP ---
app = Flask(__name__)
CORS(app)  # Enable CORS for Overwolf app

# --- API ENDPOINTS ---

@app.route('/api/healing', methods=['GET'])
def get_healing_data():
    """Return current healing stats"""
    total_elapsed = healing_data["accumulated_time"]
    if healing_data["timer_running"]:
        total_elapsed += (time.time() - healing_data["start_time"])
    
    hpm = 0
    if total_elapsed > 0:
        elapsed_mins = total_elapsed / 60.0
        hpm = int(healing_data["healing"] / elapsed_mins) if elapsed_mins > 0 else 0
    
    return jsonify({
        "healing": healing_data["healing"],
        "elapsed_time": int(total_elapsed),
        "hpm": hpm,
        "timer_running": healing_data["timer_running"]
    })

@app.route('/api/timer/toggle', methods=['POST'])
def toggle_timer():
    """Toggle the timer"""
    if healing_data["timer_running"]:
        healing_data["accumulated_time"] += (time.time() - healing_data["start_time"])
        healing_data["timer_running"] = False
        return jsonify({"status": "paused"})
    else:
        healing_data["start_time"] = time.time()
        healing_data["timer_running"] = True
        return jsonify({"status": "running"})

@app.route('/api/stats/reset', methods=['POST'])
def reset_stats():
    """Reset all stats"""
    healing_data["timer_running"] = False
    healing_data["start_time"] = 0.0
    healing_data["accumulated_time"] = 0.0
    healing_data["healing"] = 0
    print("Stats reset!")
    return jsonify({"status": "reset"})

# --- OCR LOGIC ---

async def recognize_text(image_path):
    """Perform OCR on the captured image"""
    try:
        file = await StorageFile.get_file_from_path_async(image_path)
        stream = await file.open_read_async()
        decoder = await BitmapDecoder.create_async(stream)
        bitmap = await decoder.get_software_bitmap_async()
        result = await ocr_engine.recognize_async(bitmap)
        return result.text
    except Exception as e:
        print(f"OCR Error: {e}")
        return ""

def continuous_capture_loop():
    """Continuously capture screen, but only OCR when Tab is pressed"""
    global healing_data, should_perform_ocr
    
    with mss.MSS() as sct:
        while True:
            try:
                screenshot = sct.grab(HEALING_BOX)
                img = np.array(screenshot)
                
                # Check if we should perform OCR
                if should_perform_ocr:
                    # Check if text color matches white
                    mask = cv2.inRange(img, TARGET_COLOR_LOWER, TARGET_COLOR_UPPER)
                    matching_pixels = cv2.countNonZero(mask)
                    
                    if matching_pixels > MIN_COLOR_PIXELS:
                        cv2.imwrite(TEMP_IMAGE_PATH, img)
                        text = asyncio.run(recognize_text(TEMP_IMAGE_PATH))
                        
                        # Extract only digits
                        clean_value = "".join(filter(str.isdigit, text))
                        if clean_value:
                            new_value = int(clean_value)
                            if new_value != healing_data["healing"]:
                                healing_data["healing"] = new_value
                                print(f"Healing updated: {new_value}")
                        else:
                            print("No digits found in OCR text")
                    else:
                        print("No white text detected in healing region")
                    
                    # Reset the flag after processing
                    should_perform_ocr = False
                    time.sleep(0.5)
                else:
                    time.sleep(0.05)
            except Exception as e:
                print(f"Capture error: {e}")
                time.sleep(0.5)

def setup_backend_hotkeys():
    """Setup global hotkeys for the backend (these work outside the Overwolf app)"""
    global should_perform_ocr
    
    def trigger_ocr():
        global should_perform_ocr
        should_perform_ocr = True
        print("✓ Tab pressed - scanning healing value...")
    
    hotkey_combinations = [
        ('tab', trigger_ocr, 'Tab'),
        ('shift+plus', lambda: toggle_timer(), 'Shift+Plus (Toggle Timer)'),
        ('shift+minus', lambda: reset_stats(), 'Shift+Minus (Reset Stats)'),
    ]
    
    failed_keys = []
    
    for key_combo, callback, description in hotkey_combinations:
        try:
            keyboard.add_hotkey(key_combo, callback)
            print(f"✓ Registered: {description}")
        except Exception as e:
            print(f"✗ Failed to register {description}: {e}")
            failed_keys.append(description)
    
    if failed_keys:
        print(f"\n⚠ Warning: {len(failed_keys)} hotkey(s) failed. Hotkeys may require admin privileges.")
        print("  Run PowerShell as Administrator and try again.")
        print(f"  Failed: {', '.join(failed_keys)}")
    else:
        print("\n✓ All hotkeys registered successfully!")

# --- START BACKEND ---

if __name__ == "__main__":
    print("Starting Marvel Rivals Healing Tracker Backend...")
    print(f"Healing box region: {HEALING_BOX}")
    
    # Start OCR capture thread
    capture_thread = threading.Thread(target=continuous_capture_loop, daemon=True)
    capture_thread.start()
    print("OCR capture thread started")
    
    # Setup hotkeys (these are for standalone use)
    setup_backend_hotkeys()
    
    # Start Flask server
    print("Starting Flask server on http://localhost:5000")
    app.run(host='localhost', port=5000, debug=False, use_reloader=False)
