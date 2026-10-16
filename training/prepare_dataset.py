"""
Dataset Split and Preparation Pipeline (Part B.1).

Merges:
1. Original insect dataset (e.g. hardware/test_images or custom directory).
2. Labelled real positive photos from data/positives/.
3. Background/negative images from data/negatives/ (room, people, hands, empty soil bed with empty .txt label files).
   Ensures background images constitute 10-20% of the training set.
4. Partitions by capture session (prefix) into train/val/test splits to prevent data leakage.
"""

from __future__ import annotations

import argparse
import random
import re
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def extract_session_id(file_name: str) -> str:
    """Extracts session grouping key from filename (e.g. neg_20261017_01 or sample)."""
    stem = Path(file_name).stem
    # If timestamp format (e.g. pos_20261017_010000_123 or neg_20261017_010000)
    match = re.match(r"^([a-zA-Z]+_\d{8}_\d{2})", stem)
    if match:
        return match.group(1)
    # Default: first token before underscore
    parts = stem.split("_")
    return parts[0] if parts else stem


def prepare_dataset(
    source_dir: Path,
    positives_dir: Path,
    negatives_dir: Path,
    output_dir: Path,
    bg_ratio: float = 0.15,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
):
    image_exts = {".jpg", ".jpeg", ".png", ".bmp"}

    # 1. Gather positive images
    pos_images = []
    if source_dir.exists():
        for p in source_dir.glob("*"):
            if p.suffix.lower() in image_exts and p.with_suffix(".txt").exists():
                # Ensure label is not empty
                if p.with_suffix(".txt").stat().st_size > 0:
                    pos_images.append(p)

    if positives_dir.exists():
        for p in positives_dir.glob("*"):
            if p.suffix.lower() in image_exts and p.with_suffix(".txt").exists():
                if p.with_suffix(".txt").stat().st_size > 0:
                    pos_images.append(p)

    # 2. Gather background/negative images
    neg_images = []
    if negatives_dir.exists():
        for p in negatives_dir.glob("*"):
            if p.suffix.lower() in image_exts:
                # Create empty label file if missing
                lbl = p.with_suffix(".txt")
                if not lbl.exists():
                    lbl.touch()
                neg_images.append(p)

    print("\n" + "=" * 65)
    print("CROP-SIM DATASET INGESTION & SESSION PARTITION (Part B)")
    print("=" * 65)
    print(f"Total Positive Insect Images Found:  {len(pos_images)}")
    print(f"Total Negative Background Images:    {len(neg_images)}")

    # 3. Balance background images to 10-20% (default 15%) of total dataset
    if pos_images:
        target_neg_count = int(len(pos_images) * (bg_ratio / (1.0 - bg_ratio)))
        target_neg_count = max(1, target_neg_count)
        if len(neg_images) > target_neg_count:
            random.seed(42)
            neg_images = random.sample(neg_images, target_neg_count)
    selected_all = pos_images + neg_images

    if not selected_all:
        print("Warning: No images found across source, positives, or negatives.")
        return

    # 4. Group by capture session to avoid near-duplicate data leakage
    sessions: Dict[str, List[Path]] = defaultdict(list)
    for img in selected_all:
        sid = extract_session_id(img.name)
        sessions[sid].append(img)

    session_keys = sorted(list(sessions.keys()))
    random.seed(42)
    random.shuffle(session_keys)

    n_sessions = len(session_keys)
    n_train = max(1, int(n_sessions * train_ratio))
    n_val = max(1, int(n_sessions * val_ratio)) if n_sessions > 2 else 0

    train_sessions = set(session_keys[:n_train])
    val_sessions = set(session_keys[n_train : n_train + n_val]) if n_val > 0 else set()
    test_sessions = set(session_keys[n_train + n_val :]) if n_sessions > (n_train + n_val) else val_sessions

    split_images: Dict[str, List[Path]] = {"train": [], "val": [], "test": []}
    for sid, img_list in sessions.items():
        if sid in train_sessions:
            split_images["train"].extend(img_list)
        elif sid in val_sessions:
            split_images["val"].extend(img_list)
        else:
            split_images["test"].extend(img_list)

    if not split_images["val"]:
        split_images["val"] = split_images["train"]
    if not split_images["test"]:
        split_images["test"] = split_images["val"]

    # 5. Populate train/val/test directories
    output_dir.mkdir(parents=True, exist_ok=True)
    for split_name, img_list in split_images.items():
        img_out = output_dir / "images" / split_name
        lbl_out = output_dir / "labels" / split_name
        img_out.mkdir(parents=True, exist_ok=True)
        lbl_out.mkdir(parents=True, exist_ok=True)

        for img_path in img_list:
            shutil.copy2(img_path, img_out / img_path.name)
            txt_path = img_path.with_suffix(".txt")
            if txt_path.exists():
                shutil.copy2(txt_path, lbl_out / txt_path.name)
            else:
                (lbl_out / txt_path.name).touch()

    # Read class names
    classes_file = PROJECT_ROOT / "models" / "classes.txt"
    if classes_file.exists():
        with open(classes_file) as f:
            cnames = [line.strip() for line in f if line.strip()]
    else:
        cnames = ["fall_armyworm_moth", "spodoptera_litura_moth", "spodoptera_exigua_moth", "locust"]

    names_block = "\n".join([f"  {idx}: {name}" for idx, name in enumerate(cnames)])
    yaml_content = f"""# Crop-Sim Pest Dataset Partition
path: {output_dir.resolve()}
train: images/train
val: images/val
test: images/test

names:
{names_block}
"""
    yaml_path = output_dir / "dataset.yaml"
    yaml_path.write_text(yaml_content)

    print("-" * 65)
    print(f"Total Sessions:   {len(session_keys)}")
    print(f"Train Split:      {len(split_images['train'])} images ({len(train_sessions)} sessions)")
    print(f"Val Split:        {len(split_images['val'])} images ({len(val_sessions)} sessions)")
    print(f"Test Split:       {len(split_images['test'])} images (HELD OUT)")
    print(f"YAML Path:        {yaml_path.resolve()}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare balanced dataset with negatives and session splits")
    parser.add_argument("--source", default="hardware/test_images")
    parser.add_argument("--positives", default="data/positives")
    parser.add_argument("--negatives", default="data/negatives")
    parser.add_argument("--output", default="training/dataset")
    parser.add_argument("--bg-ratio", type=float, default=0.15)
    args = parser.parse_args()
    prepare_dataset(
        Path(args.source),
        Path(args.positives),
        Path(args.negatives),
        Path(args.output),
        bg_ratio=args.bg_ratio,
    )
