from transformers import pipeline
import sys
import json

# Khởi tạo pipeline với mô hình wonrax/phobert-base-vietnamese-sentiment
sentiment_analyzer = pipeline(
    "sentiment-analysis",
    model="wonrax/phobert-base-vietnamese-sentiment",
    tokenizer="vinai/phobert-base"
)

def analyze_comment(comment):
    try:
        result = sentiment_analyzer(comment)[0]
        # Ánh xạ nhãn từ POS/NEG/NEU sang POSITIVE/NEGATIVE/NEUTRAL
        label_mapping = {
            "POS": "POSITIVE",
            "NEG": "NEGATIVE",
            "NEU": "NEUTRAL"
        }
        label = label_mapping[result["label"]]
        return {
            "comment": comment,
            "label": label,
            "score": result["score"]
        }
    except Exception as e:
        print(f"Error in analysis: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    comment = sys.argv[1]
    result = analyze_comment(comment)
    print(json.dumps(result))