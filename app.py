import io
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

# 1. Inicializa o FastAPI
app = FastAPI(title="Multi-Object Detection API")

# Ativa o CORS para que seu JavaScript front-end possa consultar a API sem bloqueios
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Carrega o modelo leve do YOLOv8
model = YOLO("yolov8n.pt")

@app.get("/")
def home():
    return {"status": "API online! Envie um POST para /detect"}

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    try:
        # Lê os bytes da imagem enviada pelo front-end
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Executa a inteligência artificial
        results = model(image)
        
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
