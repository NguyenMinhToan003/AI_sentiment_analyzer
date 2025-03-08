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
        # Lấy tất cả điểm số mà không lấy index [0] ngay
        results = sentiment_analyzer(comment, top_k=None)
        print("Debug - Raw results:", results)  # In ra để kiểm tra cấu trúc
        
        # Ánh xạ nhãn từ POS/NEG/NEU sang POSITIVE/NEGATIVE/NEUTRAL
        label_mapping = {"POS": "POSITIVE", "NEG": "NEGATIVE", "NEU": "NEUTRAL"}
        
        # Chuyển danh sách thành dictionary
        scores = {label_mapping[res["label"]]: res["score"] for res in results}
        
        # Tìm nhãn có điểm cao nhất
        max_label = max(scores, key=scores.get)
        return {
            "comment": comment,
            "label": max_label,
            "score": scores[max_label],
            "all_scores": scores
        }
    except Exception as e:
        print(f"Error in analysis: {str(e)}", file=sys.stderr)
        sys.exit(1)

