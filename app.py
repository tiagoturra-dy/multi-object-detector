import io
import os
import logging
import warnings
from contextlib import asynccontextmanager
import torch

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Reduce verbosity of multipart parser
logging.getLogger("python_multipart").setLevel(logging.WARNING)

# Suppress torch.jit.load deprecation warning
warnings.filterwarnings("ignore", category=FutureWarning, message=".*torch.jit.load.*")

# Patch torch.load BEFORE importing ultralytics (PyTorch 2.6+ security requirement)
_original_torch_load = torch.load
def patched_torch_load(f, *args, **kwargs):
  kwargs['weights_only'] = False
  return _original_torch_load(f, *args, **kwargs)
torch.load = patched_torch_load

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLOE

# ============================================================================
# CONFIGURATION - All settings in one place
# ============================================================================
CONFIG = {
  # Model settings
  "model_name": "yoloe-26s-seg.pt",
  "model_input_size": 640,
  
  # Detection parameters
  "confidence_threshold": 0.3,  # Lower = more detections
  "iou_threshold": 0.4,          # Lower = more aggressive duplicate suppression
  
  # Clothing classes to detect
  "clothing_classes": [
      "shirt", "t-shirt", "tank top", "blouse", "sweater", "hoodie", "vest", "crop top", "tube top",
      "pants", "jeans", "shorts", "skirt", "sweatpants", "leggings", "overalls",
      "dress", "jumpsuit", "swimsuit", "romper", "kimono",
      "shoes", "sneakers", "boots", "sandals", "heels", "socks",
      "hat", "cap", "beanie", "helmet",
      "glasses", "belt", "tie", "scarf", "gloves", 
      "handbag", "purse", "watch", "necklace",
      "jacket", "coat", "suit jacket", "blazer", "cardigan", "raincoat", "fleece", "puffer jacket",
      "tights", "poncho", "shawl"
  ]
}

# Optimize memory usage
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MALLOC_TRIM_THRESHOLD_"] = "0"

# Global model instance
model = None
device = "cpu"

@asynccontextmanager
async def lifespan(app: FastAPI):
  global model, device
  
  device = "cuda" if torch.cuda.is_available() else "cpu"
  print(f"Using device: {device}")
  
  print(f"Loading YOLO model: {CONFIG['model_name']}")
  try:
    model = YOLOE(CONFIG["model_name"])
    print(f"✓ Model loaded successfully!")
    print(f"  Detection conf: {CONFIG['confidence_threshold']}, IOU: {CONFIG['iou_threshold']}")
    
    # Filter to clothing classes once at startup (not per-request)
    model.set_classes(CONFIG["clothing_classes"])
    print("✓ Clothing filter applied")
    
    # Warmup inference to compile model and initialize GPU
    warmup_image = Image.new("RGB", (640, 640), color="white")
    model.predict(warmup_image, imgsz=640, verbose=False, device=device, conf=CONFIG["confidence_threshold"], iou=CONFIG["iou_threshold"])
    print("✓ Warmup complete - first real request will be fast")
    
  except Exception as e:
    logger.error(f"Failed to load model: {e}", exc_info=True)
    raise
  
  yield

app = FastAPI(title="Multi-Object Detection API", lifespan=lifespan)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/")
def home():
  return {"status": "API online", "endpoint": "/detect"}

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
  try:
    logger.info(f"Processing file: {file.filename}")
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    detected_items = []
    
    # Run inference
    results = model.predict(
      image,
      imgsz=CONFIG["model_input_size"],
      verbose=False,
      device=device,
      conf=CONFIG["confidence_threshold"],
      iou=CONFIG["iou_threshold"]
    )
    
    # Collect all detections
    for result in results:
      for box in result.boxes:
        class_id = int(box.cls)
        class_name = model.names[class_id]
        confidence = float(box.conf)
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        
        detected_items.append({
          "label": class_name,
          "confidence": round(confidence, 2),
          "box": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
          "display": True
        })
    
    # Filter duplicates: hide lower-confidence detections with same label
    for i, item_i in enumerate(detected_items):
      for j, item_j in enumerate(detected_items):
        if i != j and item_j["label"] == item_i["label"] and item_j["confidence"] > item_i["confidence"]:
          detected_items[i]["display"] = False
          break
    
    shown = sum(1 for item in detected_items if item['display'])
    logger.info(f"Detected {len(detected_items)} items ({shown} shown after filtering)")
    
    return {"items": detected_items}

  except Exception as e:
    error_msg = f"Error processing image: {str(e)}"
    logger.error(error_msg, exc_info=True)
    raise HTTPException(status_code=500, detail=error_msg)


if __name__ == "__main__":
  import uvicorn
  port = int(os.environ.get("PORT", 8080))
  print(f"Starting server on port {port}")
  uvicorn.run(app, host="0.0.0.0", port=port)
