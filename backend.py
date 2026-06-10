import cv2
import numpy as np
import asyncio
import mss
import os
import threading
import time
from flask import Flask, jsonify
from flask_cors import CORS
import keyboard
import sys
import io

# Force UTF-8 Encoding for Windows console stability with special characters
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

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

# Global Shared Tracker State
# Global Shared Tracker State
healing_data = {
    "healing": 0,
    "timer_running": False,
    "start_time": 0.0,
    "accumulated_time": 0.0,
    "edit_mode": False  # <-- Added for Alt+8 tracking
}



ocr_engine = OcrEngine.try_create_from_user_profile_languages()
TEMP_IMAGE_PATH = os.path.abspath("temp_ocr_capture.png")

# --- FLASK APP ENGINE ---
app = Flask(__name__)
CORS(app)  # Enable CORS for Overwolf React app communication

# --- CORE TRACKER FUNCTIONS ---
# These manage core data safely whether triggered via hotkey or React UI action

def core_toggle_timer():
    """Modifies state timer data without handling HTTP context."""
    if healing_data["timer_running"]:
        healing_data["accumulated_time"] += (time.time() - healing_data["start_time"])
        healing_data["timer_running"] = False
        print("[Core] Timer paused.")
        return "paused"
    else:
        healing_data["start_time"] = time.time()
        healing_data["timer_running"] = True
        print("[Core] Timer started.")
        return "running"

def core_reset_stats():
    """Modifies state clearing data without handling HTTP context."""
    healing_data["timer_running"] = False
    healing_data["start_time"] = 0.0
    healing_data["accumulated_time"] = 0.0
    healing_data["healing"] = 0
    print("[Core] Stats reset executed.")

def core_toggle_edit_mode():
    """Modifies state window lock data without handling HTTP context."""
    healing_data["edit_mode"] = not healing_data["edit_mode"]
    print(f"[Core] Edit/Move mode changed: {healing_data['edit_mode']}")
    return healing_data["edit_mode"]


# --- FLASK API ENDPOINTS ---

@app.route('/api/healing', methods=['GET'])
@app.route('/api/healing', methods=['GET'])
def get_healing_data():
    """Return current healing stats (Polled continuously by React UI)"""
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
        "timer_running": healing_data["timer_running"],
        "edit_mode": healing_data["edit_mode"]  # <-- Pass it down to React here!
    })

@app.route('/api/timer/toggle', methods=['POST'])
def api_toggle_timer():
    """Toggle the timer via React interface call"""
    status = core_toggle_timer()
    return jsonify({"status": status})

@app.route('/api/stats/reset', methods=['POST'])
def api_reset_stats():
    """Reset all stats via React interface call"""
    core_reset_stats()
    return jsonify({"status": "reset"})

@app.route('/api/edit/toggle', methods=['POST'])
def api_toggle_edit():
    """Toggle edit mode via React interface call"""
    current_status = core_toggle_edit_mode()
    return jsonify({"edit_mode": current_status})


# --- OCR LOGIC ---

async def recognize_text(image_path):
    """Perform OCR on the captured image using Windows Native Runtime SDK"""
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
    """Continuously capture screen"""
    global healing_data, should_perform_ocr
    
    with mss.MSS() as sct:
        while True:
            try:
                screenshot = sct.grab(HEALING_BOX)
                img = np.array(screenshot)
                
                # Check if we should perform OCR
                time.sleep(0.05)
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


            except Exception as e:
                print(f"Capture error: {e}")
                time.sleep(0.5)


# --- BACKGROUND KEYBOARD LISTENER ---

def setup_backend_hotkeys():
    """Setup global hotkeys safely mapped without causing Context runtime crashes"""


    # Correctly route to tracking functions instead of returning JSON responses directly
    hotkey_combinations = [
        ('alt+plus', core_toggle_timer, 'Alt+Plus (Toggle Timer)'),
        ('alt+-', core_reset_stats, 'Alt+Minus (Reset Stats)'),
        ('alt+8', core_toggle_edit_mode, 'Alt+8 (Toggle Grid Move)'), # <-- Added
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
        print(f"\n⚠ Warning: {failed_keys} hotkey(s) failed. Admin privileges may be required.")
        print("  Try running terminal or application wrapper as Administrator.")
    else:
        print("\n✓ All engine hardware hotkeys registered successfully!")


# --- START SERVICE APPLICATION ---

if __name__ == "__main__":
    print("Starting Marvel Rivals Healing Tracker Backend...")
    print(f"Healing box region bound to screen canvas coordinates: {HEALING_BOX}")
    
    # 1. Spin up asynchronous screen capture scanner 
    capture_thread = threading.Thread(target=continuous_capture_loop, daemon=True)
    capture_thread.start()
    print("OCR capture thread started")
    
    # 2. Register low level OS keyboard state bindings
    setup_backend_hotkeys()
    
    # 3. Spin up main synchronous pipeline web server execution loop
    print("Starting Flask server on http://localhost:5000")
    app.run(host='localhost', port=5000, debug=False, use_reloader=False)
    