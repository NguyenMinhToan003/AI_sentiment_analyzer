const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
const port = 3000;

app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true
}));

// URL kết nối MongoDB Atlas
const url = 'mongodb+srv://nguyentoantune04:ojoWKYb8xnLr46la@cluster0.lutcr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const dbName = 'AI_COBAN';
let db;

// Kết nối MongoDB
MongoClient.connect(url)
    .then(client => {
        console.log('Connected to MongoDB Atlas');
        db = client.db(dbName);
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

app.use(bodyParser.json());
app.use(express.static('public'));

// Hàm chạy lệnh Python và xử lý kết quả
const runPythonScript = (comment) => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['python/sentiment_analyzer.py', comment]);
        let result = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`Python Error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const analysis = JSON.parse(result);
                    resolve(analysis);
                } catch (e) {
                    reject(new Error(`Failed to parse analysis result: ${e.message}`));
                }
            } else {
                reject(new Error(`Python script failed: ${errorOutput || 'Unknown error'}`));
            }
        });
    });
};

// API phân tích bình luận
app.post('/comment-analys', async (req, res) => {
    const { comment, postId } = req.body;
    if (!comment || !postId || comment.trim() === '') {
        return res.status(400).json({ error: 'Cần điền đầy đủ thông tin(comment, postId)' });
    }
    try {
        const analysis = await runPythonScript(comment.trim());
        const commentData = {
            text: analysis.comment,
            label: analysis.label,
            score: analysis.score,
            date: new Date(), // Đã có sẵn
            post: new ObjectId(postId)
        };
        await db.collection('comments').insertOne(commentData);
        return res.status(201).json(commentData);
    } catch (err) {
        res.status(500).json({ error: 'add comment is failed', details: err.message });
    }
});

// API lấy danh sách bình luận (mới nhất trước)
app.get('/comments', async (req, res) => {
    try {
        const comments = await db.collection('comments')
            .find()
            .sort({ date: -1 }) // Sắp xếp theo date giảm dần (mới nhất trước)
            .toArray();
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch comments', details: err.message });
    }
});

// API tạo bài viết
app.post('/post', async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Cần điền đầy đủ thông tin (title, content)' });
        }
        const postData = { title, content, date: new Date() }; // Thêm trường date
        const result = await db.collection('post').insertOne(postData);
        return res.status(201).json({ ...postData, _id: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: 'post bài viết bị thất bại', details: err.message });
    }
});

// API lấy danh sách bài viết (mới nhất trước)
app.get('/posts', async (req, res) => {
    try {
        const posts = await db.collection('post')
            .find()
            .sort({ date: -1 }) // Sắp xếp theo date giảm dần (mới nhất trước)
            .toArray();
        return res.status(200).json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch post', details: err.message });
    }
});

// API lấy chi tiết bài viết (bình luận mới nhất trước)
app.get('/post', async (req, res) => {
    const postId = req.query.postId;
    if (!postId) {
        return res.status(400).json({ error: 'Cần nhập postId' });
    }
    try {
        const post = await db.collection('post').findOne({ _id: new ObjectId(postId) });
        const comments = await db.collection('comments')
            .find({ post: new ObjectId(postId) })
            .sort({ date: -1 }) // Sắp xếp bình luận theo date giảm dần (mới nhất trước)
            .toArray();
        post.comments = comments;
        return res.status(200).json(post);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch post', details: err.message });
    }
});

// API đánh giá toàn bộ bình luận đã phân tích (mới nhất trước trong aggregate)
app.get('/evaluate-post', async (req, res) => {
    const postId = req.query.postId;
    try {
        const analyzedComments = await db.collection('comments').aggregate([
            {
                $match: {
                    post: new ObjectId(postId),
                    label: { $ne: null },
                    score: { $ne: null }
                }
            },
        ]).toArray();

        if (analyzedComments.length === 0) {
            return res.status(200).json({ message: 'Không có bình luận để phân tích' });
        }

        const totalComments = analyzedComments.length;
        let positiveCount = 0, negativeCount = 0, neutralCount = 0, totalScore = 0;

        analyzedComments.forEach(comment => {
            switch (comment.label) {
                case 'POSITIVE':
                    positiveCount++;
                    break;
                case 'NEGATIVE':
                    negativeCount++;
                    break;
                case 'NEUTRAL':
                    neutralCount++;
                    break;
            }
            totalScore += comment.score;
        });

        const positivePercentage = ((positiveCount / totalComments) * 100).toFixed(2);
        const negativePercentage = ((negativeCount / totalComments) * 100).toFixed(2);
        const neutralPercentage = ((neutralCount / totalComments) * 100).toFixed(2);
        const averageScore = (totalScore / totalComments).toFixed(2);

        const chartData = [
            { browser: 'Tích Cực', visitors: parseFloat(positivePercentage), fill: 'var(--color-POSITIVE)',count: positiveCount, },
            { browser: 'Trung Lập', visitors: parseFloat(neutralPercentage), fill: 'var(--color-NEUTRAL)',count: neutralCount, },
            { browser: 'Tiêu Cực', visitors: parseFloat(negativePercentage), fill: 'var(--color-NEGATIVE)',count: negativeCount, },
        ];

        let message = '';
        if (negativePercentage >= 50) {
            message = 'Phần lớn bình luận mang tính tiêu cực, cần xem xét cải thiện sản phẩm hoặc dịch vụ.';
        } else if (positivePercentage >= 50) {
            message = 'Đa số bình luận tích cực, sản phẩm/dịch vụ đang được đánh giá tốt.';
        } else if (neutralPercentage >= 50) {
            message = 'Các bình luận chủ yếu trung tính, chưa có xu hướng rõ rệt.';
        } else {
            message = 'Các ý kiến phân bố khá đồng đều, cần phân tích chi tiết hơn.';
        }

        res.json({
            totalComments,
            chartData,
            averageScore: parseFloat(averageScore),
            message
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to evaluate comments', details: err.message });
    }
});

// Kiểm tra Python trước khi khởi động server
const checkPython = () => {
    const pythonCheck = spawn('python', ['-c', 'import sys; print(sys.executable)']);
    pythonCheck.stdout.on('data', (data) => {
        console.log(`Python path: ${data.toString().trim()}`);
    });
    pythonCheck.stderr.on('data', (data) => {
        console.error(`Python not found: ${data.toString()}`);
        process.exit(1);
    });
};

checkPython();
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});