# Local LLM Setup for Electron - Court Document Summarization

## Quick Start with Transformers.js

### Installation

```bash
npm install @xenova/transformers
npm install --save-dev @types/node
```

### Basic Implementation

```typescript
// electron/ai/summarizer.ts
import { pipeline, env } from "@xenova/transformers";

// Configure model cache location
env.cacheDir = "./models";
env.allowLocalModels = true;
env.allowRemoteModels = true;

export class LegalDocumentAI {
  private summarizer: any;
  private classifier: any;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    // Load models (downloads on first run, ~250MB each)
    this.summarizer = await pipeline(
      "summarization",
      "Xenova/distilbart-cnn-6-6"
    );

    this.classifier = await pipeline(
      "text-classification",
      "Xenova/bert-base-uncased"
    );

    this.initialized = true;
  }

  async summarizeDocument(text: string, maxLength = 100): Promise<string> {
    const chunks = this.chunkText(text, 1024);
    const summaries = await Promise.all(
      chunks.map((chunk) =>
        this.summarizer(chunk, {
          max_length: maxLength,
          min_length: 30,
          do_sample: false,
        })
      )
    );

    return summaries.map((s) => s[0].summary_text).join(" ");
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
```

### Electron Integration

```typescript
// electron/main.ts
import { ipcMain } from "electron";
import { LegalDocumentAI } from "./ai/summarizer";

const ai = new LegalDocumentAI();

// Initialize on app ready
app.whenReady().then(async () => {
  await ai.initialize();
});

// IPC handlers
ipcMain.handle("ai:summarize", async (_, text: string) => {
  return await ai.summarizeDocument(text);
});

ipcMain.handle("ai:process-court-doc", async (_, pdfData: any) => {
  const summary = await ai.summarizeDocument(pdfData.text, 150);

  return {
    summary,
    // Combine with regex extraction
    ...extractCourtDocumentInfo(pdfData.text, pdfData.filename),
  };
});
```

### React Component

```typescript
// src/components/DocumentProcessor.tsx
const DocumentProcessor: React.FC = () => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const processPDF = async (file: File) => {
    setLoading(true);

    // Extract text
    const text = await extractTextFromPDF(file);

    // Get AI summary
    const result = await window.electronAPI.processCourtDoc({
      text,
      filename: file.name,
    });

    setSummary(result.summary);
    setLoading(false);
  };

  return <div>{loading ? <p>AI Processing...</p> : <div>{summary}</div>}</div>;
};
```

## Fine-Tuning for UK Court Documents

### 1. Data Preparation

```python
# prepare_training_data.py
import json
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("facebook/bart-base")

def prepare_court_data(documents):
    training_data = []

    for doc in documents:
        # Extract key sections
        entry = {
            "text": doc["full_text"],
            "summary": f"Case {doc['case_number']}: {doc['order_type']} dated {doc['date']}. {doc['key_ruling']}",
            "labels": {
                "document_type": doc["type"],
                "has_children": doc["involves_children"],
                "urgency": doc["is_urgent"]
            }
        }
        training_data.append(entry)

    return training_data

# Save as JSONL
with open('court_training.jsonl', 'w') as f:
    for item in training_data:
        f.write(json.dumps(item) + '\n')
```

### 2. Fine-Tuning Script

```python
# finetune_legal_model.py
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments
)
import torch

model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")
tokenizer = AutoTokenizer.from_pretrained("facebook/bart-base")

# Training arguments optimized for small dataset
training_args = TrainingArguments(
    output_dir="./legal-bart-finetuned",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    warmup_steps=500,
    weight_decay=0.01,
    logging_dir="./logs",
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    greater_is_better=False,
)

# Train
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    tokenizer=tokenizer,
)

trainer.train()
```

### 3. Convert to ONNX for Electron

```python
# convert_to_onnx.py
from transformers import AutoModel
import torch

model = AutoModel.from_pretrained("./legal-bart-finetuned")
dummy_input = torch.randint(0, 1000, (1, 512))

torch.onnx.export(
    model,
    dummy_input,
    "legal-summarizer.onnx",
    export_params=True,
    opset_version=14,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={
        'input': {0: 'batch_size', 1: 'sequence'},
        'output': {0: 'batch_size', 1: 'sequence'}
    }
)
```

### 4. Optimized Electron Implementation

```typescript
// electron/ai/optimizedSummarizer.ts
import * as ort from "onnxruntime-node";
import { BertTokenizer } from "bert-tokenizer";

export class OptimizedLegalAI {
  private session: ort.InferenceSession;
  private tokenizer: BertTokenizer;

  async initialize() {
    this.session = await ort.InferenceSession.create(
      "./models/legal-summarizer.onnx",
      {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
      }
    );

    this.tokenizer = new BertTokenizer("./models/vocab.txt");
  }

  async summarize(text: string): Promise<string> {
    // Tokenize
    const tokens = this.tokenizer.tokenize(text);
    const inputTensor = new ort.Tensor("int64", tokens, [1, tokens.length]);

    // Run inference
    const outputs = await this.session.run({ input: inputTensor });

    // Decode
    return this.tokenizer.decode(outputs.output.data);
  }
}
```

## Performance Optimization

```typescript
// electron/ai/aiManager.ts
export class AIManager {
  private modelCache = new Map<string, any>();
  private processingQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  async queueSummarization(text: string): Promise<string> {
    return new Promise((resolve) => {
      this.processingQueue.push(async () => {
        const result = await this.summarize(text);
        resolve(result);
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    while (this.processingQueue.length > 0) {
      const task = this.processingQueue.shift();
      await task();
    }
    this.isProcessing = false;
  }

  // Cache summaries for identical documents
  private summaryCache = new LRUCache<string, string>({ max: 100 });

  async summarize(text: string): Promise<string> {
    const hash = crypto.createHash("md5").update(text).digest("hex");

    if (this.summaryCache.has(hash)) {
      return this.summaryCache.get(hash);
    }

    const summary = await this.model.summarize(text);
    this.summaryCache.set(hash, summary);

    return summary;
  }
}
```

## Model Selection Guide

| Model              | Size  | Speed   | Quality | Use Case              |
| ------------------ | ----- | ------- | ------- | --------------------- |
| distilbart-cnn-6-6 | 250MB | Fast    | Good    | General summarization |
| legal-led-base     | 400MB | Medium  | Better  | Legal documents       |
| tinyllama-1.1b-q4  | 550MB | Slow    | Best    | Complex analysis      |
| minilm-l6-v2       | 90MB  | Instant | Basic   | Quick extraction      |

## Deployment Configuration

```javascript
// electron-builder.json
{
  "extraResources": [
    {
      "from": "models/",
      "to": "models/",
      "filter": ["*.onnx", "vocab.txt"]
    }
  ],
  "mac": {
    "entitlements": "./entitlements.mac.plist",
    "entitlementsInherit": "./entitlements.mac.plist"
  }
}
```

```xml
<!-- entitlements.mac.plist -->
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
```
