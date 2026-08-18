import io
import json
import streamlit as st
from PIL import Image
from ultralytics import YOLO
import tornado.web

# 1. Inicializa o modelo de IA e guarda em memória cache para performance
@st.cache_resource
def load_model():
    # Carrega a versão 'nano' do YOLOv8, ideal para servidores gratuitos
    return YOLO("yolov8n.pt")

model = load_model()

# 2. Roteador Tornado para escutar e processar chamadas de API HTTP
class DetectHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        # Desativa a barreira de CORS para que qualquer site JS consulte sua API
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with, content-type")
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def options(self):
        self.set_status(204)
        self.finish()

    def post(self):
        try:
            # Captura o arquivo de imagem enviado sob o parâmetro 'file'
            file_data = self.request.files['file'][0]
            image_bytes = file_data['body']
            
            # Processa e converte os bytes na imagem original
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            # Executa a inteligência artificial para detectar os objetos
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
            
            # Devolve a resposta estruturada em JSON para o front-end
            self.write(json.dumps({"items": detected_items}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

# 3. Hack inteligente para injetar nossa API dentro do servidor do Streamlit
try:
    import streamlit.web.server.routes as routes
    routes.get_routes = lambda original=routes.get_routes: original() + [
        (r"/detect", DetectHandler)
    ]
except Exception:
    pass

# Interface Visual padrão exigida pelo SDK do Streamlit para o container iniciar
st.title("Object Detection API Backend 🔍")
st.write("Servidor rodando com sucesso. Envie requisições POST para a rota `/detect` para processar imagens.")
