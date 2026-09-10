# Multi-Object Detector

A full-stack web application for detecting and searching clothing items in images using YOLOv8 and visual search. Upload or provide a URL to an image, and the app will identify clothing objects, visualize them with detection dots, and search for similar products using a visual search API.

## Features

- 🖼️ **Image Upload**: Upload images directly or provide a URL
- 🎯 **Object Detection**: Uses YOLOv8 (yoloe-26s-seg) for clothing detection
- 📊 **Visual Results**: Interactive visualization with clickable detection dots and bounding boxes
- 🔍 **Confidence Scores**: See detection confidence for each identified clothing item
- ✂️ **Crop Tool**: Crop detected objects and search within regions
- 🏷️ **Clothing Classification**: Detects specific clothing categories (shirts, pants, shoes, etc.)
- 🔧 **Configurable APIs**: Connect to custom detection and search endpoints
- 🌐 **CORS Enabled**: Backend supports cross-origin requests
- 💾 **Memory Efficient**: Optimized for minimal RAM usage
- 🎨 **Faceted Search**: Filter results by clothing attributes and price range

## Project Structure

```
multi-object-detector/
├── app.py                 # FastAPI backend server
├── dockerfile             # Docker configuration
├── requirements.txt       # Python dependencies
├── yoloe-26s-seg.pt      # Pre-trained YOLO model
└── front-end/
    ├── index.html        # Main HTML page
    ├── app.js            # Application logic
    └── style.css         # Styling
```

## Prerequisites

- **Python 3.8+** (for backend)
- **Node.js** (optional, if using a development server)
- **pip** (Python package manager)

## Installation

### Backend Setup

1. Clone or navigate to the project directory
2. Create a Python virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Frontend Setup

The frontend is a static HTML/CSS/JavaScript application and doesn't require installation. It will work once you serve the `front-end` folder.

## Running the Application

### Start the Backend Server

```bash
python app.py
```

The API will start on `http://localhost:8000`

### Serve the Frontend

You can serve the frontend using any static server:

**Using Python (built-in):**
```bash
cd front-end
python -m http.server 3000
```

**Using Node.js (http-server):**
```bash
cd front-end
npx http-server -p 3000
```

Then open your browser to `http://localhost:3000`

## Configuration

### Backend (app.py)

- **Port**: Set via `PORT` environment variable (default: 8000)
- **Memory Optimization**: Automatically configured for minimal RAM usage
- **CORS**: Enabled for all origins

### Frontend (front-end/app.js)

Edit the `CONFIG` object at the top of `app.js`:

```javascript
const CONFIG = {
  api: {
    detectUrl: "https://<YOUR_API_ENDPOINT>/detect",  // Detection API endpoint
    searchUrl: "https://direct.dy-api.com/v2/serve/user/search",            // DY Search API endpoint
    apiKey: 'your-api-key-here',                                            // API key for search
  },
  ui: {
    maxFileSizeBytes: 10 * 1024 * 1024,  // Max file size (10 MB)
    dotSizePx: 22,                       // Detection dot size
    boxStrokeStyle: "rgba(255,255,255,0.9)",  // Detection box color
    boxLineWidth: 2,                     // Detection box line width
    boxPaddingPx: 50,                    // Padding around detections for crop
    loadingMessage: "Loading…",          // Loading indicator text
  },
  gallery: {
    images: [...]  // Sample gallery images
  }
};
```

## API Documentation

### POST /detect

Detect objects in an image.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Parameter: `file` (image file)

**Response:**
```json
{
  "items": [
    {
      "label": "shirt",
      "confidence": 0.95,
      "box": [x1, y1, x2, y2],
      "display": true
    }
  ]
}
```

**Example using curl:**
```bash
curl -X POST -F "file=@image.jpg" http://localhost:8000/detect
```

### GET /

Health check endpoint.

**Response:**
```json
{
  "status": "API online",
  "endpoint": "/detect"
}
```

## Dependencies

### Backend
- **FastAPI**: Modern web framework
- **Uvicorn**: ASGI server
- **YOLOv8**: Object detection model (via ultralytics)
- **Pillow**: Image processing
- **python-multipart**: File upload support

### Frontend
- Pure HTML/CSS/JavaScript (no external libraries)

## Deployment

### Deploy to Google Cloud Run

The application is configured to run on Google Cloud Run:

```bash
# Build and deploy using Cloud Build
gcloud run deploy yoloe-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --memory 1Gi \
  --timeout 300 \
  --allow-unauthenticated
```

Update the frontend `detectUrl` in `app.js` with your Cloud Run service URL.

### Deploy to Render

1. Create a `render.yaml` file in the project root:
   ```yaml
   services:
     - type: web
       name: multi-object-detector
       env: python
       buildCommand: pip install -r requirements.txt
       startCommand: uvicorn app:app --host 0.0.0.0 --port $PORT
   ```

2. Connect your GitHub repository to Render
3. Deploy from the dashboard

## Usage Guide

1. **Open the app** in your browser
2. **Click the search button** (`.dy-image-search-btn`) to open the overlay
3. **Choose an image source**:
   - Click "Browse" to upload a file
   - Enter an image URL and click "Search"
   - Select from the gallery of sample images
4. **Wait for detection** to complete (the spinner shows progress)
5. **Interact with results**:
   - Click on detection dots to select and highlight objects with bounding boxes
   - Use the "Crop" button to crop and search within detected regions
   - Apply filters using the facet panel on the left
6. **Sort results** using the dropdown (Most Similar, Price: High to Low, Price: Low to High)
7. **Close** the overlay by clicking the close button or clicking outside the overlay

## Performance Tips

- Keep images under 640x640 pixels for faster processing
- The app automatically resizes large images
- CPU inference is optimized for speed with minimal RAM usage
- First detection may be slower (model loading)

## Troubleshooting

**"Detect API failed" message but search results still show**
- This is expected behavior. The app gracefully handles detection API failures and continues with search results
- Check that the `detectUrl` is correctly configured in `app.js`
- Verify the detection API is running and accessible

**"Search failed" message**
- Verify the `searchUrl` and `apiKey` are correctly configured in `app.js`
- Check your API key has valid credentials and quota
- Ensure CORS is not blocked (should be enabled by default)

**"File exceeds the limit"**
- Reduce image file size or modify `maxFileSizeBytes` in frontend config

**Model file not found (yoloe-26s-seg.pt)**
- Place the pre-trained model file in the project root directory
- The model file is ~50 MB and contains the clothing detection weights
- Ensure the filename matches exactly in `app.py`

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.
