
import io
import json
from functools import lru_cache
from pathlib import Path

import torch
from PIL import Image
from torchvision import models, transforms

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


@lru_cache(maxsize=1)
def load_plant_model():
    """Load and cache the plant model once."""

    with open(
        MODEL_DIR / "plantnet300K_species_id_2_name.json",
        encoding="utf-8"
    ) as file:
        species_names = json.load(file)

    with open(
        MODEL_DIR / "class_idx_to_species_id.json",
        encoding="utf-8"
    ) as file:
        class_mapping = json.load(file)

    assert len(class_mapping) == 1081

    model = models.mobilenet_v3_small(
        weights=None,
        num_classes=1081
    )

    weights = torch.load(
        MODEL_DIR / "mobilenetv3_small_v2.pth",
        map_location="cpu",
        weights_only=True
    )

    model.load_state_dict(weights)
    model.to(device)
    model.eval()

    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])

    return model, preprocess, species_names, class_mapping


def classify_plant(image_bytes):
    """Return top five predictions for image bytes."""

    model, preprocess, species_names, mapping = (
        load_plant_model()
    )

    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    tensor = preprocess(image).unsqueeze(0).to(device)

    with torch.inference_mode():
        output = model(tensor)
        probabilities = torch.softmax(output[0], dim=0)

    top_scores, top_indices = torch.topk(
        probabilities, 5
    )

    predictions = []

    for score, index in zip(top_scores, top_indices):
        species_id = str(mapping[str(index.item())])
        name = species_names[species_id]

        predictions.append({
            "species": name,
            "score": round(score.item(), 4)
        })

    return {
        "predictions": predictions,
        "device": str(device),
        "warning": (
            "Possible matches only. Not verified identification. "
            "Do not use predictions to determine whether a "
            "plant is edible or safe to touch."
        )
    }
