# OpenCV 人脸模型

本目录保存两份官方 OpenCV Zoo ONNX 模型：

- `face_detection_yunet_2023mar.onnx`：YuNet 人脸检测模型。
  官方来源：<https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx>
- `face_recognition_sface_2021dec.onnx`：SFace 人脸特征识别模型。
  官方来源：<https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx>

OpenCV Zoo 项目采用 Apache License 2.0；模型的具体许可仍以各官方上游目录中的说明为准。

这些模型仅在 Orange Pi 的板端人脸服务启用人脸身份功能时按需加载，不由浏览器、Web 服务或其他摄像头进程加载。
