import os
import json
import random
import time
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim

# Set dataset path
DATASET_PATH = r"C:\Users\shaisty priya\Downloads\archive (7)"
TRAIN_DIR = os.path.join(DATASET_PATH, "Train")
TEST_DIR = os.path.join(DATASET_PATH, "Test")

OUTPUT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "currency_model.pth")
OUTPUT_CLASSES_PATH = os.path.join(os.path.dirname(__file__), "currency_classes.json")

CLASS_MAPPING = {
    "1Hundrednote": {"currency": "₹100 Indian Rupee Note", "value_text": "one hundred rupee note"},
    "2Hundrednote": {"currency": "₹200 Indian Rupee Note", "value_text": "two hundred rupee note"},
    "2Thousandnote": {"currency": "₹2000 Indian Rupee Note", "value_text": "two thousand rupee note"},
    "5Hundrednote": {"currency": "₹500 Indian Rupee Note", "value_text": "five hundred rupee note"},
    "Fiftynote": {"currency": "₹50 Indian Rupee Note", "value_text": "fifty rupee note"},
    "Tennote": {"currency": "₹10 Indian Rupee Note", "value_text": "ten rupee note"},
    "Twentynote": {"currency": "₹20 Indian Rupee Note", "value_text": "twenty rupee note"}
}

class CurrencyCNN(nn.Module):
    def __init__(self, num_classes=7):
        super(CurrencyCNN, self).__init__()
        self.conv1 = nn.Conv2d(3, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.conv4 = nn.Conv2d(128, 256, kernel_size=3, padding=1)
        self.bn4 = nn.BatchNorm2d(256)
        
        self.pool = nn.MaxPool2d(2, 2)
        self.dropout = nn.Dropout(0.3)
        self.fc1 = nn.Linear(256 * 8 * 8, 512)
        self.fc2 = nn.Linear(512, num_classes)

    def forward(self, x):
        x = self.pool(F.relu(self.bn1(self.conv1(x))))
        x = self.pool(F.relu(self.bn2(self.conv2(x))))
        x = self.pool(F.relu(self.bn3(self.conv3(x))))
        x = self.pool(F.relu(self.bn4(self.conv4(x))))
        x = x.view(x.size(0), -1)
        x = self.dropout(F.relu(self.fc1(x)))
        x = self.fc2(x)
        return x

def preprocess_image(img_path, img_size=(128, 128)):
    img = cv2.imread(img_path)
    if img is None:
        return None
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, img_size)
    img = img.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img = (img - mean) / std
    img = np.transpose(img, (2, 0, 1)) # HWC to CHW
    return img

def load_dataset_samples(dataset_dir, folder_list):
    samples = []
    for idx, folder in enumerate(folder_list):
        folder_path = os.path.join(dataset_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        for fname in os.listdir(folder_path):
            if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                fpath = os.path.join(folder_path, fname)
                samples.append((fpath, idx))
    return samples

def create_batches(samples, batch_size=16, shuffle=True):
    if shuffle:
        random.shuffle(samples)
    
    for i in range(0, len(samples), batch_size):
        batch_samples = samples[i:i+batch_size]
        imgs, labels = [], []
        for fpath, label in batch_samples:
            img_arr = preprocess_image(fpath)
            if img_arr is not None:
                imgs.append(img_arr)
                labels.append(label)
        if len(imgs) > 0:
            yield torch.tensor(np.array(imgs), dtype=torch.float32), torch.tensor(labels, dtype=torch.long)

def train():
    folders = sorted(list(CLASS_MAPPING.keys()))
    print(f"Detected classes ({len(folders)}): {folders}")
    
    train_samples = load_dataset_samples(TRAIN_DIR, folders)
    test_samples = load_dataset_samples(TEST_DIR, folders)
    
    print(f"Loaded {len(train_samples)} training samples and {len(test_samples)} testing samples.")
    
    if len(train_samples) == 0:
        print("Error: No training samples found!")
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")
    
    model = CurrencyCNN(num_classes=len(folders)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=7, gamma=0.5)

    epochs = 20
    best_acc = 0.0

    print("Starting Currency CNN Training...")
    start_t = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for X_batch, y_batch in create_batches(train_samples, batch_size=16, shuffle=True):
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * X_batch.size(0)
            _, preds = torch.max(outputs, 1)
            correct += torch.sum(preds == y_batch.data).item()
            total += X_batch.size(0)

        epoch_loss = running_loss / max(total, 1)
        epoch_acc = (correct / max(total, 1)) * 100.0
        scheduler.step()

        # Evaluate on test set
        model.eval()
        test_correct = 0
        test_total = 0
        with torch.no_grad():
            for X_test, y_test in create_batches(test_samples, batch_size=16, shuffle=False):
                X_test, y_test = X_test.to(device), y_test.to(device)
                outputs = model(X_test)
                _, preds = torch.max(outputs, 1)
                test_correct += torch.sum(preds == y_test.data).item()
                test_total += X_test.size(0)

        test_acc = (test_correct / max(test_total, 1)) * 100.0
        print(f"Epoch [{epoch}/{epochs}] - Train Loss: {epoch_loss:.4f} | Train Acc: {epoch_acc:.2f}% | Test Acc: {test_acc:.2f}%")

        if test_acc >= best_acc:
            best_acc = test_acc
            torch.save(model.state_dict(), OUTPUT_MODEL_PATH)

    print(f"\nTraining Complete in {time.time() - start_t:.2f}s! Best Test Accuracy: {best_acc:.2f}%")
    
    classes_meta = []
    for f in folders:
        meta = CLASS_MAPPING[f]
        meta["folder"] = f
        classes_meta.append(meta)

    with open(OUTPUT_CLASSES_PATH, "w") as f:
        json.dump(classes_meta, f, indent=2)
    
    print(f"Model saved to: {OUTPUT_MODEL_PATH}")
    print(f"Classes metadata saved to: {OUTPUT_CLASSES_PATH}")

if __name__ == "__main__":
    train()
