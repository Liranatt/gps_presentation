# Visual GPS Localization - BGU Deep Learning Project

## Campus Image-to-GPS Regression for Localization and Navigation

**Authors:** Liran Attar & Tom Mimran  
**Institution:** Ben-Gurion University of the Negev  
**Department:** Computer Science • January 2026

---

## 🎯 View the Interactive Presentation

### **[👉 Click here to view the presentation](https://liranatt.github.io/gps_presentation/)**

---

## 📊 Project Overview

This project demonstrates a deep learning approach to visual geo-localization on the BGU campus. Using a 360° data collection strategy and an EfficientNet-B0 backbone, we achieve high-accuracy GPS coordinate prediction from images alone.

### Key Results
| Metric | Value |
|--------|-------|
| **Mean Error** | 5.24m |
| **Median Error** | 4.01m |
| **P75** | 5.35m |
| **P95** | 10.22m |
| **Within 10m** | 94.5% |
| **Within 20m** | 98.2% |

---

## 🔬 Methodology

### Data Collection Strategy
- **360° Rotation**: 4 photos per location (0°, 90°, 180°, 270°)
- **GPS Stabilization**: Wait for GPS signal to stabilize before capture
- **Dataset Size**: 3,646 images from BGU campus

### Model Architecture
- **Backbone**: EfficientNet-B0 (pretrained on ImageNet)
- **Head**: Custom regression MLP with LayerNorm and SiLU
- **Output**: Normalized GPS coordinates via ScaledSigmoid
- **Loss**: Haversine distance (great-circle distance in meters)

---

## 🛠️ Try the Demo

**[🤗 Hugging Face Demo](https://huggingface.co/spaces/liranatt/GPU_Modell_Liran_and_Tom)**

Upload a photo from BGU campus and get the predicted GPS coordinates!

---

**🌟 Star this repo if you found it helpful!**
