# Multi-Object Detector

A full-stack web application for detecting multiple objects in images using YOLOv8. Upload or provide a URL to an image, and the app will identify and visualize all detected objects with confidence scores.

## Features

- 🖼️ **Image Upload**: Upload images directly or provide a URL
- 🎯 **Object Detection**: Uses YOLOv8 nano model for fast, accurate detection
- 📊 **Visual Results**: Interactive visualization with clickable detection dots
- 🔍 **Confidence Scores**: See detection confidence percentages for each object
- ✂️ **Crop Tool**: Crop detected objects from the image
- 🔧 **Configurable API**: Switch between local and remote API endpoints
- 🌐 **CORS Enabled**: Backend supports cross-origin requests
- 💾 **Memory Efficient**: Optimized for minimal RAM usage

## Project Structure

```
multi-object-detector/
├── app.py                 # FastAPI backend server
├── requirements.txt       # Python dependencies
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
  apiUrl: "https://multi-object-detector.onrender.com/detect",  // API endpoint
  apiFileField: "file",                                          // Form field name
  maxFileSizeBytes: 10 * 1024 * 1024,                           // Max file size (10 MB)
  galleryImages: [...],                                          // Sample images
  loadingMessage: "Detecting objects…",                          // Loading text
  dotSizePx: 22,                                                 // Detection dot size
  boxStrokeStyle: "rgba(255,255,255,0.9)",                      // Box color
  boxLineWidth: 2,                                               // Box line width
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
      "label": "person",
      "confidence": 0.95,
      "box": [x1, y1, x2, y2]
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
  "status": "API online! Envie um POST para /detect"
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

The default deployment URL is available at: `https://multi-object-detector.onrender.com`

## Usage Guide

1. **Open the app** in your browser
2. **Choose an image source**:
   - Click "Browse" to upload a file
   - Enter an image URL and click "Search"
   - Select from the gallery of sample images
3. **Wait for detection** to complete (the spinner shows progress)
4. **Interact with results**:
   - Click on detection dots to select and highlight objects
   - Use the "Crop" button to crop the selected detection
5. **Start a new search** using the "New Search" button

## Performance Tips

- Keep images under 640x640 pixels for faster processing
- The app automatically resizes large images
- CPU inference is optimized for speed with minimal RAM usage
- First detection may be slower (model loading)

## Troubleshooting

**"Could not reach the detection API"**
- Verify the Python server is running
- Check the API URL in the frontend configuration
- Ensure CORS is not blocked (should be enabled by default)

**"File exceeds the limit"**
- Reduce image file size
- Modify `maxFileSizeBytes` in frontend config or upload size limit in backend

**Model download fails**
- YOLOv8 model is downloaded on first run (~6 MB)
- Requires internet connection for initial setup
- Model is cached locally for subsequent runs

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.
