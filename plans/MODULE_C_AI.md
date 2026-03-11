# 模块 C：AI 能力

> 负责人：成员 C  
> 技术栈：Python, 音频处理, Live2D

---

## 模块概述

负责视听能力实现：
- ASR（语音识别）
- TTS（语音合成）
- Live2D 动作映射
- VtuberExtension 整合

---

## Sprint 1 任务（第1-4周）

### C1: ASR Provider 实现

**时间**：第1周（16小时）

**任务清单**：

```
- [ ] 创建 ASR Provider 接口
- [ ] 实现 WhisperASRProvider
- [ ] 音频格式处理
- [ ] 错误处理
- [ ] 性能优化
```

**文件结构**：

```
nanobot/extensions/vtuber/
├── __init__.py
├── asr.py          # ASR Provider
└── audio.py        # 音频工具
```

**代码骨架**：

```python
# nanobot/extensions/vtuber/asr.py

from abc import ABC, abstractmethod
import tempfile
from pathlib import Path

class ASRProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_data: bytes) -> str:
        """语音转文字"""
        pass

class WhisperASRProvider(ASRProvider):
    def __init__(self, model_size: str = "base", language: str = "zh"):
        self.model_size = model_size
        self.language = language
        self._model = None
    
    def _load_model(self):
        if self._model is None:
            import whisper
            self._model = whisper.load_model(self.model_size)
        return self._model
    
    async def transcribe(self, audio_data: bytes) -> str:
        import asyncio
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
        
        try:
            model = self._load_model()
            
            # 在线程池中运行
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: model.transcribe(temp_path, language=self.language)
            )
            
            return result.get("text", "")
        finally:
            Path(temp_path).unlink(missing_ok=True)
```

**AI 提示词**：

```
请实现 ASR Provider 模块，用于语音识别。

## 文件结构

nanobot/extensions/vtuber/
├── asr.py          # ASR Provider 类

## 功能要求

1. ASRProvider 抽象基类：
   - transcribe(audio_data: bytes) -> str
   - 异步接口

2. WhisperASRProvider 实现：
   - 使用 openai-whisper 库
   - 支持配置模型大小：tiny/base/small/medium/large
   - 支持配置语言（默认中文）
   - 模型懒加载
   - 在线程池中运行推理

3. 音频格式：
   - 输入：WAV 格式（16kHz, 16bit, mono）
   - 如果需要转换，使用 pydub

4. 错误处理：
   - 模型加载失败
   - 音频格式错误
   - 识别失败

## 使用示例

provider = WhisperASRProvider(model_size="base", language="zh")
with open("audio.wav", "rb") as f:
    text = await provider.transcribe(f.read())
print(text)  # "你好，世界"

请生成完整代码。
```

---

### C2: TTS Provider 实现

**时间**：第2周（12小时）

**任务清单**：

```
- [ ] 创建 TTS Provider 接口
- [ ] 实现 EdgeTTSProvider
- [ ] 音频格式处理
- [ ] 缓存机制
```

---

### C3: Live2D 动作映射

**时间**：第3周（16小时）

**任务清单**：

```
- [ ] 实现情绪识别
- [ ] 定义情绪-动作映射
- [ ] 生成 Live2D 指令
- [ ] 可配置映射表
```

**文件结构**：

```
nanobot/extensions/vtuber/
├── emotion.py      # 情绪识别
└── live2d.py       # Live2D 控制器
```

---

### C4: VtuberExtension 整合

**时间**：第4周（12小时）

**任务清单**：

```
- [ ] 创建 VtuberExtension 类
- [ ] 订阅 MessageBus 事件
- [ ] 处理语音输入流程
- [ ] 处理语音输出流程
- [ ] 与 DesktopChannel 协作
```

---

## Sprint 2 任务（第5-8周）

### C5: 性能优化

**时间**：第5-6周（16小时）

```
- [ ] ASR 推理加速
- [ ] TTS 缓存
- [ ] 流式响应
- [ ] 内存优化
```

### C6: 音质优化

**时间**：第7-8周（12小时）

```
- [ ] 延迟优化
- [ ] 音频处理优化
- [ ] 错误恢复
```

---

## Sprint 3 任务（第9-10周）

### C7: 内存对接

**时间**：第9周（8小时）

```
- [ ] 与 MemoryStore 对接
- [ ] 情绪状态持久化
```

---

## 技术参考

### Whisper 使用

```python
import whisper

model = whisper.load_model("base")
result = model.transcribe("audio.wav", language="zh")
print(result["text"])
```

### Edge-TTS 使用

```python
import edge_tts

communicate = edge_tts.Communicate("你好", "zh-CN-XiaoxiaoNeural")
await communicate.save("output.mp3")
```

### 情绪识别

```python
EMOTION_KEYWORDS = {
    "happy": ["开心", "高兴", "好的", "谢谢"],
    "sad": ["难过", "伤心", "抱歉"],
    "thinking": ["让我想想", "嗯...", "思考一下"],
    "greeting": ["你好", "早上好", "欢迎"],
}

def detect_emotion(text: str) -> str:
    for emotion, keywords in EMOTION_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return emotion
    return "neutral"
```

### Live2D 指令

```json
{
  "type": "action",
  "action": {
    "type": "motion",
    "name": "tap_body"
  }
}

{
  "type": "action",
  "action": {
    "type": "expression",
    "name": "f01"
  }
}
```
