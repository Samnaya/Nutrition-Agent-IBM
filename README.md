# 🥗 NutriBot — AI-Powered Nutrition Agent

An intelligent nutrition assistant built with **Python Flask** and **IBM Watsonx.ai Granite models**.  
Features include an AI chat interface, BMI/TDEE calculator, meal planner, food analyser, family profiles, dark mode, and full mobile responsiveness.

---

## 📸 Features

| Feature | Description |
|---|---|
| 🤖 AI Chat | Conversational nutrition advice powered by IBM Granite |
| 📊 Dashboard | BMI calculator + TDEE/calorie needs with Mifflin-St Jeor equation |
| 📅 Meal Planner | AI-generated 1–14 day personalised meal plans |
| 🔍 Food Analyser | Detailed macro/micro-nutrient analysis for any food |
| 👨‍👩‍👧 Family Profiles | Store and switch between individual family member profiles |
| 🌙 Dark Mode | System-aware theme toggle with persistent storage |
| 📱 Responsive | Bootstrap 5 mobile-first design |
| 🇮🇳 Indian Focus | ICMR standards, regional cuisine, local portion sizes |

---

## 🚀 Quick Start

### 1. Clone / Copy project files

```
Nutrition-Agent/
├── app.py                 ← Flask backend + AGENT_INSTRUCTIONS
├── .env.example           ← Copy to .env and fill credentials
├── requirements.txt
├── templates/
│   └── index.html         ← Single-page frontend
├── static/
│   ├── css/style.css
│   └── js/app.js
└── profiles/              ← Auto-created, stores family JSON
```

### 2. Create & activate a virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure credentials

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
IBM_API_KEY=your_ibm_cloud_api_key
IBM_PROJECT_ID=your_watsonx_project_id
IBM_WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
FLASK_SECRET_KEY=some_long_random_string
```

#### How to get IBM credentials

1. Log into [IBM Cloud](https://cloud.ibm.com)
2. Go to **Manage → Access (IAM) → API keys** → Create API key
3. Open [IBM Watsonx.ai](https://dataplatform.cloud.ibm.com/wx)
4. Create or open a **Project** → copy the Project ID from Settings

### 5. Run the application

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## ⚙️ Customising the Agent

Open [`app.py`](app.py) and edit the `AGENT_INSTRUCTIONS` string near the top of the file.

```python
AGENT_INSTRUCTIONS = """
You are NutriBot, a warm, expert AI nutrition assistant powered by IBM Granite.

PERSONA & TONE
- Friendly, encouraging, and science-backed.
...
"""
```

You can change:
- **Persona & tone** — make it clinical, casual, or motivational
- **Diet specialisations** — add keto, raw food, Ayurvedic, etc.
- **Safety rules** — stricter disclaimers, specific condition handling
- **Indian food preferences** — focus on a particular region/state
- **Response format** — adjust verbosity, structure, language

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a message to the AI agent |
| POST | `/api/chat/clear` | Clear conversation history |
| POST | `/api/bmi` | Calculate BMI |
| POST | `/api/tdee` | Calculate BMR/TDEE/calorie targets |
| POST | `/api/meal-plan` | Generate an AI meal plan |
| POST | `/api/analyze` | Analyse nutrition of a food |
| GET  | `/api/profiles` | List family profiles |
| POST | `/api/profiles` | Add a family member |
| DELETE | `/api/profiles/<id>` | Delete a profile |
| POST | `/api/profiles/activate/<id>` | Set active profile for AI context |
| GET  | `/api/active-profile` | Get current active profile |
| GET  | `/api/suggestions` | Get quick-prompt suggestions |
| GET  | `/api/health` | Backend / AI health status |

---

## 🐳 Production Deployment

### Option A — Gunicorn (Linux/Mac)

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option B — Docker

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t nutribot .
docker run -p 5000:5000 --env-file .env nutribot
```

### Option C — IBM Code Engine / Cloud Foundry

```bash
# IBM Code Engine (after ibmcloud login)
ibmcloud ce app create \
  --name nutribot \
  --image icr.io/your-namespace/nutribot:latest \
  --port 5000 \
  --env IBM_API_KEY=... \
  --env IBM_PROJECT_ID=... \
  --env FLASK_SECRET_KEY=...
```

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| flask | Web framework |
| python-dotenv | Load .env credentials |
| ibm-watsonx-ai | IBM Watsonx Granite SDK |
| requests | HTTP client |
| gunicorn | Production WSGI server |

---

## 🔒 Security Notes

- Never commit `.env` — add it to `.gitignore`
- Use a strong random `FLASK_SECRET_KEY` in production
- Set `FLASK_DEBUG=False` in production
- The `profiles/` directory contains personal data — restrict access in production

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ using IBM Watsonx.ai Granite + Flask*
