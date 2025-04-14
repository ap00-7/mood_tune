# mood_tune
MoodTune: A Mood-Based Song Recommendation App
MoodTune is a web-based application that recommends Spotify songs based on the user's mood, detected through a simple text input. It uses Natural Language Processing (NLP) and emotion classification to analyze how the user feels and suggests songs accordingly.

The app is built using Streamlit for the interactive UI, Transformers for emotion detection, and the Spotify dataset to provide song recommendations.

Features:
Mood Detection: Users describe their feelings, and the app detects their mood using a pre-trained emotion classification model.

Song Recommendation: Based on the detected mood, the app recommends a curated list of songs from Spotify, featuring the song title, artist, energy level, and more.

User-Friendly Interface: The app has a modern dark-themed UI with smooth animations, glowing effects, and visually appealing gradients.

Technologies Used:
Python: Core programming language.

Streamlit: Framework for the frontend and deployment.

Transformers: NLP for emotion detection using a pre-trained model.

Pandas: Data handling and manipulation.

Pillow: Image handling.

How It Works:
Users input a short description of their feelings.

The app uses an emotion detection model to classify the text.

Based on the detected emotion, the app maps it to a mood category (Happy, Sad, Energetic, Chill).

The app fetches relevant song recommendations from the Spotify dataset and displays them to the user with play links.
