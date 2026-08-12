import os
import shutil
import sys
from ultralytics import YOLO

def train():
    yaml_path = os.path.join(os.path.dirname(__file__), "home_data.yaml")
    output_model_path = os.path.join(os.path.dirname(__file__), "home_objects_best.pt")

    if not os.path.exists(yaml_path):
        print(f"Error: dataset config {yaml_path} not found.")
        return

    print("Loading base YOLOv8 model for home object fine-tuning...")
    model = YOLO("yolov8n.pt")

    print(f"Starting YOLOv8 training on Home Object dataset from {yaml_path}...")
    try:
        results = model.train(
            data=yaml_path,
            epochs=10,
            imgsz=416,
            batch=8,
            workers=2,
            project="runs/detect",
            name="home_objects_run",
            exist_ok=True
        )

        # Locate best trained weights
        best_pt = os.path.join("runs", "detect", "home_objects_run", "weights", "best.pt")
        if os.path.exists(best_pt):
            shutil.copy(best_pt, output_model_path)
            print(f"Successfully saved fine-tuned home object model to: {output_model_path}")
        else:
            print("Finished training. Exporting model weights...")
            model.export(format="torchscript")
            print(f"Trained model ready.")
    except Exception as e:
        print(f"Training exception occurred: {e}")

if __name__ == "__main__":
    train()
