"""
╔══════════════════════════════════════════════════════════════════╗
║          AI-Powered Nutrition Agent — IBM Watsonx.ai             ║
║          Built with Flask + IBM Granite Models                   ║
╚══════════════════════════════════════════════════════════════════╝

Customise the AGENT_INSTRUCTIONS block below to change the agent's:
  • Persona / tone
  • Diet specialisations (veg, vegan, keto, diabetic-friendly …)
  • Safety rules & disclaimers
  • Indian food preferences & regional cuisine awareness
  • Language style (formal / friendly / clinical)
"""

# ──────────────────────────────────────────────────────────────────
#  AGENT INSTRUCTIONS  ← Edit this block to customise the agent
# ──────────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = """
You are NutriBot, a warm, expert AI nutrition assistant powered by IBM Granite.

PERSONA & TONE
- Friendly, encouraging, and science-backed.
- Use simple language; avoid heavy jargon unless the user is clearly an expert.
- Always be empathetic — nutrition is personal and emotional.

SPECIALISATIONS
- Personalised macro/micro-nutrient planning based on age, weight, height, activity.
- Indian cuisine expertise: prioritise dal, sabzi, roti, rice, chaas, idli/dosa,
  poha, upma, khichdi, and seasonal regional foods from all Indian states.
- Vegetarian-first approach; offer vegan and non-veg alternatives when asked.
- Diabetic-friendly, heart-healthy, weight-loss, and sports nutrition variants.
- Family diet planning (children ≥2 y, pregnant/lactating women, seniors ≥60 y).

CALORIE & NUTRITION RULES
- Use standard ICMR (Indian Council of Medical Research) RDA values for Indian users.
- When calculating BMR use Mifflin-St Jeor equation.
- Always provide portion sizes in grams AND in familiar Indian measures (katori,
  tablespoon, piece, etc.).
- When listing a meal plan, always include approximate calories per meal and daily total.

SAFETY & DISCLAIMER
- Never diagnose medical conditions or replace professional medical advice.
- For queries involving diabetes, heart disease, kidney issues, cancer, or eating
  disorders, always recommend consulting a registered dietitian/doctor.
- Do not recommend extreme calorie restriction below 1200 kcal/day for adults.
- Flag any supplement dosage questions with "consult a healthcare provider".

RESPONSE FORMAT
- Use markdown-style structure: bold headings, bullet points, tables where useful.
- Keep responses concise (≤400 words) unless the user asks for a full weekly plan.
- For meal plans, always present as: Breakfast / Mid-Morning / Lunch /
  Evening Snack / Dinner / Optional Post-Dinner.
- End each response with one actionable tip or motivational nudge.

LANGUAGE
- Default: English. If the user writes in Hindi or a regional language, respond
  in that language with English food names in parentheses.
"""
# ──────────────────────────────────────────────────────────────────

import os
import json
import logging
from datetime import datetime
from pathlib import Path

from flask import (
    Flask, render_template, request, jsonify, session, redirect, url_for
)
from dotenv import load_dotenv

load_dotenv()

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Flask app ─────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")

PROFILES_DIR = Path(os.getenv("PROFILES_DIR", "./profiles"))
PROFILES_DIR.mkdir(parents=True, exist_ok=True)

# ── Watsonx credentials ───────────────────────────────────────────
IBM_API_KEY    = os.getenv("IBM_API_KEY", "")
IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID", "")
IBM_URL        = os.getenv("IBM_WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
MODEL_ID       = os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")



# ── Watsonx client (lazy-init) ────────────────────────────────────
_wx_model = None

def get_wx_model():
    """Lazy-initialise the Watsonx ModelInference client."""
    global _wx_model
    if _wx_model is not None:
        return _wx_model
    if not IBM_API_KEY or not IBM_PROJECT_ID:
        log.warning("IBM_API_KEY or IBM_PROJECT_ID not set — AI responses disabled.")
        return None
    try:
        from ibm_watsonx_ai import Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference
        from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as Params

        creds = Credentials(url=IBM_URL, api_key=IBM_API_KEY)
        params = {
            Params.MAX_NEW_TOKENS: 1024,
            Params.TEMPERATURE:    0.7,
            Params.TOP_P:          0.9,
            Params.REPETITION_PENALTY: 1.1,
        }
        _wx_model = ModelInference(
            model_id=MODEL_ID,
            credentials=creds,
            project_id=IBM_PROJECT_ID,
            params=params,
        )
        log.info("Watsonx model '%s' initialised.", MODEL_ID)
        return _wx_model
    except Exception as exc:
        log.error("Failed to init Watsonx model: %s", exc)
        return None


def call_watsonx(prompt: str) -> str:
    """Send a prompt to the Watsonx model and return the text response."""
    model = get_wx_model()
    if model is None:
        return (
            "⚠️ AI backend is not configured. Please set IBM_API_KEY and "
            "IBM_PROJECT_ID in your .env file."
        )
    try:
        result = model.generate_text(prompt=prompt)
        return result.strip() if isinstance(result, str) else str(result)
    except Exception as exc:
        log.error("Watsonx generate error: %s", exc)
        return f"⚠️ Error communicating with Watsonx: {exc}"


def build_prompt(user_message: str, profile: dict, history: list) -> str:
    """Assemble the full prompt with system instructions, profile context and history."""
    profile_block = ""
    if profile:
        profile_block = f"""
CURRENT USER PROFILE:
  Name: {profile.get('name', 'N/A')}
  Age: {profile.get('age', 'N/A')} years
  Gender: {profile.get('gender', 'N/A')}
  Weight: {profile.get('weight', 'N/A')} kg
  Height: {profile.get('height', 'N/A')} cm
  Activity Level: {profile.get('activity', 'N/A')}
  Health Goals: {profile.get('goals', 'N/A')}
  Dietary Preferences: {profile.get('diet_type', 'N/A')}
  Allergies / Restrictions: {profile.get('allergies', 'None')}
  Medical Conditions: {profile.get('conditions', 'None')}
  Region / Cuisine Preference: {profile.get('region', 'Indian')}
"""

    history_block = ""
    for turn in history[-6:]:          # keep last 3 exchanges for context
        role  = "User"  if turn["role"] == "user"  else "NutriBot"
        history_block += f"{role}: {turn['content']}\n"

    prompt = (
        f"{AGENT_INSTRUCTIONS}\n\n"
        f"{profile_block}\n"
        f"CONVERSATION HISTORY:\n{history_block}\n"
        f"User: {user_message}\n"
        f"NutriBot:"
    )
    return prompt


# ── BMI helper ────────────────────────────────────────────────────
def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    if height_cm <= 0:
        return {}
    h_m = height_cm / 100.0
    bmi = round(weight_kg / (h_m ** 2), 1)
    if bmi < 18.5:
        category, color = "Underweight", "#f59e0b"
    elif bmi < 25.0:
        category, color = "Normal weight", "#22c55e"
    elif bmi < 30.0:
        category, color = "Overweight", "#f97316"
    else:
        category, color = "Obese", "#ef4444"
    return {"bmi": bmi, "category": category, "color": color}


# ── TDEE / calorie helper ─────────────────────────────────────────
ACTIVITY_FACTORS = {
    "sedentary":     1.2,
    "light":         1.375,
    "moderate":      1.55,
    "active":        1.725,
    "very_active":   1.9,
}

def calculate_tdee(age: int, gender: str, weight: float, height: float, activity: str) -> dict:
    """Mifflin-St Jeor BMR → TDEE."""
    if gender.lower() in ("male", "m"):
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    factor = ACTIVITY_FACTORS.get(activity.lower().replace(" ", "_"), 1.55)
    tdee = round(bmr * factor)
    return {
        "bmr":          round(bmr),
        "tdee":         tdee,
        "weight_loss":  tdee - 500,
        "weight_gain":  tdee + 300,
        "maintenance":  tdee,
    }


# ── Profile helpers ───────────────────────────────────────────────
def load_family_profiles() -> list:
    path = PROFILES_DIR / "family.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def save_family_profiles(profiles: list) -> None:
    path = PROFILES_DIR / "family.json"
    path.write_text(json.dumps(profiles, indent=2, ensure_ascii=False), encoding="utf-8")


# ══════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    """Main single-page application."""
    if "chat_history" not in session:
        session["chat_history"] = []
    if "active_profile" not in session:
        session["active_profile"] = {}
    return render_template("index.html")


# ── Chat endpoint ─────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    data    = request.get_json(force=True)
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Empty message"}), 400

    history = session.get("chat_history", [])
    profile = session.get("active_profile", {})

    prompt   = build_prompt(message, profile, history)
    response = call_watsonx(prompt)

    history.append({"role": "user",      "content": message,  "ts": _ts()})
    history.append({"role": "assistant", "content": response, "ts": _ts()})
    session["chat_history"] = history[-40:]   # keep last 20 exchanges
    session.modified = True

    return jsonify({"response": response, "ts": _ts()})


# ── Clear chat ────────────────────────────────────────────────────
@app.route("/api/chat/clear", methods=["POST"])
def clear_chat():
    session["chat_history"] = []
    session.modified = True
    return jsonify({"status": "cleared"})


# ── BMI calculator ────────────────────────────────────────────────
@app.route("/api/bmi", methods=["POST"])
def bmi():
    data = request.get_json(force=True)
    try:
        weight = float(data["weight"])
        height = float(data["height"])
    except (KeyError, ValueError):
        return jsonify({"error": "Invalid weight/height"}), 400
    return jsonify(calculate_bmi(weight, height))


# ── TDEE / calorie needs ──────────────────────────────────────────
@app.route("/api/tdee", methods=["POST"])
def tdee():
    data = request.get_json(force=True)
    try:
        result = calculate_tdee(
            age      = int(data["age"]),
            gender   = str(data["gender"]),
            weight   = float(data["weight"]),
            height   = float(data["height"]),
            activity = str(data["activity"]),
        )
        return jsonify(result)
    except (KeyError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 400


# ── Meal plan generator ───────────────────────────────────────────
@app.route("/api/meal-plan", methods=["POST"])
def meal_plan():
    data    = request.get_json(force=True)
    profile = session.get("active_profile", {})
    profile.update({k: v for k, v in data.items() if v})   # merge request data

    days     = int(data.get("days", 7))
    goal     = data.get("goal", "balanced")
    cuisine  = data.get("cuisine", "Indian")
    diet     = data.get("diet_type", profile.get("diet_type", "vegetarian"))

    prompt = (
        f"{AGENT_INSTRUCTIONS}\n\n"
        f"Generate a detailed {days}-day {cuisine} {diet} meal plan for:\n"
        f"  Goal: {goal}\n"
        f"  Age: {profile.get('age', 'adult')}, Gender: {profile.get('gender', 'unspecified')}\n"
        f"  Weight: {profile.get('weight', '?')} kg, Height: {profile.get('height', '?')} cm\n"
        f"  Activity: {profile.get('activity', 'moderate')}\n"
        f"  Allergies: {profile.get('allergies', 'none')}\n"
        f"  Medical: {profile.get('conditions', 'none')}\n\n"
        f"Format each day as: Day N → Breakfast / Mid-Morning / Lunch / "
        f"Evening Snack / Dinner with portion sizes and approximate calories.\n"
        f"Include a weekly calorie summary at the end."
    )
    response = call_watsonx(prompt)
    return jsonify({"plan": response})


# ── Nutrition analysis ────────────────────────────────────────────
@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json(force=True)
    food = data.get("food", "").strip()
    if not food:
        return jsonify({"error": "No food item provided"}), 400

    prompt = (
        f"{AGENT_INSTRUCTIONS}\n\n"
        f"Provide a detailed nutritional analysis for: {food}\n"
        f"Include: calories per 100g, protein, carbohydrates, fat, fibre, "
        f"key vitamins/minerals, glycaemic index (if known), and 2 healthy "
        f"preparation tips. Format as a structured response."
    )
    response = call_watsonx(prompt)
    return jsonify({"analysis": response})


# ── Family profile CRUD ───────────────────────────────────────────
@app.route("/api/profiles", methods=["GET"])
def get_profiles():
    return jsonify(load_family_profiles())


@app.route("/api/profiles", methods=["POST"])
def add_profile():
    data     = request.get_json(force=True)
    profiles = load_family_profiles()
    data["id"] = _ts()
    profiles.append(data)
    save_family_profiles(profiles)
    return jsonify({"status": "saved", "id": data["id"]})


@app.route("/api/profiles/<profile_id>", methods=["DELETE"])
def delete_profile(profile_id):
    profiles = [p for p in load_family_profiles() if str(p.get("id")) != str(profile_id)]
    save_family_profiles(profiles)
    return jsonify({"status": "deleted"})


@app.route("/api/profiles/activate/<profile_id>", methods=["POST"])
def activate_profile(profile_id):
    profiles = load_family_profiles()
    for p in profiles:
        if str(p.get("id")) == str(profile_id):
            session["active_profile"] = p
            session.modified = True
            return jsonify({"status": "activated", "profile": p})
    return jsonify({"error": "Profile not found"}), 404


@app.route("/api/active-profile", methods=["GET"])
def get_active_profile():
    return jsonify(session.get("active_profile", {}))


# ── Quick suggestions ─────────────────────────────────────────────
@app.route("/api/suggestions", methods=["GET"])
def suggestions():
    """Return context-aware quick-prompt suggestions."""
    tips = [
        "Give me a 7-day Indian vegetarian meal plan for weight loss",
        "What are high-protein breakfast options for a vegetarian?",
        "Calculate my daily calorie needs",
        "Suggest diabetic-friendly Indian snacks",
        "What is the nutritional value of dal makhani?",
        "Plan a healthy lunch for my 8-year-old child",
        "Best pre-workout and post-workout meals for gym goers",
        "Suggest a low-carb Indian dinner menu",
        "How much water should I drink daily?",
        "Give me an iron-rich diet plan for anaemia",
    ]
    return jsonify(tips)


# ── Health status ─────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status":    "ok",
        "model":     MODEL_ID,
        "ai_ready":  bool(IBM_API_KEY and IBM_PROJECT_ID),
        "timestamp": _ts(),
    })


# ── Utility ───────────────────────────────────────────────────────
def _ts() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


if __name__ == "__main__":
    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    log.info("Starting Nutrition Agent on port %d (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
