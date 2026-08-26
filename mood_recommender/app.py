import pandas as pd
import streamlit as st
from PIL import Image
import base64
from io import BytesIO
import html
import os
from glob import glob
from urllib.parse import quote_plus

st.set_page_config(page_title="MoodTune", page_icon="🎧", layout="wide")

@st.cache_resource
def load_emotion_classifier():
    from transformers import pipeline

    return pipeline(
        "text-classification",
        model="j-hartmann/emotion-english-distilroberta-base",
        top_k=1
    )

emotion_to_mood = {
    "admiration": "happy",
    "amusement": "happy",
    "approval": "happy",
    "caring": "chill",
    "desire": "chill",
    "excitement": "energetic",
    "gratitude": "happy",
    "joy": "happy",
    "love": "chill",
    "optimism": "happy",
    "pride": "happy",
    "relief": "chill",
    "surprise": "energetic",
    "anger": "energetic",
    "disapproval": "sad",
    "disgust": "sad",
    "embarrassment": "sad",
    "fear": "sad",
    "grief": "sad",
    "nervousness": "sad",
    "remorse": "sad",
    "sadness": "sad",
    "confusion": "chill",
    "curiosity": "chill",
    "neutral": "chill",
    "contentment": "happy",
    "euphoria": "energetic",
    "serenity": "chill",
    "affection": "chill",
    "boredom": "sad",
    "envy": "sad",
    "guilt": "sad",
    "frustration": "sad",
    "hope": "happy",
    "awe": "happy",
    "bashfulness": "sad",
    "bravery": "energetic",
    "compassion": "chill",
    "delight": "happy",
    "ecstasy": "energetic",
    "fondness": "chill",
    "forgiveness": "chill",
    "friendliness": "happy",
    "gloom": "sad",
    "happiness": "happy",
    "homesickness": "sad",
    "hurt": "sad",
    "insecurity": "sad",
    "interest": "chill",
    "irritation": "sad",
    "kindness": "chill",
    "loneliness": "sad",
    "melancholy": "sad",
    "nostalgia": "chill",
    "outrage": "energetic",
    "panic": "sad",
    "passion": "energetic",
    "peacefulness": "chill",
    "rage": "energetic",
    "regret": "sad",
    "reluctance": "sad",
    "satisfaction": "happy",
    "scorn": "sad",
    "self-pity": "sad",
    "shock": "energetic",
    "shyness": "sad",
    "sorrow": "sad",
    "tenderness": "chill",
    "triumph": "happy",
    "trust": "happy",
    "unhappiness": "sad",
    "wonder": "happy",
    "worry": "sad",
    "zeal": "energetic",
    "agitation": "energetic",
    "alienation": "sad",
    "amazement": "energetic",
    "annoyance": "sad",
    "anxiety": "sad",
    "anticipation": "happy",
    "apprehension": "sad",
    "arousal": "energetic",
    "astonishment": "energetic",
    "bewilderment": "chill",
    "bitterness": "sad",
    "bliss": "happy",
    "calmness": "chill",
    "cheerfulness": "happy",
    "closeness": "chill",
    "complicity": "chill",
    "confidence": "happy",
    "craving": "chill",
    "dread": "sad",
    "elation": "happy",
    "enthusiasm": "energetic",
    "fond": "chill",
    "fury": "energetic",
    "glee": "happy",
    "goodwill": "happy",
    "hesitation": "sad",
    "indignation": "energetic",
    "infatuation": "chill",
    "longing": "sad",
    "mortification": "sad",
    "panic attack": "sad",
    "radiance": "happy",
    "resentment": "sad",
    "suspicion": "sad",
    "thrill": "energetic",
    "zest": "energetic"
}

@st.cache_data
def load_data():
    data_dir = os.path.join(os.path.dirname(__file__), "datasets")
    csv_paths = glob(os.path.join(data_dir, "*.csv"))
    frames = []
    for csv_path in csv_paths:
        source_name = os.path.splitext(os.path.basename(csv_path))[0]
        source_df = pd.read_csv(csv_path)
        source_df = source_df.rename(columns={
            "song_name": "track_name",
            "singer": "artist_name",
            "artists": "artist_name",
            "Valence": "valence",
        })
        if "language" not in source_df:
            source_df["language"] = "Global" if source_name == "dataset" else source_name
        if "track_url" not in source_df:
            search_terms = source_df["track_name"].fillna("").astype(str) + " " + source_df["artist_name"].fillna("").astype(str)
            source_df["track_url"] = "https://open.spotify.com/search/" + search_terms.map(quote_plus)
        if "artwork_url" not in source_df:
            source_df["artwork_url"] = "https://placehold.co/300x300/F4F1EA/17221F?text=MoodTune"
        frames.append(source_df)

    df = pd.concat(frames, ignore_index=True, sort=False)
    required_columns = ["track_name", "artist_name", "valence", "energy", "danceability", "artwork_url", "track_url", "language"]
    df = df.dropna(subset=required_columns)
    for numeric_column in ["valence", "energy", "danceability"]:
        df[numeric_column] = pd.to_numeric(df[numeric_column], errors="coerce")
    df = df.dropna(subset=["valence", "energy", "danceability"])
    df["language"] = df["language"].astype(str).str.strip()
    df = df.drop_duplicates(subset=["track_name", "artist_name", "language"])
    df["mood"] = "chill"
    happy_mask = (df["valence"] > 0.6) & (df["energy"] > 0.6)
    sad_mask = (df["valence"] < 0.4) & (df["energy"] < 0.5)
    energetic_mask = (df["energy"] > 0.7) & (df["valence"] < 0.6)
    df.loc[happy_mask, "mood"] = "happy"
    df.loc[sad_mask, "mood"] = "sad"
    df.loc[energetic_mask, "mood"] = "energetic"
    return df

def get_mood(valence, energy):
    if valence > 0.6 and energy > 0.6:
        return 'happy'
    elif valence < 0.4 and energy < 0.5:
        return 'sad'
    elif energy > 0.7 and valence < 0.6:
        return 'energetic'
    else:
        return 'chill'

@st.cache_data
def classify_mood(text):
    cleaned_text = " ".join(text.split())
    predictions = load_emotion_classifier()(cleaned_text, truncation=True, max_length=512)
    if predictions and isinstance(predictions[0], list):
        predictions = predictions[0]
    emotion = predictions[0]["label"].lower()
    return emotion, emotion_to_mood.get(emotion, "chill")


def detect_mood_from_text(text):
    try:
        emotion, mood = classify_mood(text)
        st.info(f"🎭 Detected Emotion: **{emotion.capitalize()}**")
        return mood
    except Exception as e:
        st.error(f"Failed to detect mood: {e}")
        return "chill"

def recommend_songs(df, mood, language="All", n=5, min_energy=0.0, min_danceability=0.0):
    # Filter by mood first
    mood_df = df[df['mood'] == mood]

    # If a specific language is selected (not "All"), filter by that language (case-insensitive)
    if language != "All":
        language_df = df[df['language'].str.lower() == language.lower()]
        mood_df = mood_df[mood_df['language'].str.lower() == language.lower()]
    else:
        language_df = df

    if mood_df.empty:
        mood_df = language_df

    mood_df = mood_df[
        (mood_df['energy'] >= min_energy)
        & (mood_df['danceability'] >= min_danceability)
    ]

    if mood_df.empty:
        mood_df = language_df

    # If fewer songs available than requested, adjust n
    if len(mood_df) < n:
        n = len(mood_df)

    # Return random sample
    return mood_df[['track_name', 'artist_name', 'valence', 'energy', 'artwork_url', 'track_url']].sample(n)


def playlist_csv(songs):
    return songs[['track_name', 'artist_name', 'track_url']].to_csv(index=False)


def image_to_base64(image_path):
    img = Image.open(image_path)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return img_str

image_path = os.path.join(os.path.dirname(__file__), "logo.png")
img_base64 = image_to_base64(image_path)

st.markdown(f"""
    <style>
    :root {{
        --ink: #17221f;
        --muted: #6d7771;
        --paper: #f4f1ea;
        --surface: #fffdf8;
        --line: #ddd8ce;
        --lime: #c9f15b;
        --coral: #ff6b4a;
        --green: #1f9d61;
    }}
    .stApp {{
        background: radial-gradient(circle at 90% 0%, #e8f3cc 0, transparent 28%), var(--paper);
        color: var(--ink);
    }}
    [data-testid="stHeader"] {{ background: transparent; }}
    [data-testid="stAppViewContainer"] > .main {{ padding-top: 2rem; }}
    .block-container {{ max-width: 1120px; padding-bottom: 4rem; }}
    .brand-row {{ display: flex; align-items: center; gap: 14px; margin-bottom: 3rem; }}
    .brand-mark {{ width: 54px; height: 54px; border-radius: 16px; object-fit: cover; box-shadow: 7px 7px 0 var(--coral); }}
    .brand-name {{ color: var(--ink); font-size: 1.1rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }}
    .hero {{ max-width: 760px; margin-bottom: 2.4rem; animation: rise 0.6s ease-out; }}
    .kicker {{ color: var(--coral); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 0.75rem; }}
    .hero h1 {{ color: var(--ink); font-size: clamp(2.8rem, 7vw, 5.8rem); line-height: 0.94; letter-spacing: -0.04em; margin: 0; }}
    .hero p {{ color: var(--muted); font-size: 1.1rem; line-height: 1.55; max-width: 540px; margin-top: 1.2rem; }}
    .control-label {{ color: var(--ink); font-size: 0.8rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 0.5rem; }}
    .stTextInput label, .stSelectbox label, .stSlider label {{ color: var(--ink) !important; }}
    .stTextInput input, .stSelectbox [data-baseweb="select"] > div {{ background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: 10px; }}
    .stTextInput input:focus {{ border-color: var(--green); box-shadow: 0 0 0 2px rgba(31, 157, 97, 0.14); }}
    .stSlider [data-baseweb="slider"] div[role="slider"] {{ background: var(--green); }}
    .stButton button {{ background: var(--ink); border: 0; border-radius: 10px; color: white; font-weight: 700; min-height: 42px; width: 100%; }}
    .stButton button:hover {{ background: var(--green); color: white; }}
    .stAlert {{ border-radius: 10px; border: 1px solid var(--line); }}
    .section-heading {{ border-top: 1px solid var(--line); display: flex; justify-content: space-between; margin-top: 2.7rem; padding-top: 1.2rem; }}
    .section-heading h2 {{ color: var(--ink); font-size: 1.55rem; margin: 0; }}
    .section-heading span {{ color: var(--muted); font-size: 0.85rem; padding-top: 0.35rem; }}
    .song-card {{ align-items: center; animation: rise 0.6s ease-out both; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; display: flex; gap: 18px; margin: 14px 0; padding: 14px; transition: border-color 0.2s ease, transform 0.2s ease; }}
    .song-card:hover {{ border-color: var(--green); transform: translateY(-2px); }}
    .song-art {{ aspect-ratio: 1; border-radius: 10px; object-fit: cover; width: 88px; }}
    .song-info {{ min-width: 0; }}
    .song-title {{ color: var(--ink); font-size: 1.05rem; font-weight: 800; margin: 0; overflow-wrap: anywhere; }}
    .song-artist {{ color: var(--muted); font-size: 0.9rem; margin: 3px 0 8px; overflow-wrap: anywhere; }}
    .song-meta {{ color: var(--green); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.03em; margin: 0; }}
    .spotify-button {{ background: var(--lime); border-radius: 8px; color: var(--ink); display: inline-block; font-size: 0.8rem; font-weight: 800; margin-top: 10px; padding: 7px 11px; text-decoration: none; }}
    .spotify-button:hover {{ color: var(--ink); background: #b7e53e; }}
    @keyframes rise {{ from {{ opacity: 0; transform: translateY(12px); }} to {{ opacity: 1; transform: translateY(0); }} }}
    @media (max-width: 640px) {{ .brand-row {{ margin-bottom: 2rem; }} .hero h1 {{ font-size: 3.2rem; }} .song-card {{ align-items: flex-start; }} .song-art {{ width: 72px; }} .section-heading {{ display: block; }} }}
    </style>
    <div class="brand-row">
        <img src="data:image/png;base64,{img_base64}" class="brand-mark" alt="MoodTune logo" />
        <span class="brand-name">MoodTune</span>
    </div>
    <div class="hero">
        <div class="kicker">Soundtrack your state of mind</div>
        <h1>Find the sound<br />that fits today.</h1>
        <p>Describe the moment. MoodTune reads the feeling and builds a short, personal listening queue.</p>
    </div>
""", unsafe_allow_html=True)

languages = [
    "All", "Assamese", "Bengali", "Bhojpuri", "English", "Global",
    "Gujarati", "Haryanvi", "Hindi", "Kannada", "Korean", "Malayalam",
    "Marathi", "Odia", "Punjabi", "Rajasthani", "Tamil", "Telugu", "Urdu",
]
if "history" not in st.session_state:
    st.session_state.history = []
if "liked_songs" not in st.session_state:
    st.session_state.liked_songs = []
if "feedback" not in st.session_state:
    st.session_state.feedback = {}

controls = st.columns([2.7, 1.25, 1.1], gap="large")
with controls[0]:
    user_input = st.text_input("What is the mood?", placeholder="e.g. I feel super relaxed today", label_visibility="visible")
with controls[1]:
    selected_language = st.selectbox("Language", options=languages)
with controls[2]:
    result_count = st.slider("Picks", min_value=3, max_value=10, value=5)

with st.expander("Tune your recommendations"):
    preference_columns = st.columns(2)
    with preference_columns[0]:
        min_energy = st.slider("Minimum energy", 0.0, 1.0, 0.0, 0.05)
    with preference_columns[1]:
        min_danceability = st.slider("Minimum danceability", 0.0, 1.0, 0.0, 0.05)

selected_mood = user_input.strip()
refresh = st.button("↻  Refresh picks", use_container_width=True)

if selected_mood and selected_mood != st.session_state.get("last_mood_input"):
    active_mood = detect_mood_from_text(selected_mood)
    st.session_state.last_mood_input = selected_mood
    st.session_state.generated_request = {
        "mood": active_mood,
        "language": selected_language,
        "count": result_count,
        "min_energy": min_energy,
        "min_danceability": min_danceability,
    }
elif selected_mood and "generated_request" in st.session_state:
    st.session_state.generated_request.update({
        "language": selected_language,
        "count": result_count,
        "min_energy": min_energy,
        "min_danceability": min_danceability,
    })

if refresh:
    if "generated_request" not in st.session_state:
        st.warning("Generate a queue first, then refresh the picks.")
    else:
        st.session_state.refresh_id = st.session_state.get("refresh_id", 0) + 1

if "generated_request" in st.session_state:
    df = load_data()
    request = st.session_state.generated_request
    active_mood = request["mood"]
    selected_language = request["language"]
    result_count = request["count"]
    min_energy = request["min_energy"]
    min_danceability = request["min_danceability"]
    st.success(f"Mood match: **{active_mood.capitalize()}**")

    request_signature = (active_mood, selected_language, result_count, min_energy, min_danceability)
    queue_signature = request_signature + (st.session_state.get("refresh_id", 0),)
    if st.session_state.get("queue_signature") != queue_signature:
        st.session_state.songs = recommend_songs(
            df, active_mood, selected_language, result_count, min_energy, min_danceability
        )
        st.session_state.queue_signature = queue_signature
    songs = st.session_state.songs
    history_item = {"mood": active_mood, "language": selected_language, "count": len(songs)}
    if not st.session_state.history or st.session_state.history[-1] != history_item:
        st.session_state.history.append(history_item)

    st.markdown(f"<div class=\"section-heading\"><h2>Your listening queue</h2><span>{len(songs)} picks · {selected_language}</span></div>", unsafe_allow_html=True)
    if len(songs) == 0:
        st.warning("No songs found for this mood and language. Try another language.")
    else:
        for index, row in songs.iterrows():
            track_name = html.escape(str(row["track_name"]))
            artist_name = html.escape(str(row["artist_name"]))
            artwork_url = html.escape(str(row["artwork_url"]), quote=True)
            track_url = html.escape(str(row["track_url"]), quote=True)
            st.markdown(f"""
            <div class="song-card">
                <img src="{artwork_url}" class="song-art" alt="Album art" />
                <div class="song-info">
                    <p class="song-title">{track_name}</p>
                    <p class="song-artist">{artist_name}</p>
                    <p class="song-meta">VALENCE {row['valence']:.2f} &nbsp; / &nbsp; ENERGY {row['energy']:.2f}</p>
                    <a href="{track_url}" target="_blank" class="spotify-button" rel="noopener noreferrer">Play on Spotify ↗</a>
                </div>
            </div>
            """, unsafe_allow_html=True)
            feedback_columns = st.columns([1, 1, 8])
            with feedback_columns[0]:
                if st.button("Like", key=f"like_{index}"):
                    song = {"track_name": row["track_name"], "artist_name": row["artist_name"], "track_url": row["track_url"]}
                    if song not in st.session_state.liked_songs:
                        st.session_state.liked_songs.append(song)
                    st.session_state.feedback[index] = "Liked"
            with feedback_columns[1]:
                if st.button("Skip", key=f"skip_{index}"):
                    st.session_state.feedback[index] = "Skipped"
            if index in st.session_state.feedback:
                st.caption(f"Feedback saved: {st.session_state.feedback[index]}")

    st.download_button(
        "Download playlist CSV",
        data=playlist_csv(songs),
        file_name=f"moodtune_{active_mood}.csv",
        mime="text/csv",
        use_container_width=True,
    )

with st.expander("Your session history"):
    if st.session_state.history:
        st.dataframe(pd.DataFrame(st.session_state.history), use_container_width=True, hide_index=True)
    else:
        st.caption("Your recommendations will appear here as you explore.")

if st.session_state.liked_songs:
    with st.expander(f"Liked songs ({len(st.session_state.liked_songs)})"):
        liked_df = pd.DataFrame(st.session_state.liked_songs)
        st.dataframe(liked_df, use_container_width=True, hide_index=True)
        st.download_button(
            "Download liked songs",
            data=liked_df.to_csv(index=False),
            file_name="moodtune_liked_songs.csv",
            mime="text/csv",
            use_container_width=True,
        )
