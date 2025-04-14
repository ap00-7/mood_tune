import pandas as pd
import streamlit as st
from transformers import pipeline
from PIL import Image
import base64
from io import BytesIO
import os

emotion_classifier = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    return_all_scores=False
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
    "neutral": "chill"
}

@st.cache_data
def load_data():
    csv_path = os.path.join(os.path.dirname(__file__), "spotify_tracks.csv")
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=["track_name", "artist_name", "valence", "energy", "artwork_url", "track_url"])
    df['mood'] = df.apply(lambda row: get_mood(row['valence'], row['energy']), axis=1)
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

def detect_mood_from_text(text):
    result = emotion_classifier(text)
    emotion = result[0]['label'].lower()

    st.info(f"🎭 Detected Emotion: **{emotion.capitalize()}**")
    return emotion_to_mood.get(emotion, "chill")

def recommend_songs(df, mood, n=5):
    mood_df = df[df['mood'] == mood]
    if len(mood_df) < n:
        n = len(mood_df)
    return mood_df[['track_name', 'artist_name', 'valence', 'energy', 'artwork_url', 'track_url']].sample(n)

def image_to_base64(image_path):
    img = Image.open(image_path)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return img_str

image_path = os.path.join(os.path.dirname(__file__), "logo.png")
img_base64 = image_to_base64(image_path)

st.markdown(f"""
    <div style="text-align: center; margin-top: 30px; margin-bottom: 40px;">
        <img src="data:image/png;base64,{img_base64}" class="logo" />
        <h1>MoodTune</h1>
        <h4>Your personal mood-based Spotify song recommender</h4>
    </div>
""", unsafe_allow_html=True)


st.markdown(f"""
    <style>
    body, .stApp {{
        background: linear-gradient(160deg, #0d0d0d, #1a1a1a);
        color: #f5f5f5;
        font-family: 'Segoe UI', sans-serif;
        scroll-behavior: smooth;
    }}

    .logo {{
        animation: glowBounce 2s infinite;
        width: 120px;
        border-radius: 50%;
        box-shadow: 0 0 25px #1DB954, 0 0 50px #1DB954;
    }}

    @keyframes glowBounce {{
        0%, 100% {{ transform: translateY(0); box-shadow: 0 0 25px #1DB954; }}
        50% {{ transform: translateY(-10px); box-shadow: 0 0 45px #1DB954; }}
    }}

    .stTextInput>div>div>input {{
        background-color: #222;
        color: #fff;
        border: 1px solid #1DB954;
        border-radius: 10px;
        padding: 12px;
        font-size: 16px;
        transition: all 0.3s ease;
    }}
    .stTextInput>div>div>input:focus {{
        box-shadow: 0 0 10px #1DB954;
    }}

    .stAlert {{
        border-radius: 10px !important;
        animation: fadeInScale 0.5s ease-out;
    }}

    @keyframes fadeInScale {{
        0% {{ opacity: 0; transform: scale(0.95); }}
        100% {{ opacity: 1; transform: scale(1); }}
    }}

    .stMarkdown h1, .stMarkdown h4 {{
        color: #1DB954;
        font-weight: bold;
        animation: glowIn 1.2s ease;
    }}
    @keyframes glowIn {{
        0% {{ opacity: 0; text-shadow: none; }}
        100% {{ opacity: 1; text-shadow: 0 0 8px #1DB954; }}
    }}

    hr {{
        border-top: 1px solid #1DB954;
        margin-top: 10px;
        margin-bottom: 30px;
    }}

    .stMarkdown h2 {{
        color: #f5f5f5;
        text-shadow: 0 0 6px #1DB954;
        margin-top: 20px;
    }}
    </style>
""", unsafe_allow_html=True)


user_input = st.text_input("📝 Describe how you're feeling:", placeholder="e.g. I feel super relaxed today")

if user_input:
    detected_mood = detect_mood_from_text(user_input)
    st.success(f"🧠 Detected Mood: **{detected_mood.capitalize()}**")

    df = load_data()
    songs = recommend_songs(df, detected_mood)

    st.subheader("🎶 Recommended Songs for You:")
    if len(songs) == 0:
        st.warning("😢 Sorry, no songs found for this mood.")
    else:
        for index, row in songs.iterrows():
                    st.markdown(f"""
        <style>
            .song-card {{
                background: linear-gradient(145deg, #1e1e1e, #111111);
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 25px;
                display: flex;
                align-items: center;
                box-shadow: 0 0 20px rgba(29, 185, 84, 0.2), 0 0 30px rgba(0, 0, 0, 0.6);
                animation: fadeInSlide 0.8s ease-in-out;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }}
            .song-card:hover {{
                transform: scale(1.015);
                box-shadow: 0 0 25px rgba(29, 185, 84, 0.4), 0 0 35px rgba(0, 0, 0, 0.7);
            }}
            .song-info {{
                margin-left: 20px;
            }}
            .song-title {{
                color: #ffffff;
                font-size: 1.2rem;
                font-weight: bold;
                margin: 0;
            }}
            .song-artist {{
                color: #bbbbbb;
                font-size: 0.95rem;
                margin: 4px 0;
            }}
            .song-meta {{
                color: #1DB954;
                font-size: 0.9rem;
                margin-top: 6px;
            }}
            .spotify-button {{
                display: inline-block;
                background: linear-gradient(to right, #1DB954, #1ed760);
                color: #000;
                font-weight: bold;
                padding: 8px 16px;
                border-radius: 8px;
                text-decoration: none;
                margin-top: 10px;
                box-shadow: 0 0 10px rgba(29, 185, 84, 0.6);
                transition: background 0.3s ease;
            }}
            .spotify-button:hover {{
                background: linear-gradient(to right, #1ed760, #1DB954);
            }}
            @keyframes fadeInSlide {{
                0% {{ opacity: 0; transform: translateY(30px); }}
                100% {{ opacity: 1; transform: translateY(0); }}
            }}
        </style>

        <div class="song-card">
            <img src="{row['artwork_url']}" width="100" style="border-radius: 10px;" />
            <div class="song-info">
                <p class="song-title">🎵 {row['track_name']}</p>
                <p class="song-artist">👤 <i>{row['artist_name']}</i></p>
                <p class="song-meta">🎚️ Valence: {row['valence']:.2f} | Energy: {row['energy']:.2f}</p>
                <a href="{row['track_url']}" target="_blank" class="spotify-button">▶️ Play on Spotify</a>
            </div>
        </div>
    """, unsafe_allow_html=True)
