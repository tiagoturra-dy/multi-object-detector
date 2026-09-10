# Use the official Ultralytics base image (contains all YOLOE requirements)
FROM ultralytics/ultralytics:latest

# Set the working directory inside the container
WORKDIR /app

# Copy all local project files into the container
COPY . /app

# Install extra server requirements if you have them
RUN pip install --no-cache-dir -r requirements.txt

# Cloud Run injects a custom $PORT variable at runtime
EXPOSE 8080

# Force PyTorch/YOLO to only use CPU to save memory inside Cloud Run
ENV CUDA_VISIBLE_DEVICES="-1"

# Run your server using the dynamic port GCP gives you
# CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
CMD ["python", "app.py"]
