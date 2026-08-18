import io
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

# 1. Configurações para economizar memória RAM
os.environ["OMP_NUM_THREADS"] = "1"  # Limita o uso de threads paralelas
os.environ["MALLOC_TRIM_THRESHOLD_"] = "0"  # Força a liberação agressiva de memória

# 2. Carrega o modelo durante o startup para evitar crash silencioso
model: YOLO | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
  global model
  model = YOLO("yolov8n.pt", task="detect")
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
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
