import io
import os
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

# 1. Configurações para economizar memória RAM
os.environ["OMP_NUM_THREADS"] = "1"  # Limita o uso de threads paralelas paralela
os.environ["MALLOC_TRIM_THRESHOLD_"] = "0"  # Força a liberação agressiva de memória

app = FastAPI(title="Multi-Object Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Carrega a versão mais leve do modelo (YOLOv8 Nano)
# Passamos o argumento 'fuse=False' para evitar processos pesados de compilação na RAM
model = YOLO("yolov8n.pt", task="detect")

@app.get("/")
def home():
    return {"status": "API online! Envie um POST para /detect"}

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Reduz o tamanho da imagem antes de passar pela IA se ela for muito grande
        # Imagens gigantescas estouram a memória RAM no processamento
        image.thumbnail((640, 640))
        
        # Executa a inferência desativando recursos pesados que consomem memória
        results = model.predict(image, imgsz=640, verbose=False, device="cpu")
        
        detected_items = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy.tolist()
                detected_items.append({
                    "label": model.names[int(box.cls)],
                    "confidence": round(float(box.conf), 2),
                    "box": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
                })
                
        return {"items": detected_items}
        
    except Exception as e:
        return {"error": str(e)}, 500
